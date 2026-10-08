import { db, usersTable, slugRedirectsTable } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";

export const SLUG_LOCK_MS = 30 * 24 * 60 * 60 * 1000;
export const SLUG_REGEX = /^[a-z0-9_-]{3,24}$/;

const RESERVED = new Set([
  "admin", "login", "settings", "services", "barber",
  "register", "dashboard", "calendar", "clients", "client",
  "api", "b", "verify-telegram", "barber-setup", "feedback",
]);

export type SlugProblem = "ok" | "space" | "format" | "length" | "reserved";

export function slugify(raw: string | null | undefined): string {
  const value = (raw || "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return value.slice(0, 24);
}

export function last4(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function withSuffix(base: string, suffix: string): string {
  const extra = `-${suffix}`;
  const head = base.slice(0, 24 - extra.length).replace(/[-_]+$/g, "");
  return `${head}${extra}`;
}

export function validateSlug(raw: string): SlugProblem {
  if (/\s/.test(raw)) return "space";
  const lower = raw.toLowerCase();
  if (!/^[a-z0-9_-]*$/.test(lower)) return "format";
  if (lower.length < 3 || lower.length > 24) return "length";
  if (RESERVED.has(lower)) return "reserved";
  return "ok";
}

export async function isSlugAvailable(slug: string, forUserId?: string): Promise<boolean> {
  const [owner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, slug))
    .limit(1);
  if (owner && owner.id !== forUserId) return false;
  if (owner && owner.id === forUserId) return true;

  const [held] = await db
    .select({ userId: slugRedirectsTable.userId })
    .from(slugRedirectsTable)
    .where(and(
      eq(slugRedirectsTable.oldSlug, slug),
      or(isNull(slugRedirectsTable.expiresAt), gt(slugRedirectsTable.expiresAt, new Date())),
    ))
    .limit(1);
  if (!held) return true;
  return !!forUserId && held.userId === forUserId;
}

export async function allocatePublicSlug(input: {
  brandName?: string | null;
  name: string;
  phone?: string | null;
}): Promise<string> {
  const phone4 = last4(input.phone);
  const bases = [slugify(input.brandName), slugify(input.name)].filter((item) => item.length >= 3);
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const base of bases) {
    candidates.push(base);
    if (phone4) candidates.push(withSuffix(base, phone4));
  }
  for (const candidate of candidates) {
    if (seen.has(candidate) || validateSlug(candidate) !== "ok") continue;
    seen.add(candidate);
    if (await isSlugAvailable(candidate)) return candidate;
  }

  const fallback = slugify(input.name).slice(0, 18) || "usta";
  for (let i = 0; i < 30; i++) {
    const suffix = phone4 && i === 0 ? phone4 : String(1000 + i);
    const candidate = withSuffix(fallback, suffix);
    if (validateSlug(candidate) === "ok" && await isSlugAvailable(candidate)) return candidate;
  }
  const emergency = `usta-${Date.now().toString().slice(-6)}`.slice(0, 24);
  return emergency;
}

export async function suggestSlug(wanted: string, phone: string | null | undefined, forUserId?: string): Promise<string | null> {
  const four = last4(phone);
  if (!four) return null;
  const base = slugify(wanted);
  if (base.length < 1) return null;
  const candidate = withSuffix(base, four);
  if (validateSlug(candidate) !== "ok") return null;
  if (!(await isSlugAvailable(candidate, forUserId))) return null;
  return candidate;
}
