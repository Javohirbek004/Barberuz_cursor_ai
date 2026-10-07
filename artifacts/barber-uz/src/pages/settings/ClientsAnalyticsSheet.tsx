import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { addDaysISO, tashkentTodayISO } from "@/lib/schedule";
import { DemoDataToggle, mockClients, useDemoAnalytics } from "@/pages/settings/demoAnalytics";

type Mode = "bugun" | "hafta" | "oy" | "sana";
type SegmentKey = "regular" | "new" | "lost";

const MODES: { key: Mode; label: string }[] = [
  { key: "bugun", label: "Bugun" },
  { key: "hafta", label: "Hafta" },
  { key: "oy", label: "Oy" },
  { key: "sana", label: "📅 Sana" },
];

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktabr", "Noyabr", "Dekabr",
];

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const SEGMENT_INFO: Record<SegmentKey, { label: string; emoji: string; text: string; badge: string }> = {
  regular: {
    label: "Doimiy",
    emoji: "🔥",
    text: "So'nggi 30 kunda 2 va undan ortiq marta xizmat olgan mijozlar.",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  },
  new: {
    label: "Yangi",
    emoji: "✨",
    text: "Birinchi marta tashrif buyurgan mijozlar.",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  },
  lost: {
    label: "Yoʻqolgan",
    emoji: "⚠️",
    text: "Oldin kelgan, lekin oxirgi 30+ kundan beri kelmagan mijozlar.",
    badge: "bg-red-500/15 text-red-300 border-red-500/25",
  },
};

export const CLIENTS_EMPTY_TEXT = "Tanlangan davrda mijozlar tahlili uchun ma'lumotlar yo'q.";

interface TopClient {
  name: string;
  visitsInPeriod: number;
  segment: SegmentKey | null;
  lastVisit: { date: string; time: string };
  daysAgo: number;
}

interface ClientsResponse {
  period: string;
  today: string;
  range?: { start: string; end: string };
  segments: { all: number; regular: number; new: number; lost: number };
  topClients: TopClient[];
}

