import type { Request } from "express";

const buckets = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || "")
    .split(",")[0]
    .trim();
  return raw.slice(0, 64) || "unknown";
}

/** True when the request is allowed. False when the window is full. */
export function consumeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const kept = (buckets.get(key) ?? []).filter((at) => now - at < windowMs);
  if (kept.length >= max) {
    buckets.set(key, kept);
    return false;
  }
  kept.push(now);
  buckets.set(key, kept);
  if (buckets.size > 4000) {
    for (const [id, times] of buckets) {
      const fresh = times.filter((at) => now - at < windowMs);
      if (fresh.length === 0) buckets.delete(id);
      else buckets.set(id, fresh);
    }
  }
  return true;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
