import { bookingsTable } from "@workspace/db";

export type BookingRow = typeof bookingsTable.$inferSelect;

export interface V1Booking {
  id: string;
  barber_id: string;
  user_id: string | null;   // clientId alias — the person who booked
  client_name: string;
  service_id: string | null;
  service_name: string | null;
  booking_time: string;     // ISO 8601 (derived from date + start_time)
  date: string;             // YYYY-MM-DD
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  price: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Derive ISO 8601 booking_time from date + start_time ("HH:MM") */
export function deriveBookingTime(date: string, startTime: string): string {
  return new Date(`${date}T${startTime}:00.000Z`).toISOString();
}

export function formatBooking(row: BookingRow): V1Booking {
  const bookingTime = row.bookingTime
    ? row.bookingTime.toISOString()
    : deriveBookingTime(row.date, row.startTime);

  return {
    id:           row.id,
    barber_id:    row.barberId,
    user_id:      row.clientId ?? null,
    client_name:  row.clientName,
    service_id:   row.serviceId ?? null,
    service_name: row.serviceName ?? null,
    booking_time: bookingTime,
    date:         row.date,
    start_time:   row.startTime,
    end_time:     row.endTime,
    price:        row.price,
    status:       row.status as V1Booking["status"],
    notes:        row.notes ?? null,
    created_at:   row.createdAt.toISOString(),
    updated_at:   row.updatedAt.toISOString(),
    deleted_at:   row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}
