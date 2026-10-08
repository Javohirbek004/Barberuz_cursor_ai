export const QR_CARD = {
  width: 1080,
  height: 1280,
  qrSize: 860,
  qrY: 80,
};

export function qrCenterRatio() {
  return (QR_CARD.qrY + QR_CARD.qrSize / 2) / QR_CARD.height;
}

export async function drawQrPoster(
  canvas: HTMLCanvasElement,
  opts: { cta: string; logoUrl?: string | null; qrSvg: SVGSVGElement },
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

  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const badge = 176;
      const badgeX = qrX + (qrSize - badge) / 2;
      const badgeY = qrY + (qrSize - badge) / 2;
      roundRect(ctx, badgeX, badgeY, badge, badge, 36, "#ffffff");
      drawContain(ctx, logo, badgeX + 18, badgeY + 18, badge - 36, badge - 36);
    } catch {
      // A broken upload must not put a default mark back in the middle.
    }
  }

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "600 44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  wrapText(ctx, opts.cta.trim(), width / 2, qrY + qrSize + 56, width - 140, 58);
}

export async function canvasToPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((file) => file ? resolve(file) : reject(new Error("jpeg")), "image/jpeg", 0.92);
  });
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  return jpegToA6Pdf(jpeg, canvas.width, canvas.height);
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

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
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

function jpegToA6Pdf(jpeg: Uint8Array, imgW: number, imgH: number): Blob {
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
  return new Blob([out], { type: "application/pdf" });
}
