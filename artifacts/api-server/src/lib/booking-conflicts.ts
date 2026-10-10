import { db, bookingsTable } from "@workspace/db";
import { and, eq, isNull, ne, notInArray } from "drizzle-orm";

/** Bookings in these states no longer hold the barber's time. */
export const INACTIVE_STATUSES = ["cancelled", "auto_cancelled", "no_show"] as const;

export function isInactiveStatus(status: string): boolean {
  return (INACTIVE_STATUSES as readonly string[]).includes(status);
}

export function timeToMins(time: string): number {
  const [h, m] = String(time).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minsToTime(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "9:5" is not a time. "09:05" and "09:05:00" are. Returns "HH:MM" or null. */
export function parseClockTime(value: unknown): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** A real calendar day written as YYYY-MM-DD. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y = 0, m = 0, d = 0] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * The barber's booking that overlaps this time, if any. The preparation gap
 * ("oraliq tanaffus") is kept between two services.
 */
export async function findBookingConflict(params: {
  barberId: string;
  date: string;
  startTime: string;
  endTime: string;
  bufferMins: number;
  exceptBookingId?: string;
}) {
  const rows = await db
    .select({
      id: bookingsTable.id,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      clientName: bookingsTable.clientName,
    })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.barberId, params.barberId),
      eq(bookingsTable.date, params.date),
      notInArray(bookingsTable.status, [...INACTIVE_STATUSES]),
      isNull(bookingsTable.deletedAt),
      ...(params.exceptBookingId ? [ne(bookingsTable.id, params.exceptBookingId)] : []),
    ));

  const reqStart = timeToMins(params.startTime);
  const reqEnd = timeToMins(params.endTime);
  return rows.find((row) => {
    const start = timeToMins(row.startTime);
    const end = timeToMins(row.endTime);
    return reqStart < end + params.bufferMins && reqEnd + params.bufferMins > start;
  }) ?? null;
}
