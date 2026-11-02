import { Router } from "express";

const router = Router();

const MAX_BASE64 = 4_000_000;
const MAX_BYTES = 3_000_000;

function loopback(host: string): boolean {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}

function sameSite(req: { get(name: string): string | undefined }): boolean {
  const host = req.get("host") || "";
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (!origin && !referer) return true;
  let sourceHost = "";
  try {
    sourceHost = new URL(origin || referer || "").host;
  } catch {
    return false;
  }
  if (sourceHost === host) return true;
  return loopback(sourceHost) && loopback(host);
}

function safeName(raw: unknown, kind: "png" | "pdf"): string {
  const fallback = `barber-qr.${kind}`;
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, "").replace(/\.\./g, "").slice(0, 80);
  if (!cleaned.toLowerCase().endsWith(`.${kind}`)) return fallback;
  return cleaned;
}

function isPng(bytes: Buffer): boolean {
  return bytes.length > 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47;
}

function isPdf(bytes: Buffer): boolean {
  return bytes.length > 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

// POST /api/qr-file — the phone saves this response as a file.
router.post("/", (req, res) => {
  if (!sameSite(req)) {
    res.status(403).end();
    return;
  }
  const kind = req.body?.kind === "pdf" ? "pdf" : req.body?.kind === "png" ? "png" : null;
  const data = typeof req.body?.data === "string" ? req.body.data : "";
  if (!kind || !data || data.length > MAX_BASE64) {
    res.status(400).end();
    return;
  }
  const bytes = Buffer.from(data, "base64");
  const valid = kind === "png" ? isPng(bytes) : isPdf(bytes);
  if (!valid || bytes.length < 8 || bytes.length > MAX_BYTES) {
    res.status(400).end();
    return;
  }
  const name = safeName(req.body?.name, kind);
  res.setHeader("Content-Type", kind === "png" ? "image/png" : "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Length", String(bytes.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(bytes);
});

export default router;
