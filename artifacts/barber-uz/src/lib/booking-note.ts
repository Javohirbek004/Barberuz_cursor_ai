import type { Booking } from "@workspace/api-client-react";

export type BookingWithClientNote = Booking & { clientNotes?: string | null };

export function parseBookingNotes(raw: string | null | undefined): { phone: string | null; userNotes: string } {
  if (!raw?.trim()) return { phone: null, userNotes: "" };
  const lines = raw.split("\n");
  if (lines[0]?.startsWith("Tel: ")) {
    return {
      phone: lines[0].slice(5).trim() || null,
      userNotes: lines.slice(1).join("\n").trim(),
    };
  }
  return { phone: null, userNotes: raw.trim() };
}

/** Client-level Izoh: prefer clients.notes, fall back to text stored on the booking. */
export function noteFromBooking(booking: BookingWithClientNote): string {
  const fromClient = booking.clientNotes?.trim();
  if (fromClient) return fromClient;
  return parseBookingNotes(booking.notes ?? null).userNotes;
}
