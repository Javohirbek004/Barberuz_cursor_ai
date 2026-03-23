import { Request, Response, NextFunction } from "express";

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || "barber_admin_secret_change_me";
}

/**
 * Middleware that requires X-Admin-Secret header to match ADMIN_SECRET env var.
 * Protects export/import endpoints.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== getAdminSecret()) {
    res.status(401).json({
      error: "unauthorized",
      message: "Valid X-Admin-Secret header is required for this endpoint",
    });
    return;
  }
  next();
}
