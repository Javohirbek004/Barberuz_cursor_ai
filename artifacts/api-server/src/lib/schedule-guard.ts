const DAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

type DayKey = (typeof DAY_KEYS)[number];

function toMins(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parseClock(value: unknown, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function weekdayKey(isoDate: string): DayKey {
  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "monday";
}

function tashkentNow(isoDate: string): { today: string; mins: number } {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  void isoDate;
  return { today, mins: hour * 60 + minute };
}

export function slotOutsideWorkingHours(params: {
  isoDate: string;
  startTime: string;
  durationMins: number;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  scheduleJson: string | null;
  lunchBreakEnabled: boolean;
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
}): string | null {
  const globalStart = parseClock(params.workingHoursStart, "09:00");
  const globalEnd = parseClock(params.workingHoursEnd, "20:00");
  let dayEnabled = true;
  let dayStart = globalStart;
  let dayEnd = globalEnd;

  try {
    const parsed = params.scheduleJson ? JSON.parse(params.scheduleJson) as Record<string, unknown> : null;
    if (parsed && typeof parsed === "object") {
      const key = weekdayKey(params.isoDate);
      const entry = parsed[key];
      if (entry && typeof entry === "object") {
        const e = entry as { enabled?: unknown; start?: unknown; end?: unknown };
        dayEnabled = Boolean(e.enabled);
        dayStart = parseClock(e.start, globalStart);
        dayEnd = parseClock(e.end, globalEnd);
      } else if (Array.isArray(parsed.workDays)) {
        const short: Record<DayKey, string> = {
          monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
          friday: "fri", saturday: "sat", sunday: "sun",
        };
        dayEnabled = parsed.workDays.includes(short[key]);
      }
    }
  } catch {
    // Fall back to the summary hours.
  }

  if (!dayEnabled) return "Bu kunda ish kuni emas";

  const start = toMins(params.startTime);
  const end = start + Math.max(params.durationMins, 1);
  const open = toMins(dayStart);
  const close = toMins(dayEnd);
  if (start < open || end > close) return "Tanlangan vaqt ish vaqtidan tashqarida";

  if (params.lunchBreakEnabled && params.lunchBreakStart && params.lunchBreakEnd) {
    const lunchStart = toMins(parseClock(params.lunchBreakStart, "13:00"));
    const lunchEnd = toMins(parseClock(params.lunchBreakEnd, "14:00"));
    if (start < lunchEnd && end > lunchStart) return "Tanlangan vaqt tushlik tanaffusiga to'g'ri keladi";
  }

  const clock = tashkentNow(params.isoDate);
  if (params.isoDate < clock.today) return "O'tgan sanaga bron qilib bo'lmaydi";
  if (params.isoDate === clock.today && start <= clock.mins) return "O'tgan vaqtga bron qilib bo'lmaydi";

  return null;
}
