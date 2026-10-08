export async function drawQrPoster(
  canvas: HTMLCanvasElement,
  opts: { url: string; address: string; cta: string; logoUrl: string; qrSvg: SVGSVGElement },
) {
  const width = 1080;
  const height = 1520;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const logo = await loadImage(opts.logoUrl);
  drawContain(ctx, logo, (width - 220) / 2, 64, 220, 220);

  const qr = await svgToImage(opts.qrSvg);
  const qrSize = 680;
  const qrX = (width - qrSize) / 2;
  const qrY = 340;
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  const badge = 156;
  const badgeX = qrX + (qrSize - badge) / 2;
  const badgeY = qrY + (qrSize - badge) / 2;
  roundRect(ctx, badgeX, badgeY, badge, badge, 32, "#ffffff");
  drawContain(ctx, logo, badgeX + 18, badgeY + 18, badge - 36, badge - 36);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "600 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  wrapText(ctx, opts.cta, width / 2, qrY + qrSize + 48, width - 160, 52);

  ctx.fillStyle = "#8a6a12";
  ctx.font = "700 34px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.address, width / 2, height - 78);
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
