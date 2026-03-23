import { Request, Response, NextFunction } from "express";

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// International phone — starts with +, 7-15 digits
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function isPhone(v: unknown): v is string {
  return typeof v === "string" && PHONE_RE.test(v);
}

export function isIso8601(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

/** Validate that req.params.id is a valid UUID */
export function validateUuidParam(req: Request, res: Response, next: NextFunction) {
  if (!isUuid(req.params.id)) {
    res.status(400).json({
      error: "validation",
      message: "Invalid UUID format for :id parameter",
    });
    return;
  }
  next();
}

/** Build a 400 validation error response */
export function validationError(res: Response, message: string) {
  return res.status(400).json({ error: "validation", message });
}

/** Build a 404 not-found response */
export function notFoundError(res: Response, entity = "Resource") {
  return res.status(404).json({ error: "not_found", message: `${entity} not found` });
}

/** Build a 500 server error response */
export function serverError(res: Response, err: unknown) {
  console.error("[v1 API]", err);
  return res.status(500).json({ error: "server_error", message: "Internal server error" });
}
