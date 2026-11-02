export const QR_CARD = {
  width: 1080,
  height: 1280,
  qrSize: 860,
  qrY: 80,
};

export async function drawQrPoster(
  canvas: HTMLCanvasElement,
  opts: { cta: string; qrSvg: SVGSVGElement },
) {
  const { width, height, qrSize, qrY } = QR_CARD;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const qr = await svgToImage(opts.qrSvg);
  const qrX = (width - qrSize) / 2;
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "600 44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  wrapText(ctx, opts.cta.trim(), width / 2, qrY + qrSize + 56, width - 140, 58);
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Blob {
  return new Blob([dataUrlToBytes(canvas.toDataURL("image/png"))], { type: "image/png" });
}

export function canvasToPngBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : "";
}

export function canvasToPdf(canvas: HTMLCanvasElement): Blob {
  return new Blob([canvasPdfBytes(canvas)], { type: "application/pdf" });
}

export function canvasToPdfBase64(canvas: HTMLCanvasElement): string {
  return bytesToBase64(canvasPdfBytes(canvas));
}

function canvasPdfBytes(canvas: HTMLCanvasElement): Uint8Array {
  const jpeg = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92));
  return jpegToA6Pdf(jpeg, canvas.width, canvas.height);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo"));
    img.src = src;
  });
}

function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "680");
  clone.setAttribute("height", "680");
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
}

function jpegToA6Pdf(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const pageW = 297.64;
  const pageH = 419.53;
  const margin = 16;
  const scale = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const x = (pageW - dw) / 2;
  const y = (pageH - dh) / 2;
  const content = `q\n${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let size = 0;
  const push = (chunk: Uint8Array) => {
    parts.push(chunk);
    size += chunk.length;
  };
  const pushText = (text: string) => push(encoder.encode(text));
  pushText("%PDF-1.4\n");
  const startObj = (body: string) => {
    offsets.push(size);
    pushText(body);
  };
  startObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObj("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n");
  startObj(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  );
  const contentBytes = encoder.encode(content);
  offsets.push(size);
  pushText(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  pushText("\nendstream\nendobj\n");
  offsets.push(size);
  pushText(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  pushText("\nendstream\nendobj\n");
  const xref = size;
  let xrefBody = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xrefBody += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pushText(xrefBody);
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
