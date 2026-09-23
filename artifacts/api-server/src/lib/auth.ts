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

export function hashPassword(password: string): string {
  const salt = passwordSalt();
  return crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
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

export function generateToken(userId: string, ttlSeconds: number = SESSION_TTL_SEC): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({ sub: userId, iat: now, exp: now + ttlSeconds });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): string | null {
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
    };
    if (typeof claims.sub !== "string" || !claims.sub) return null;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims.sub;
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
    const userId = verifyToken(token);
    if (!userId) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
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
