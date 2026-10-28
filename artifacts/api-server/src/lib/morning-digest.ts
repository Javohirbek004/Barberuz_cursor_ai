/**
 * Morning schedule text for the barber. Clients never receive this message.
 * Times and the date label are already in Uzbekistan time.
 */

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const DIVIDER = "━".repeat(19);

export type MorningBooking = {
  time: string;
  clientName: string;
  serviceName: string | null;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function uzDateLabel(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day}-${MONTHS[(month || 1) - 1]}`;
}

export function clockTime(raw: string): string {
  const [h = "0", m = "0"] = raw.split(":");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`.slice(0, 5);
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type DayKey = (typeof DAY_KEYS)[number];
const SHORT_DAY: Record<DayKey, string> = {
  sunday: "sun", monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat",
};

function weekdayKey(isoDate: string): DayKey {
  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "monday";
}

function parseClock(value: unknown, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** That day's opening time, or null when the barber marked the day closed. */
export function dayWorkStartMinutes(
  isoDate: string,
  workingHoursStart: string | null,
  scheduleJson: string | null,
): number | null {
  const globalStart = parseClock(workingHoursStart, "09:00");
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = scheduleJson ? JSON.parse(scheduleJson) as Record<string, unknown> : null;
  } catch {
    parsed = null;
  }

  const key = weekdayKey(isoDate);
  const grid = !!parsed && DAY_KEYS.some((day) => parsed?.[day] && typeof parsed[day] === "object");
  const workDays = parsed && Array.isArray(parsed.workDays)
    ? parsed.workDays.filter((day): day is string => typeof day === "string")
    : null;

  let enabled = true;
  let start = globalStart;
  if (grid && parsed) {
    const entry = parsed[key];
    if (entry && typeof entry === "object") {
      const day = entry as { enabled?: unknown; start?: unknown };
      enabled = Boolean(day.enabled);
      start = parseClock(day.start, globalStart);
    } else {
      enabled = workDays ? workDays.includes(SHORT_DAY[key]) : false;
    }
  } else if (workDays && workDays.length > 0) {
    enabled = workDays.includes(SHORT_DAY[key]);
  }

  return enabled ? toMinutes(start) : null;
}

/** The check runs every minute, so the send stays open for five minutes. */
export function isHourBeforeWork(nowMinutes: number, workStartMinutes: number): boolean {
  const sendAt = Math.max(0, workStartMinutes - 60);
  return nowMinutes >= sendAt && nowMinutes <= sendAt + 4;
}

export function buildBarberMorningSummary(dateLabel: string, bookings: MorningBooking[]): string {
  if (bookings.length === 0) {
    return "☀️ Xayrli tong!\n\n🌿 Bugun uchun hech qanday bron yo‘q. Yaxshilab dam oling!";
  }

  const lines = [...bookings]
    .sort((a, b) => clockTime(a.time).localeCompare(clockTime(b.time)))
    .map((booking) => {
      const name = esc(booking.clientName.trim() || "Mijoz");
      const service = booking.serviceName?.trim();
      const servicePart = service ? ` (${esc(service)})` : "";
      return `⏰ ${clockTime(booking.time)} — ${name}${servicePart}`;
    })
    .join("\n");

  return [
    `☀️ Xayrli tong! Bugungi (${esc(dateLabel)}) bronlar jadvali:`,
    "",
    DIVIDER,
    lines,
    DIVIDER,
    "",
    `<b>Bugun jami ${bookings.length} ta bron mavjud. Omad tilaymiz! 💈</b>`,
  ].join("\n");
}
