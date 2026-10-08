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

export function bookingStartMs(date: string, startTime: string): number {
  return new Date(`${date}T${startTime.slice(0, 5)}:00+05:00`).getTime();
}

/** A confirmed visit stays in the upcoming list for 15 minutes after its start. */
export function isElapsedBooking(date: string, startTime: string, now = Date.now()): boolean {
  return bookingStartMs(date, startTime) < now - GRACE_MS;
}

export function isOpenBooking(status: string): boolean {
  return status === "confirmed" || status === "pending";
}
