import { Request, Response, NextFunction } from "express";

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret || secret === "barber_admin_secret_change_me") return null;
  return secret;
}

/**
 * Middleware that requires X-Admin-Secret header to match ADMIN_SECRET env var.
 * Protects export/import endpoints.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = getAdminSecret();
  const provided = req.headers["x-admin-secret"];
  if (!expected || typeof provided !== "string" || provided !== expected) {
    res.status(401).json({
      error: "unauthorized",
      message: "Valid X-Admin-Secret header is required for this endpoint",
    });
    return;
  }
  next();
}
