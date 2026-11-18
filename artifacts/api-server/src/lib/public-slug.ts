import { db, pendingRegistrationsTable, usersTable, slugRedirectsTable } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";

export const SLUG_LOCK_MS = 30 * 24 * 60 * 60 * 1000;
export const SLUG_REGEX = /^[a-z0-9_-]{3,24}$/;

const RESERVED = new Set([
  "admin", "login", "settings", "services", "barber",
  "register", "dashboard", "calendar", "clients", "client",
  "api", "b", "verify-telegram", "barber-setup", "feedback", "onboarding",
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

/** A live signup can hold a page address before the account row exists. */
async function slugHeldBySignup(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pendingRegistrationsTable.id })
    .from(pendingRegistrationsTable)
    .where(and(
      eq(pendingRegistrationsTable.username, slug),
      gt(pendingRegistrationsTable.expiresAt, new Date()),
    ))
    .limit(1);
  return !!row;
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
  if (held && !(forUserId && held.userId === forUserId)) return false;
  return !(await slugHeldBySignup(slug));
}

export type NameSlugStatus = "empty" | "short" | "free" | "taken";

/** The name typed at signup, and a few free spellings when that page address is taken. */
export async function lookupNameSlug(rawName: string): Promise<{
  status: NameSlugStatus;
  suggestions: string[];
}> {
  const typed = rawName.trim();
  if (!typed) return { status: "empty", suggestions: [] };
  const base = slugify(typed);
  if (validateSlug(base) !== "ok") return { status: "short", suggestions: [] };
  if (await isSlugAvailable(base)) return { status: "free", suggestions: [] };

  const stem = typed.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const named = [`${stem}_uz`, `${stem}_barber`];
  const open = await freeSpellings(named, base);
  if (open.length > 0) return { status: "taken", suggestions: open };

  const numbers = prettyTwoDigits();
  const numbered = numbers.map((n) => `${stem}_${n}`);
  return { status: "taken", suggestions: await freeSpellings(numbered, base, 2) };
}

const PRETTY_NUMBERS = ["24", "27", "32", "36", "42", "48", "54", "58", "64", "72", "76", "84", "88"];

function prettyTwoDigits(): string[] {
  const bag = [...PRETTY_NUMBERS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = bag[i];
    bag[i] = bag[j];
    bag[j] = swap;
  }
  return bag;
}

async function freeSpellings(ideas: string[], base: string, limit = ideas.length): Promise<string[]> {
  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const idea of ideas) {
    const slug = slugify(idea);
    if (seen.has(slug) || slug === base || validateSlug(slug) !== "ok") continue;
    seen.add(slug);
    if (!(await isSlugAvailable(slug))) continue;
    suggestions.push(idea.length <= 24 ? idea : slug);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
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

/**
 * Move one public page to the barber's profile name.
 * The old address keeps opening the new page for 30 days.
 * Does nothing if the name does not match or the new address is taken.
 */
export async function moveSlugToProfileName(currentSlug: string, profileName: string): Promise<boolean> {
  const next = slugify(profileName);
  if (next === currentSlug || validateSlug(next) !== "ok") return false;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.username, currentSlug), isNull(usersTable.deletedAt)))
    .limit(1);
  if (!user || slugify(user.name) !== next) return false;
  if (!(await isSlugAvailable(next, user.id))) return false;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SLUG_LOCK_MS);
  await db.transaction(async (tx) => {
    await tx.delete(slugRedirectsTable).where(and(
      eq(slugRedirectsTable.oldSlug, next),
      eq(slugRedirectsTable.userId, user.id),
    ));
    await tx.insert(slugRedirectsTable).values({
      oldSlug: currentSlug,
      newSlug: next,
      userId: user.id,
      expiresAt,
    });
    await tx.update(usersTable).set({
      username: next,
      updatedAt: now,
    }).where(eq(usersTable.id, user.id));
  });
  return true;
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
