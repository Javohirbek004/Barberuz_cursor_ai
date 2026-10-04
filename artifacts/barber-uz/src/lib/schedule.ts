/**
 * Single source of truth for a barber's weekly schedule, lunch and buffer time.
 *
 * Stored on the user row:
 *   scheduleJson        – JSON text. New writes contain BOTH:
 *                           workDays: ["mon","tue",...]            (legacy list, still read by old code)
 *                           monday..sunday: {enabled,start,end}    (per-day hours)
 *                         Older rows may contain only one of the two shapes; both are still readable.
 *   workingHoursStart/End – summary hours (earliest start / latest end of the open days).
 *   lunchBreak*         – one lunch window shared by all days.
 *   bufferTime          – minutes of preparation gap after every service (0, 5, 10, 15, 20).
 *
 * Used by: settings/profile, settings/page (Mening sahifam), the (+) booking modal,
 * the public booking page and the dashboard.
 */

export type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type ShortDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: DayKey[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const SHORT_BY_DAY: Record<DayKey, ShortDayKey> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
};

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export type WeekSchedule = Record<DayKey, DaySchedule>;

export interface ScheduleSource {
  scheduleJson?: string | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
}

export interface Interval {
  start: number;
  end: number;
}

export const BUFFER_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "0 daqiqa (Tanaffussiz)" },
  { value: 5, label: "5 daqiqa" },
  { value: 10, label: "10 daqiqa (Tavsiya)" },
  { value: 15, label: "15 daqiqa" },
  { value: 20, label: "20 daqiqa" },
];

export const DEFAULT_BUFFER_MINUTES = 10;
export const DEFAULT_WORK_START = "09:00";
export const DEFAULT_WORK_END = "20:00";
const SLOT_STEP_MINUTES = 30;

// ── Time helpers ───────────────────────────────────────────────────────────────

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidHHMM(value: unknown): value is string {
  return typeof value === "string" && HHMM.test(value.trim());
}

export function toMins(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtMins(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function cleanHHMM(value: unknown, fallback: string): string {
  return isValidHHMM(value) ? fmtMins(toMins(value.trim())) : fallback;
}

const TASHKENT_TZ = "Asia/Tashkent";

/** Today's calendar date in Tashkent (YYYY-MM-DD), regardless of the device timezone. */
export function tashkentTodayISO(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: TASHKENT_TZ });
}

