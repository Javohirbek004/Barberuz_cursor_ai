import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const INSECURE_DEFAULTS = new Set([
  "barber_salt_2024",
  "barber_telegram_secret_2024",
  "barber_admin_secret_change_me",
]);

const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Add it to artifacts/api-server/.env`);
  }
  return value;
}

function jwtSecret(): string {
  const secret = requireEnv("JWT_SECRET");
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return secret;
}

function passwordSalt(): string {
  return requireEnv("PASSWORD_SALT");
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Fail fast on missing or known-insecure secrets.
 * PASSWORD_SALT may still be an old local value in development so existing
 * hashes keep working; production must not use the example defaults.
 */
export function assertAuthSecrets(): void {
  jwtSecret();
  const salt = passwordSalt();
  const tgSecret = requireEnv("TELEGRAM_BOT_SECRET");
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && INSECURE_DEFAULTS.has(salt)) {
    throw new Error("PASSWORD_SALT must be changed from the example value in production");
  }
  if (isProd && INSECURE_DEFAULTS.has(tgSecret)) {
    throw new Error("TELEGRAM_BOT_SECRET must be changed from the example value in production");
  }
  const admin = process.env.ADMIN_SECRET?.trim();
  if (isProd && (!admin || INSECURE_DEFAULTS.has(admin))) {
    throw new Error("ADMIN_SECRET is required in production and must not be the example value");
  }
}

/** Old fast format. Kept only so existing accounts can still sign in; new passwords use makePasswordHash. */
export function hashPassword(password: string): string {
  const salt = passwordSalt();
  return crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MAX_PASSWORD_LENGTH = 1024;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keylen,
      { ...params, maxmem: 256 * params.N * params.r },
      (err, derived) => (err ? reject(err) : resolve(derived)),
    );
  });
}

/**
 * New passwords are stored with scrypt: slow on purpose, and a different random salt
 * for every person, so a stolen database cannot be cracked quickly.
 * Format: scrypt$N$r$p$salt$hash
 */
export async function makePasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return [
    SCRYPT_PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

/**
 * Checks a password against either storage format.
 * `needsUpgrade` is true when it matched the old fast format, so the caller can
 * quietly re-save it with scrypt and nobody has to reset their password.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  const fail = { ok: false, needsUpgrade: false };
  if (typeof password !== "string" || !password || password.length > MAX_PASSWORD_LENGTH) return fail;
  if (!stored) return fail;

  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const parts = stored.split("$");
    if (parts.length !== 6) return fail;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    const sane =
      Number.isInteger(N) && N >= 1024 && N <= 1 << 20 && (N & (N - 1)) === 0 &&
      Number.isInteger(r) && r >= 1 && r <= 16 &&
      Number.isInteger(p) && p >= 1 && p <= 4 &&
      salt.length >= 8 && expected.length >= 16 && expected.length <= 128;
    if (!sane) return fail;
    const derived = await scryptAsync(password, salt, expected.length, { N, r, p });
    const ok = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { ok, needsUpgrade: false };
  }

  // Older accounts: fast salted hash, or the even older unsalted one.
  const current = hashPassword(password);
  const oldest = legacyHash(password);
  const ok = secretsEqual(current, stored) || (oldest !== null && secretsEqual(oldest, stored));
  return { ok, needsUpgrade: ok };
}

/**
 * Legacy hash produced by the bugged formula (no salt, appended "undefined").
 * Used only in the login backward-compat check for users registered before the fix.
 * Returns null if PASSWORD_SALT env is set (legacy hashes never existed in that case).
 */
export function legacyHash(password: string): string | null {
  if (process.env.PASSWORD_SALT) return null;
  return crypto
    .createHash("sha256")
    .update(password + "undefined")
    .digest("hex");
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function generateToken(userId: string, ttlSeconds: number = SESSION_TTL_SEC, sessionEpoch = 0): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({ sub: userId, iat: now, exp: now + ttlSeconds, tv: sessionEpoch });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function readToken(token: string): { sub: string; tv: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  if (!header || !payload || !sig) return null;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
      tv?: unknown;
    };
    if (typeof claims.sub !== "string" || !claims.sub) return null;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: claims.sub, tv: typeof claims.tv === "number" ? claims.tv : 0 };
  } catch {
    return null;
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "No token provided" });
    return;
  }
  const token = auth.slice(7);
  try {
    const claims = readToken(token);
    if (!claims) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.sub)).limit(1);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
      return;
    }
    if ((user.sessionEpoch ?? 0) !== claims.tv) {
      res.status(401).json({ error: "unauthorized", message: "Session ended" });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
}

export function getUser(req: Request) {
  return (req as any).user as typeof usersTable.$inferSelect;
}
