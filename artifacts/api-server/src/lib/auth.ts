import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Hash a password with HMAC-SHA256 using the PASSWORD_SALT env var.
 *
 * IMPORTANT: parentheses around (process.env.PASSWORD_SALT || "barber_salt_2024")
 * are required — without them, JS evaluates:
 *   (password + process.env.PASSWORD_SALT) || "barber_salt_2024"
 * which gives "passwordundefined" instead of the intended salted string.
 */
export function hashPassword(password: string): string {
  const salt = process.env.PASSWORD_SALT || "barber_salt_2024";
  return crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

/**
 * Legacy hash produced by the bugged formula (no salt, appended "undefined").
 * Used only in the login backward-compat check for users registered before the fix.
 * Returns null if PASSWORD_SALT is set (legacy hashes never existed in that case).
 */
export function legacyHash(password: string): string | null {
  if (process.env.PASSWORD_SALT) return null; // salt was always set → no legacy hashes
  return crypto
    .createHash("sha256")
    .update(password + "undefined")
    .digest("hex");
}

export function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}:${Math.random()}`;
  return Buffer.from(payload).toString("base64url");
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "No token provided" });
    return;
  }
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId] = decoded.split(":");
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
