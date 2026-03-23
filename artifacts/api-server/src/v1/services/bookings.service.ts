import { db, bookingsTable } from "@workspace/db";
import { eq, isNull, and, desc } from "drizzle-orm";
import { BookingRow, deriveBookingTime } from "../models/booking.model";

export interface CreateBookingInput {
  barber_id: string;
  client_name: string;
  service_id?: string | null;
  service_name?: string | null;
  booking_time: string;    // ISO 8601 — we derive date/start_time from this
  end_time?: string;
  price?: string;
  status?: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string | null;
  client_id?: string | null;
}

export interface UpdateBookingInput {
  status?: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string | null;
  price?: string;
  booking_time?: string;
  deleted_at?: Date | null;
}

/** Parse ISO 8601 to YYYY-MM-DD + HH:MM */
function parseBookingTime(iso: string): { date: string; startTime: string } {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);                    // YYYY-MM-DD
  const startTime = d.toISOString().slice(11, 16);              // HH:MM
  return { date, startTime };
}

/** Add 30 minutes to HH:MM → HH:MM */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** List active bookings, optionally filtered */
export async function listBookings(filters?: {
  barber_id?: string;
  status?: string;
}): Promise<BookingRow[]> {
  const conditions = [isNull(bookingsTable.deletedAt)];
  if (filters?.barber_id) conditions.push(eq(bookingsTable.barberId, filters.barber_id));
  if (filters?.status)    conditions.push(eq(bookingsTable.status, filters.status as BookingRow["status"]));

  return db
    .select()
    .from(bookingsTable)
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.createdAt));
}

/** Get a single booking by UUID */
export async function getBookingById(id: string): Promise<BookingRow | null> {
  const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  return row ?? null;
}

/** Create a booking */
export async function createBooking(input: CreateBookingInput): Promise<BookingRow> {
  const { date, startTime } = parseBookingTime(input.booking_time);
  const endTime = input.end_time ?? addMinutes(startTime, 30);

  const [row] = await db
    .insert(bookingsTable)
    .values({
      barberId:    input.barber_id,
      clientId:    input.client_id ?? null,
      clientName:  input.client_name,
      serviceId:   input.service_id ?? null,
      serviceName: input.service_name ?? null,
      date,
      startTime,
      endTime,
      bookingTime: new Date(input.booking_time),
      price:       input.price ?? "0",
      status:      input.status ?? "confirmed",
      notes:       input.notes ?? null,
    })
    .returning();
  return row!;
}

/** Patch a booking */
export async function updateBooking(id: string, input: UpdateBookingInput): Promise<BookingRow | null> {
  const updates: Partial<typeof bookingsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.status !== undefined)   updates.status    = input.status;
  if (input.notes !== undefined)    updates.notes     = input.notes;
  if (input.price !== undefined)    updates.price     = input.price;
  if (input.deleted_at !== undefined) updates.deletedAt = input.deleted_at;

  if (input.booking_time) {
    const { date, startTime } = parseBookingTime(input.booking_time);
    updates.date        = date;
    updates.startTime   = startTime;
    updates.bookingTime = new Date(input.booking_time);
  }

  const [row] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, id))
    .returning();
  return row ?? null;
}

/** Export ALL bookings (including soft-deleted) */
export async function exportAllBookings(): Promise<BookingRow[]> {
  return db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);
}

/** Upsert booking during import */
export async function upsertBooking(row: Record<string, unknown>): Promise<void> {
  const date      = (row.date as string) ?? parseBookingTime(row.booking_time as string).date;
  const startTime = (row.start_time as string) ?? parseBookingTime(row.booking_time as string).startTime;
  const endTime   = (row.end_time as string) ?? addMinutes(startTime, 30);

  await db
    .insert(bookingsTable)
    .values({
      id:          row.id as string,
      barberId:    row.barber_id as string,
      clientId:    (row.user_id ?? row.client_id as string | null) ?? null,
      clientName:  (row.client_name as string) ?? "Unknown",
      serviceId:   (row.service_id as string | null) ?? null,
      serviceName: (row.service_name as string | null) ?? null,
      date,
      startTime,
      endTime,
      bookingTime: row.booking_time ? new Date(row.booking_time as string) : null,
      price:       String(row.price ?? "0"),
      status:      (row.status as BookingRow["status"]) ?? "confirmed",
      notes:       (row.notes as string | null) ?? null,
      createdAt:   row.created_at ? new Date(row.created_at as string) : new Date(),
      updatedAt:   row.updated_at ? new Date(row.updated_at as string) : new Date(),
      deletedAt:   row.deleted_at ? new Date(row.deleted_at as string) : null,
    })
    .onConflictDoUpdate({
      target: bookingsTable.id,
      set: {
        status:    (row.status as BookingRow["status"]) ?? "confirmed",
        updatedAt: new Date(),
      },
    });
}

function addMinutesHelper(time: string, mins: number): string {
  return addMinutes(time, mins);
}
