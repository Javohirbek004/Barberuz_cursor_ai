import { Request, Response } from "express";
import { formatBooking } from "../models/booking.model";
import {
  listBookings,
  getBookingById,
  createBooking,
  updateBooking,
} from "../services/bookings.service";
import {
  validationError,
  notFoundError,
  serverError,
  isUuid,
  isIso8601,
} from "../middleware/validate";

const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

/** GET /api/v1/bookings?barber_id=...&status=... */
export async function getBookings(req: Request, res: Response) {
  try {
    const barberId = typeof req.query.barber_id === "string" ? req.query.barber_id : undefined;
    const status   = typeof req.query.status   === "string" ? req.query.status   : undefined;

    if (barberId && !isUuid(barberId)) {
      return validationError(res, "Query param 'barber_id' must be a valid UUID");
    }
    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return validationError(res, `Query param 'status' must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const rows = await listBookings({ barber_id: barberId, status });
    res.json({ data: rows.map(formatBooking), total: rows.length });
  } catch (err) {
    serverError(res, err);
  }
}

/** GET /api/v1/bookings/:id */
export async function getBooking(req: Request, res: Response) {
  try {
    const row = await getBookingById(req.params.id);
    if (!row) return notFoundError(res, "Booking");
    res.json({ data: formatBooking(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** POST /api/v1/bookings */
export async function postBooking(req: Request, res: Response) {
  try {
    const { barber_id, client_name, service_id, service_name, booking_time, end_time, price, status, notes, client_id } = req.body;

    if (!barber_id || !isUuid(barber_id)) {
      return validationError(res, "Field 'barber_id' must be a valid UUID");
    }
    if (!client_name || typeof client_name !== "string" || client_name.trim().length === 0) {
      return validationError(res, "Field 'client_name' is required");
    }
    if (!booking_time || !isIso8601(booking_time)) {
      return validationError(res, "Field 'booking_time' must be a valid ISO 8601 timestamp (e.g. 2025-06-15T09:00:00Z)");
    }
    if (service_id && !isUuid(service_id)) {
      return validationError(res, "Field 'service_id' must be a valid UUID");
    }
    if (client_id && !isUuid(client_id)) {
      return validationError(res, "Field 'client_id' must be a valid UUID");
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return validationError(res, `Field 'status' must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const row = await createBooking({
      barber_id,
      client_name: client_name.trim(),
      service_id:  service_id ?? null,
      service_name: service_name ?? null,
      booking_time,
      end_time,
      price: price !== undefined ? String(Number(price).toFixed(2)) : "0.00",
      status: status ?? "confirmed",
      notes: notes ?? null,
      client_id: client_id ?? null,
    });

    res.status(201).json({ data: formatBooking(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** PATCH /api/v1/bookings/:id */
export async function patchBooking(req: Request, res: Response) {
  try {
    const { status, notes, price, booking_time, deleted_at } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return validationError(res, `Field 'status' must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    if (booking_time && !isIso8601(booking_time)) {
      return validationError(res, "Field 'booking_time' must be a valid ISO 8601 timestamp");
    }

    const row = await updateBooking(req.params.id, {
      status,
      notes,
      price: price !== undefined ? String(Number(price).toFixed(2)) : undefined,
      booking_time,
      deleted_at: deleted_at ? new Date(deleted_at) : undefined,
    });

    if (!row) return notFoundError(res, "Booking");
    res.json({ data: formatBooking(row) });
  } catch (err) {
    serverError(res, err);
  }
}
