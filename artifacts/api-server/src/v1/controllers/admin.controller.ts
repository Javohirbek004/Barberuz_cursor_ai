import { Request, Response } from "express";
import { exportData, importData } from "../services/admin.service";
import { serverError, validationError } from "../middleware/validate";

/**
 * GET /api/v1/admin/export-data
 * Returns a full portable JSON snapshot of the database.
 * Protected by X-Admin-Secret header.
 */
export async function getExportData(req: Request, res: Response) {
  try {
    const payload = await exportData();

    // Set header to make browser download the file
    res.setHeader("Content-Disposition", `attachment; filename="barber-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Content-Type", "application/json");

    res.json(payload);
  } catch (err) {
    serverError(res, err);
  }
}

/**
 * POST /api/v1/admin/import-data
 * Restores data from a JSON snapshot with the same UUIDs.
 * Performs upserts so existing data is preserved and updated.
 * Protected by X-Admin-Secret header.
 */
export async function postImportData(req: Request, res: Response) {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return validationError(res, "Request body must be a JSON object");
    }
    if (!body.users && !body.services && !body.bookings) {
      return validationError(res, "Import payload must contain at least one of: users, services, bookings");
    }

    const result = await importData(body);

    const statusCode = result.errors.length > 0 ? 207 : 200;
    res.status(statusCode).json({
      success: true,
      imported: result.imported,
      error_count: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    serverError(res, err);
  }
}
