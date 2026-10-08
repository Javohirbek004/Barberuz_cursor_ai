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

export function identityBases(brandName?: string | null, name?: string | null): string[] {
  const seen = new Set<string>();
  const bases: string[] = [];
  for (const raw of [brandName, name]) {
    const base = slugify(raw);
    if (base.length < 3 || seen.has(base) || validateSlug(base) !== "ok") continue;
    seen.add(base);
    bases.push(base);
  }
  return bases;
}

/**
 * Clean shop name, then clean barber name.
 * The phone's last 4 digits are listed only after those, for a real clash.
 */
export function slugCandidates(input: {
  brandName?: string | null;
  name?: string | null;
  phone?: string | null;
}): string[] {
  const bases = identityBases(input.brandName, input.name);
  const phone4 = last4(input.phone);
  if (!phone4) return bases;
  return [...bases, ...bases.map((base) => withSuffix(base, phone4))];
}

/**
 * Signup used to store names like sardor-2000 or sardor_4821.
 * If that tail is not the phone's last 4 digits, and the barber has not
 * chosen the address themselves, the clean name is the one to keep.
 */
export function accidentalCleanSlug(input: {
  username: string;
  brandName?: string | null;
  name?: string | null;
  phone?: string | null;
  slugChangedAt?: Date | string | null;
}): string | null {
  if (input.slugChangedAt) return null;
  const match = input.username.match(/^([a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)[-_](\d{4})$/);
  if (!match) return null;
  const base = match[1];
  const suffix = match[2];
  if (last4(input.phone) === suffix) return null;
  if (!identityBases(input.brandName, input.name).includes(base)) return null;
  return base;
}

export async function allocatePublicSlug(input: {
  brandName?: string | null;
  name: string;
  phone?: string | null;
}): Promise<string> {
  for (const candidate of slugCandidates(input)) {
    if (await isSlugAvailable(candidate)) return candidate;
  }

  // The clean name and the phone suffix are both taken, or the name has no
  // latin letters. This tail is not a fixed 4-digit number.
  const stem = identityBases(input.brandName, input.name)[0] || "usta";
  const phone4 = last4(input.phone);
  for (let i = 0; i < 36; i++) {
    const tail = phone4 ? `${phone4}${i.toString(36)}` : `x${(Date.now() + i).toString(36).slice(-4)}`;
    const candidate = withSuffix(stem, tail);
    if (validateSlug(candidate) === "ok" && await isSlugAvailable(candidate)) return candidate;
  }
  return withSuffix("usta", Date.now().toString(36).slice(-6));
}

export async function repairAccidentalSlug<T extends {
  id: string;
  username: string;
  brandName: string | null;
  name: string;
  phone: string | null;
  slugChangedAt: Date | null;
}>(user: T): Promise<T> {
  const clean = accidentalCleanSlug(user);
  if (!clean || clean === user.username) return user;
  if (!(await isSlugAvailable(clean, user.id))) return user;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SLUG_LOCK_MS);
  await db.transaction(async (tx) => {
    await tx.insert(slugRedirectsTable).values({
      oldSlug: user.username,
      newSlug: clean,
      userId: user.id,
      expiresAt,
    });
    await tx.update(usersTable).set({ username: clean, updatedAt: now }).where(eq(usersTable.id, user.id));
  });
  return { ...user, username: clean };
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