interface DateRange {
  start: string;
  end: string;
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

async function fetchClients(range: DateRange): Promise<ClientsResponse> {
  const res = await fetch(`/api/analytics/clients?from=${range.start}&to=${range.end}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

function daysBetweenISO(from: string, to: string): number {
  const [fy = 1970, fm = 1, fd = 1] = from.split("-").map(Number);
  const [ty = 1970, tm = 1, td = 1] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function mondayOf(iso: string): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysISO(iso, -((dow + 6) % 7));
}

function monthRange(anchor: string, delta: number): DateRange {
  const [y = 1970, m = 1] = anchor.split("-").map(Number);
  const startDt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const endDt = new Date(Date.UTC(y, m + delta, 0));
  return { start: startDt.toISOString().slice(0, 10), end: endDt.toISOString().slice(0, 10) };
}

function viewedRange(mode: Mode, offset: number, custom: DateRange | null, today: string): DateRange {
  if (mode === "hafta") {
    const start = addDaysISO(mondayOf(today), offset * 7);
    // The week that contains today stops at today. Earlier weeks stay Monday–Sunday.
    return { start, end: offset === 0 ? today : addDaysISO(start, 6) };
  }
  if (mode === "oy") {
    const full = monthRange(today, offset);
    // The current month stops at today. Earlier months stay the 1st through the last day.
    return offset === 0 ? { start: full.start, end: today } : full;
  }
  if (mode === "sana" && custom) {
    const span = daysBetweenISO(custom.start, custom.end) + 1;
    const start = addDaysISO(custom.start, offset * span);
    return { start, end: addDaysISO(start, span - 1) };
  }
  const day = addDaysISO(today, offset);
  return { start: day, end: day };
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function monthTitle(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** The words next to the arrows, without the "Tanlangan vaqt:" prefix. */
export function timeRangeLabel(mode: Mode, range: DateRange, today: string): string {
  if (mode === "sana") {
    if (range.start === range.end) return dmy(range.start);
    return `${dmy(range.start)} — ${dmy(range.end)}`;
  }
  if (mode === "bugun") {
    if (range.start === today) return `Bugun, ${dmy(range.start)}`;
    if (range.start === addDaysISO(today, -1)) return `Kecha, ${dmy(range.start)}`;
    return dmy(range.start);
  }
  if (mode === "hafta") {
    const current = mondayOf(today);
    const previous = addDaysISO(current, -7);
    const inner = `${dm(range.start)} — ${dm(range.end)}`;
    if (range.start === current) return `Shu hafta: ${inner}`;
    if (range.start === previous) return `O'tgan hafta: ${inner}`;
    return inner;
  }
  const currentMonth = monthRange(today, 0).start;
  const previousMonth = monthRange(today, -1).start;
  const name = monthTitle(range.start);
  if (range.start === currentMonth) return `Shu oy: ${name}`;
  if (range.start === previousMonth) return `O'tgan oy: ${name}`;
  return name;
}

function lastVisitLabel(c: TopClient): string {
  if (c.daysAgo === 0) return `Bugun, ${c.lastVisit.time}`;
  if (c.daysAgo === 1) return `Kecha, ${c.lastVisit.time}`;
  return `${c.daysAgo} kun oldin`;
}

function SegmentBadge({ segment }: { segment: SegmentKey | null }) {
  if (!segment) return null;
  const s = SEGMENT_INFO[segment];
  return (
    <span
      data-testid={`badge-${segment}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${s.badge}`}
    >
      {s.label} {s.emoji}
    </span>
  );
}

function TimeNav({
  mode,
  label,
  forwardDisabled,
  onMode,
  onPrev,
  onNext,
}: {
  mode: Mode;
  label: string;
  forwardDisabled: boolean;
  onMode: (mode: Mode) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-4 space-y-2.5" data-testid="time-nav">
      <div
        role="tablist"
        data-testid="clients-period-tabs"
        className="relative z-10 flex flex-nowrap gap-1 bg-background/60 p-1 rounded-2xl border border-white/6"
      >
        {MODES.map(({ key, label: tabLabel }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            data-period={key}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMode(key);
          }}
          className={`min-w-0 flex-1 py-2 px-1 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              mode === key
                ? "bg-primary text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      <div
        data-time-arrows=""
        className="relative z-20 mt-1 flex items-center gap-1.5 rounded-2xl bg-card"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="time-prev"
          aria-label="Oldingi davr"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPrev();
          }}
          className="shrink-0 w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-foreground hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          data-testid="time-label"
          className="flex-1 min-w-0 text-center text-xs sm:text-sm font-medium text-foreground leading-snug"
        >
          Tanlangan vaqt: {label}
        </div>
        <button
          type="button"
          data-testid="time-next"
          aria-label="Keyingi davr"
          disabled={forwardDisabled}
          aria-disabled={forwardDisabled}
          data-disabled={forwardDisabled ? "true" : "false"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!forwardDisabled) onNext();
          }}
          className="shrink-0 w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DateRangePicker({
  today,
  initial,
  onApply,
  onCancel,
}: {
  today: string;
  initial: DateRange | null;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
}) {
  const [cursor, setCursor] = useState(() => (initial?.start ?? today).slice(0, 7));
  const [draftStart, setDraftStart] = useState<string | null>(initial?.start ?? null);
  const [draftEnd, setDraftEnd] = useState<string | null>(
    initial && initial.end !== initial.start ? initial.end : null,
  );
  // A finished selection (one day or a full range) is ready to apply.
  // The next tap starts over; the tap after that sets the other end of a range.
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [year, month] = cursor.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (firstDow + 6) % 7;

  function pick(iso: string) {
    if (iso > today) return;
    if (!awaitingEnd || !draftStart) {
      setDraftStart(iso);
      setDraftEnd(null);
      setAwaitingEnd(true);
      return;
    }
    if (iso === draftStart) return;
    if (iso < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(iso);
    } else {
      setDraftEnd(iso);
    }
    setAwaitingEnd(false);
  }

  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${cursor}-${day}`;
    }),
  ];

  return (
    <div
      data-testid="date-range-picker"
      className="mb-4 rounded-2xl border border-white/10 bg-background p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Oldingi oy"
          data-testid="picker-prev-month"
          onClick={() => setCursor(monthRange(`${cursor}-01`, -1).start.slice(0, 7))}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold">{monthTitle(`${cursor}-01`)}</div>
        <button
          type="button"
          aria-label="Keyingi oy"
          data-testid="picker-next-month"
          aria-disabled={cursor >= today.slice(0, 7)}
          onClick={() => {
            if (cursor >= today.slice(0, 7)) return;
            setCursor(monthRange(`${cursor}-01`, 1).start.slice(0, 7));
          }}
          className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${
            cursor >= today.slice(0, 7) ? "opacity-30 pointer-events-none" : ""
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} />;
          const future = iso > today;
          const selected = future
            ? "text-foreground/80"
            : iso === draftStart || iso === draftEnd
              ? "bg-primary text-black font-bold"
              : draftStart && draftEnd && iso > draftStart && iso < draftEnd
                ? "bg-primary/20 text-foreground"
                : iso === today
                  ? "border border-primary/50 text-foreground"
                  : "text-foreground/80 hover:bg-white/10";
          return (
            <button
              key={iso}
              type="button"
              data-testid="picker-day"
              data-date={iso}
              disabled={future}
              aria-disabled={future}
              onClick={() => pick(iso)}
              className={`h-8 rounded-lg text-xs ${selected} ${future ? "opacity-30 pointer-events-none" : ""}`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-muted-foreground min-h-4" data-testid="picker-draft">
        {draftStart && draftEnd && draftEnd !== draftStart
          ? `Tanlangan oraliq: ${dmy(draftStart)} — ${dmy(draftEnd)}`
          : draftStart
            ? `Tanlangan sana: ${dmy(draftStart)}`
            : ""}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid="picker-cancel"
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground"
        >
          Bekor qilish
        </button>
        <button
          type="button"
          data-testid="picker-apply"
          disabled={!draftStart}
          onClick={() => {
            if (!draftStart) return;
            const end = draftEnd && draftEnd !== draftStart ? draftEnd : draftStart;
            onApply({ start: draftStart, end });
          }}
          className="flex-1 py-2 rounded-xl bg-primary text-black text-sm font-semibold disabled:opacity-30"
        >
          Tanlash
        </button>
      </div>
    </div>
  );
}

function SegmentCard({
  segmentKey,
  title,
  count,
  tone,
  onInfo,
  infoOpen,
}: {
  segmentKey: "all" | SegmentKey;
  title: string;
  count: number;
  tone: string;
  onInfo?: () => void;
  infoOpen?: boolean;
}) {
  return (
    <div
      data-testid={`segment-${segmentKey}`}
      className={`relative rounded-2xl border p-3.5 ${tone}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">{title}</span>
        {onInfo && (
          <button
            type="button"
            aria-label={`${title} haqida ma'lumot`}
            aria-expanded={infoOpen}
            data-testid={`info-${segmentKey}`}
            onClick={onInfo}
            className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div data-testid={`count-${segmentKey}`} className="mt-1 font-display font-bold text-2xl text-foreground tabular-nums">
        {count}
      </div>
    </div>
  );
}

/** "Mijozlar tahlili" – segment counters and top clients, powered by real bookings. */
export function ClientsAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const today = tashkentTodayISO();
  const [mode, setMode] = useState<Mode>("bugun");
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cache, setCache] = useState<Record<string, ClientsResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [infoKey, setInfoKey] = useState<SegmentKey | null>(null);
  const infoWrapRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const demo = useDemoAnalytics();

  const range = useMemo(() => viewedRange(mode, offset, custom, today), [mode, offset, custom, today]);
  const rangeKey = `${range.start}|${range.end}`;
  const forwardDisabled = range.end >= today;
  const label = timeRangeLabel(mode, range, today);

  useEffect(() => {
    if (demo.on) {
      setCache((c) => ({ ...c, [rangeKey]: mockClients(range, today) }));
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchClients(range)
      .then((res) => {
        if (!cancelled) setCache((c) => ({ ...c, [rangeKey]: res }));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeKey, range.start, range.end, demo.on, today]);

  useEffect(() => {
    if (!infoKey && !pickerOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const el = target instanceof Element ? target : target.parentElement;
      if (infoKey && infoWrapRef.current && !infoWrapRef.current.contains(target)) setInfoKey(null);
      if (pickerOpen && pickerRef.current && el && !pickerRef.current.contains(el)) {
        if (!el.closest("[data-period='sana']") && !el.closest("[data-time-arrows]")) setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [infoKey, pickerOpen]);

  const data = cache[rangeKey];
  const toggleInfo = (k: SegmentKey) => setInfoKey((cur) => (cur === k ? null : k));

  function chooseMode(next: Mode) {
    setInfoKey(null);
    if (next === "sana") {
      setCustom((current) => current ?? range);
      setMode("sana");
      setOffset(0);
      setPickerOpen(true);
      return;
    }
    setPickerOpen(false);
    setMode(next);
    setOffset(0);
  }

  return (
    <BottomSheet title="Mijozlar tahlili" onClose={onClose}>
      {demo.available && <DemoDataToggle on={demo.on} toggle={demo.toggle} />}
      <TimeNav
        mode={pickerOpen || mode === "sana" ? "sana" : mode}
        label={label}
        forwardDisabled={forwardDisabled}
        onMode={chooseMode}
        onPrev={() => setOffset((n) => n - 1)}
        onNext={() => setOffset((n) => (n >= 0 && mode !== "sana" ? n : n + 1))}
      />

      {pickerOpen && (
        <div ref={pickerRef}>
          <p data-testid="picker-hint" className="text-center text-xs font-medium text-[#F59E0B] mb-2 px-2">
            Bitta kunni tanlash uchun ustiga bosing yoki oraliqni belgilang
          </p>
          <DateRangePicker
            today={today}
            initial={mode === "sana" ? range : null}
            onCancel={() => setPickerOpen(false)}
            onApply={(picked) => {
              setCustom(picked);
              setMode("sana");
              setOffset(0);
              setPickerOpen(false);
              setInfoKey(null);
            }}
          />
        </div>
      )}

      {!data && loading && (
        <div className="space-y-3" data-testid="clients-loading">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      )}

      {!data && !loading && error && (
        <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
      )}

      {data && data.segments.all === 0 && (
        <div
          data-testid="clients-empty"
          className="text-center py-12 px-4 text-sm text-muted-foreground"
        >
          {CLIENTS_EMPTY_TEXT}
        </div>
      )}

      {data && data.segments.all > 0 && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
          <div ref={infoWrapRef}>
            <div className="grid grid-cols-2 gap-3">
              <SegmentCard
                segmentKey="all"
                title="Hammasi"
                count={data.segments.all}
                tone="bg-white/4 border-white/10"
              />
              <SegmentCard
                segmentKey="regular"
                title="Doimiy 🔥"
                count={data.segments.regular}
                tone="bg-orange-500/8 border-orange-500/20"
                onInfo={() => toggleInfo("regular")}
                infoOpen={infoKey === "regular"}
              />
              <SegmentCard
                segmentKey="new"
                title="Yangi ✨"
                count={data.segments.new}
                tone="bg-sky-500/8 border-sky-500/20"
                onInfo={() => toggleInfo("new")}
                infoOpen={infoKey === "new"}
              />
              <SegmentCard
                segmentKey="lost"
                title="Yoʻqolgan ⚠️"
                count={data.segments.lost}
                tone="bg-red-500/8 border-red-500/20"
                onInfo={() => toggleInfo("lost")}
                infoOpen={infoKey === "lost"}
              />
            </div>

            {infoKey && (
              <div
                role="note"
                data-testid="segment-info"
                className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-background px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
              >
                <span className="flex-1">
                  <b>
                    {SEGMENT_INFO[infoKey].label} {SEGMENT_INFO[infoKey].emoji}:
                  </b>{" "}
                  <span data-testid="segment-info-text">{SEGMENT_INFO[infoKey].text}</span>
                </span>
                <button
                  type="button"
                  aria-label="Yopish"
                  onClick={() => setInfoKey(null)}
                  className="shrink-0 w-5 h-5 -mr-1 -mt-0.5 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Top mijozlar
            </div>
            <div className="space-y-2" data-testid="top-clients">
              {data.topClients.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  data-testid="top-client"
                  className="flex items-center gap-3 py-3 px-3.5 rounded-2xl bg-white/3 border border-white/6"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
                      <SegmentBadge segment={c.segment} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.visitsInPeriod} marta · Oxirgi tashrif: {lastVisitLabel(c)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
