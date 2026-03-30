/**
 * bookingStore — simple in-memory store for newly added bookings.
 * Replaces the need for a full state management library.
 * Bookings are kept for the lifetime of the session (page reload resets).
 */

export interface AddedBooking {
  id: string;
  time: string;
  client: string;
  phone: string;
  service: string;
  status: "confirmed";
  barber?: string;
}

type Listener = () => void;

let bookings: AddedBooking[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const bookingStore = {
  add(booking: Omit<AddedBooking, "id" | "status">) {
    bookings = [
      ...bookings,
      { ...booking, id: `added-${Date.now()}`, status: "confirmed" },
    ];
    notify();
  },

  getAll(): AddedBooking[] {
    return bookings;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