/** Current wall-clock minutes since midnight in Tashkent. */
export function tashkentNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TASHKENT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** ISO date + N days (pure calendar arithmetic, timezone-free). */
export function addDaysISO(iso: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Weekday of an ISO date (YYYY-MM-DD), independent of the device timezone. */
export function weekdayKeyForDate(iso: string): DayKey {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const index = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const order: DayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return order[index] ?? "monday";
}

export function normalizeBuffer(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && BUFFER_OPTIONS.some((o) => o.value === n)
    ? n
    : DEFAULT_BUFFER_MINUTES;
}

// ── Reading / writing the stored schedule ─────────────────────────────────────

function parseObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasWeekGrid(obj: Record<string, unknown> | null): boolean {
  return !!obj && DAY_KEYS.some((k) => !!obj[k] && typeof obj[k] === "object");
}

function readWorkDays(obj: Record<string, unknown> | null): ShortDayKey[] | null {
  if (!obj || !Array.isArray(obj.workDays)) return null;
  return obj.workDays.filter((d): d is ShortDayKey => typeof d === "string") as ShortDayKey[];
}

/** True once a barber has saved any day selection (either shape). */
export function hasSavedSchedule(raw: string | null | undefined): boolean {
  const obj = parseObject(raw);
  if (hasWeekGrid(obj)) return true;
  const days = readWorkDays(obj);
  return !!days && days.length > 0;
}

/**
 * Effective schedule for each weekday.
 * Nothing saved yet → every day is open with the global hours (matches the previous behaviour).
 */
export function readWeekSchedule(src: ScheduleSource): WeekSchedule {
  const globalStart = cleanHHMM(src.workingHoursStart, DEFAULT_WORK_START);
  const globalEnd = cleanHHMM(src.workingHoursEnd, DEFAULT_WORK_END);
  const obj = parseObject(src.scheduleJson);
  const grid = hasWeekGrid(obj);
  const days = readWorkDays(obj);
  const result = {} as WeekSchedule;

  for (const key of DAY_KEYS) {
    const short = SHORT_BY_DAY[key];
    const entry = grid && obj ? obj[key] : null;
    if (entry && typeof entry === "object") {
      const e = entry as { enabled?: unknown; start?: unknown; end?: unknown };
      result[key] = {
        enabled: Boolean(e.enabled),
        start: cleanHHMM(e.start, globalStart),
        end: cleanHHMM(e.end, globalEnd),
      };
    } else if (grid) {
      result[key] = { enabled: days ? days.includes(short) : false, start: globalStart, end: globalEnd };
    } else if (days && days.length > 0) {
      result[key] = { enabled: days.includes(short), start: globalStart, end: globalEnd };
    } else {
      result[key] = { enabled: true, start: globalStart, end: globalEnd };
    }
  }
  return result;
}

/** Short keys of the open days, in Monday → Sunday order. */
export function openDaysShort(week: WeekSchedule): ShortDayKey[] {
  return DAY_KEYS.filter((k) => week[k].enabled).map((k) => SHORT_BY_DAY[k]);
}

/** JSON written to scheduleJson: per-day grid plus the legacy workDays list. */
export function writeScheduleJson(week: WeekSchedule): string {
  return JSON.stringify({ workDays: openDaysShort(week), ...week });
}

/** Earliest start / latest end among open days (falls back to the defaults). */
export function summarizeHours(week: WeekSchedule): { start: string; end: string } {
  const open = DAY_KEYS.filter((k) => week[k].enabled);
  if (open.length === 0) return { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END };
  const starts = open.map((k) => toMins(week[k].start));
  const ends = open.map((k) => toMins(week[k].end));
  return { start: fmtMins(Math.min(...starts)), end: fmtMins(Math.max(...ends)) };
}

/** Hours for one calendar date (open flag + start/end). */
export function resolveDaySchedule(src: ScheduleSource, isoDate: string): DaySchedule {
  return readWeekSchedule(src)[weekdayKeyForDate(isoDate)];
}

export function isWorkingDate(src: ScheduleSource, isoDate: string): boolean {
  return resolveDaySchedule(src, isoDate).enabled;
}

/** Open weekdays as short keys (used by the "Mening sahifam" day chips). */
export function readOpenDaysShort(raw: string | null | undefined): ShortDayKey[] {
  const obj = parseObject(raw);
  if (hasWeekGrid(obj)) {
    return DAY_KEYS.filter((k) => {
      const e = obj?.[k];
      return !!e && typeof e === "object" && Boolean((e as { enabled?: unknown }).enabled);
    }).map((k) => SHORT_BY_DAY[k]);
  }
  return readWorkDays(obj) ?? [];
}

/**
 * Save-side merge for "Mening sahifam": keeps each day's own hours, applies the day chips,
 * and only overwrites hours when the single start/end pair was edited.
 */
export function mergeScheduleFromDayChips(args: {
  currentJson: string | null | undefined;
  workDays: string[];
  workStart: string;
  workEnd: string;
  baseStart: string;
  baseEnd: string;
}): string {
  const { currentJson, workDays, workStart, workEnd, baseStart, baseEnd } = args;
  const existing = parseObject(currentJson);
  // Nothing was ever configured and no day is picked: keep the legacy "every day open" meaning.
  if (!hasWeekGrid(existing) && workDays.length === 0) {
    return JSON.stringify({ workDays: [] });
  }
  const week = readWeekSchedule({
    scheduleJson: currentJson,
    workingHoursStart: baseStart,
    workingHoursEnd: baseEnd,
  });
  const hoursEdited = workStart !== baseStart || workEnd !== baseEnd;
  for (const key of DAY_KEYS) {
    const open = workDays.includes(SHORT_BY_DAY[key]);
    week[key] = {
      enabled: open,
      start: open && hoursEdited && isValidHHMM(workStart) ? cleanHHMM(workStart, week[key].start) : week[key].start,
      end: open && hoursEdited && isValidHHMM(workEnd) ? cleanHHMM(workEnd, week[key].end) : week[key].end,
    };
  }
  return writeScheduleJson(week);
}

// ── Smart anchor slots ─────────────────────────────────────────────────────────

export interface SmartSlotInput {
  /** Service length in minutes (sum of selected services). */
  duration: number;
  /** Preparation gap kept after every service. */
  buffer: number;
  /** Earliest start (minutes) and the time the service must be finished by. */
  rangeStart: number;
  rangeEnd: number;
  /** Existing bookings as real service intervals (buffer is added here). */
  bookings: Interval[];
  /** Fixed blocks such as lunch (no buffer needed around them). */
  fixedBreaks?: Interval[];
  /** Today only: hide slots that start at or before this minute. */
  nowMins?: number | null;
  step?: number;
}

/**
 * Slot End = Slot Start + Duration + Buffer.
 * Free windows are measured after removing lunch and every booking (with its buffer on both sides);
 * the first slot of each window is anchored to the window start (e.g. right after the previous
 * booking's buffer), the following ones step by 30 minutes.
 */
export function generateSmartSlots(input: SmartSlotInput): string[] {
  const duration = Math.max(Math.round(input.duration), 1);
  const buffer = Math.max(Math.round(input.buffer), 0);
  const step = input.step ?? SLOT_STEP_MINUTES;
  const { rangeStart, rangeEnd } = input;
  if (!(rangeEnd > rangeStart)) return [];

  const blocked: Interval[] = [
    ...(input.fixedBreaks ?? []),
    ...input.bookings.map((b) => ({ start: b.start - buffer, end: b.end + buffer })),
  ]
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const windows: Interval[] = [];
  let cursor = rangeStart;
  for (const block of blocked) {
    if (block.start > cursor) {
      windows.push({ start: cursor, end: Math.min(block.start, rangeEnd) });
    }
    cursor = Math.max(cursor, block.end);
    if (cursor >= rangeEnd) break;
  }
  if (cursor < rangeEnd) windows.push({ start: cursor, end: rangeEnd });

  const slots: string[] = [];
  for (const w of windows) {
    for (let t = w.start; t + duration <= w.end; t += step) {
      if (input.nowMins != null && t <= input.nowMins) continue;
      slots.push(fmtMins(t));
    }
  }
  return slots;
}

/** Turns "HH:MM" start/end strings of existing bookings into minute intervals. */
export function bookingsToIntervals(
  bookings: ReadonlyArray<{ startTime: string; endTime: string }>,
): Interval[] {
  return bookings
    .filter((b) => isValidHHMM(b.startTime) && isValidHHMM(b.endTime))
    .map((b) => ({ start: toMins(b.startTime), end: toMins(b.endTime) }));
}

export function lunchInterval(src: {
  lunchBreakEnabled?: boolean | null;
  lunchBreakStart?: string | null;
  lunchBreakEnd?: string | null;
}): Interval[] {
  if (!src.lunchBreakEnabled || !isValidHHMM(src.lunchBreakStart) || !isValidHHMM(src.lunchBreakEnd)) {
    return [];
  }
  const start = toMins(src.lunchBreakStart);
  const end = toMins(src.lunchBreakEnd);
  return end > start ? [{ start, end }] : [];
}

// ── Day-part filter ───────────────────────────────────────────────────────────

export type SlotPeriod = "all" | "morning" | "afternoon" | "evening";

export const SLOT_PERIODS: ReadonlyArray<{ value: SlotPeriod; label: string }> = [
  { value: "all", label: "Barchasi" },
  { value: "morning", label: "🌅 Ertalab" },
  { value: "afternoon", label: "☀️ Tushdan keyin" },
  { value: "evening", label: "🌙 Kechki" },
];

export function filterSlotsByPeriod(slots: string[], period: SlotPeriod): string[] {
  if (period === "all") return slots;
  return slots.filter((s) => {
    const t = toMins(s);
    if (period === "morning") return t >= 6 * 60 && t < 12 * 60;
    if (period === "afternoon") return t >= 12 * 60 && t < 17 * 60;
    return t >= 17 * 60 && t <= 23 * 60 + 59;
  });
}
