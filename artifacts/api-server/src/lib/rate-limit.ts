import type { Request } from "express";

interface Bucket {
  times: number[];
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const SOFT_LIMIT = 4000;
const HARD_LIMIT = 20000;

function headerText(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}

/**
 * The person's address as seen by the server's front door.
 * Cloudflare writes CF-Connecting-IP itself and overwrites anything the visitor sends,
 * so it cannot be faked. X-Forwarded-For can be typed by anyone, so it is only the fallback
 * for a computer without Cloudflare in front (local testing).
 */
export function clientIp(req: Request): string {
  const cloudflare = headerText(req.headers["cf-connecting-ip"]);
  if (cloudflare) return cloudflare.slice(0, 64);
  const forwarded = headerText(req.headers["x-forwarded-for"]).split(",")[0].trim();
  const raw = forwarded || req.ip || "";
  return raw.slice(0, 64) || "unknown";
}

function purge(now: number) {
  for (const [id, bucket] of buckets) {
    const fresh = bucket.times.filter((at) => now - at < bucket.windowMs);
    if (fresh.length === 0) buckets.delete(id);
    else bucket.times = fresh;
  }
  if (buckets.size > HARD_LIMIT) {
    // Under a flood of unique keys, drop the oldest ones so memory stays bounded.
    let drop = buckets.size - HARD_LIMIT + 5000;
    for (const id of buckets.keys()) {
      if (drop-- <= 0) break;
      buckets.delete(id);
    }
  }
}

/** True when the request is allowed. False when the window is full. */
export function consumeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  const kept = (existing?.times ?? []).filter((at) => now - at < windowMs);
  if (kept.length >= max) {
    buckets.set(key, { times: kept, windowMs });
    return false;
  }
  kept.push(now);
  buckets.set(key, { times: kept, windowMs });
  if (buckets.size > SOFT_LIMIT) purge(now);
  return true;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
