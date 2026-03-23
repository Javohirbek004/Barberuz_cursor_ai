import { Request, Response } from "express";
import { formatService } from "../models/service.model";
import {
  listServices,
  getServiceById,
  createService,
  updateService,
} from "../services/services.service";
import {
  validationError,
  notFoundError,
  serverError,
  isUuid,
} from "../middleware/validate";

/** GET /api/v1/services?barber_id=... */
export async function getServices(req: Request, res: Response) {
  try {
    const barberId = typeof req.query.barber_id === "string" ? req.query.barber_id : undefined;
    if (barberId && !isUuid(barberId)) {
      return validationError(res, "Query param 'barber_id' must be a valid UUID");
    }
    const rows = await listServices(barberId);
    res.json({ data: rows.map(formatService), total: rows.length });
  } catch (err) {
    serverError(res, err);
  }
}

/** GET /api/v1/services/:id */
export async function getService(req: Request, res: Response) {
  try {
    const row = await getServiceById(req.params.id);
    if (!row) return notFoundError(res, "Service");
    res.json({ data: formatService(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** POST /api/v1/services */
export async function postService(req: Request, res: Response) {
  try {
    const { barber_id, name, name_ru, duration_minutes, price, is_active } = req.body;

    if (!barber_id || !isUuid(barber_id)) {
      return validationError(res, "Field 'barber_id' must be a valid UUID");
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return validationError(res, "Field 'name' is required");
    }
    if (duration_minutes !== undefined && (typeof duration_minutes !== "number" || duration_minutes < 1)) {
      return validationError(res, "Field 'duration_minutes' must be a positive integer");
    }
    if (price !== undefined && isNaN(Number(price))) {
      return validationError(res, "Field 'price' must be a numeric value");
    }

    const row = await createService({
      barber_id,
      name: name.trim(),
      name_ru: name_ru ?? null,
      duration_minutes: duration_minutes ?? 30,
      price: price !== undefined ? String(Number(price).toFixed(2)) : "0.00",
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    res.status(201).json({ data: formatService(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** PATCH /api/v1/services/:id */
export async function patchService(req: Request, res: Response) {
  try {
    const { name, name_ru, duration_minutes, price, is_active, deleted_at } = req.body;

    if (duration_minutes !== undefined && (typeof duration_minutes !== "number" || duration_minutes < 1)) {
      return validationError(res, "Field 'duration_minutes' must be a positive integer");
    }
    if (price !== undefined && isNaN(Number(price))) {
      return validationError(res, "Field 'price' must be a numeric value");
    }

    const row = await updateService(req.params.id, {
      name,
      name_ru,
      duration_minutes,
      price: price !== undefined ? String(Number(price).toFixed(2)) : undefined,
      is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      deleted_at: deleted_at ? new Date(deleted_at) : undefined,
    });

    if (!row) return notFoundError(res, "Service");
    res.json({ data: formatService(row) });
  } catch (err) {
    serverError(res, err);
  }
}
