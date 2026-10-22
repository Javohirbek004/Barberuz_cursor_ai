const GRACE_MS = 15 * 60 * 1000;

export function tashkentClock(now = new Date()): { date: string; mins: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    mins: Number(pick("hour")) * 60 + Number(pick("minute")),
  };
}

/** Calendar day only, even if the server sent a full timestamp. */
export function bookingDay(date: string): string {
  const match = String(date).match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? String(date).slice(0, 10);
}

const TURKEY_TZ = "Europe/Istanbul";

/** Turkey's calendar day and clock, wherever the phone happens to be. */
export function turkeyClock(now = new Date()): { date: string; mins: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TURKEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    mins: Number(pick("hour")) * 60 + Number(pick("minute")),
  };
}

export function turkeyToday(now = new Date()): string {
  return turkeyClock(now).date;
}

/** 11:00 on the booking means 11:00 in Turkey. */
export function bookingStartMs(date: string, startTime: string): number {
  const day = bookingDay(date);
  const [hour = "0", minute = "0"] = String(startTime).slice(0, 5).split(":");
  return new Date(`${day}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+03:00`).getTime();
}

/** A confirmed visit stays in the upcoming list for 15 minutes after its start. */
export function isElapsedBooking(date: string, startTime: string, now = Date.now()): boolean {
  return bookingStartMs(date, startTime) < now - GRACE_MS;
}

const MONTH_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

function shiftDay(iso: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Kecha" for yesterday, otherwise "8-okt". Used on cards from earlier days. */
export function reviewDayLabel(date: string, today: string): string {
  if (date === shiftDay(today, -1)) return "Kecha";
  const [, m = 1, d = 1] = date.split("-").map(Number);
  return `${d}-${MONTH_SHORT[m - 1] ?? ""}`;
}

export function isOpenBooking(status: string): boolean {
  const value = status.trim().toLowerCase();
  return value === "confirmed" || value === "pending";
}

export type BookingVisualKey = "confirmed" | "pending_action" | "completed" | "no_show" | "cancelled";

/**
 * The five labels the barber sees. A confirmed visit whose time has passed
 * is shown as waiting for Keldi / Kelmadi; the saved status stays confirmed.
 */
export function bookingVisualStatus(
  booking: { status: string; date: string; startTime: string },
  now = Date.now(),
): { key: BookingVisualKey; label: string } {
  const status = booking.status.trim().toLowerCase();
  if (status === "completed") return { key: "completed", label: "Tugallangan" };
  if (status === "no_show") return { key: "no_show", label: "Kelmadi" };
  if (status === "cancelled" || status === "auto_cancelled") return { key: "cancelled", label: "Bekor qilingan" };
  const stillOpen = status === "confirmed" || status === "pending";
  if (stillOpen && bookingStartMs(booking.date, booking.startTime) < now) {
    return { key: "pending_action", label: "Yakunlash kutilmoqda" };
  }
  return { key: "confirmed", label: "Tasdiqlangan" };
}
