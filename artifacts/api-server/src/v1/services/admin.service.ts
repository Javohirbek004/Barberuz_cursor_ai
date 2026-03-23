import { exportAllUsers, upsertUser }       from "./users.service";
import { exportAllServices, upsertService } from "./services.service";
import { exportAllBookings, upsertBooking } from "./bookings.service";
import { formatUser }                       from "../models/user.model";
import { formatService }                    from "../models/service.model";
import { formatBooking }                    from "../models/booking.model";

export interface ExportPayload {
  exported_at: string;        // ISO 8601
  version: "1.0";
  users: ReturnType<typeof formatUser>[];
  services: ReturnType<typeof formatService>[];
  bookings: ReturnType<typeof formatBooking>[];
}

/** Export the full database as a portable JSON snapshot */
export async function exportData(): Promise<ExportPayload> {
  const [users, services, bookings] = await Promise.all([
    exportAllUsers(),
    exportAllServices(),
    exportAllBookings(),
  ]);

  return {
    exported_at: new Date().toISOString(),
    version: "1.0",
    users:    users.map(formatUser),
    services: services.map(formatService),
    bookings: bookings.map(formatBooking),
  };
}

export interface ImportResult {
  imported: { users: number; services: number; bookings: number };
  errors: string[];
}

/** Import a JSON snapshot, restoring all rows with original UUIDs */
export async function importData(payload: unknown): Promise<ImportResult> {
  const data = payload as Record<string, unknown>;
  const result: ImportResult = {
    imported: { users: 0, services: 0, bookings: 0 },
    errors: [],
  };

  // ── Users ──
  const users = Array.isArray(data.users) ? data.users : [];
  for (const u of users) {
    try {
      await upsertUser(u as Record<string, unknown>);
      result.imported.users++;
    } catch (err) {
      result.errors.push(`User ${(u as Record<string, unknown>).id}: ${String(err)}`);
    }
  }

  // ── Services (depends on users being imported first) ──
  const services = Array.isArray(data.services) ? data.services : [];
  for (const s of services) {
    try {
      await upsertService(s as Record<string, unknown>);
      result.imported.services++;
    } catch (err) {
      result.errors.push(`Service ${(s as Record<string, unknown>).id}: ${String(err)}`);
    }
  }

  // ── Bookings (depends on users + services) ──
  const bookings = Array.isArray(data.bookings) ? data.bookings : [];
  for (const b of bookings) {
    try {
      await upsertBooking(b as Record<string, unknown>);
      result.imported.bookings++;
    } catch (err) {
      result.errors.push(`Booking ${(b as Record<string, unknown>).id}: ${String(err)}`);
    }
  }

  return result;
}
