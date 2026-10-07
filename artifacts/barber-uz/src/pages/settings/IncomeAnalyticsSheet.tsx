import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { addDaysISO, tashkentTodayISO } from "@/lib/schedule";
import { DemoDataToggle, mockIncome, useDemoAnalytics } from "@/pages/settings/demoAnalytics";

type Mode = "bugun" | "hafta" | "oy" | "sana";

const MODES: { key: Mode; label: string }[] = [
  { key: "bugun", label: "Bugun" },
  { key: "hafta", label: "Shu hafta" },
  { key: "oy", label: "Oy" },
  { key: "sana", label: "📅 Sana" },
];

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const COMPARE: Record<Mode, string> = {
  bugun: "kechaga nisbatan",
  hafta: "o'tgan haftaga nisbatan",
  oy: "o'tgan oyga nisbatan",
  sana: "oldingi davrga nisbatan",
};

export const INCOME_EMPTY_TEXT = "Ushbu davrda tugatilgan bronlar mavjud emas";

interface DateRange { start: string; end: string }

interface IncomeBooking {
  id: string;
  clientName: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
}

interface IncomeResponse {
  revenue: number;
  completedCount: number;
  averageCheck: number;
  revChange: number;
  services: { name: string; revenue: number; percent: number }[];
  bookings: IncomeBooking[];
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

async function fetchIncome(range: DateRange): Promise<IncomeResponse> {
  const res = await fetch(`/api/analytics/income?from=${range.start}&to=${range.end}`, {
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
    return { start, end: offset === 0 ? today : addDaysISO(start, 6) };
  }
  if (mode === "oy") {
    const full = monthRange(today, offset);
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

function timeLabel(mode: Mode, range: DateRange, today: string): string {
  if (mode === "sana") {
    return range.start === range.end ? dmy(range.start) : `${dmy(range.start)} — ${dmy(range.end)}`;
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
  const name = monthTitle(range.start);
  if (range.start === monthRange(today, 0).start) return `Shu oy: ${name}`;
  if (range.start === monthRange(today, -1).start) return `O'tgan oy: ${name}`;
  return name;
}

function soom(n: number): string {
  return `${Math.round(n).toLocaleString("uz-UZ")} so'm`;
}

function dayHeader(iso: string, today: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const label = `${d}-${MONTHS[(m ?? 1) - 1]}`;
  if (iso === today) return `Bugun, ${label}`;
  if (iso === addDaysISO(today, -1)) return `Kecha, ${label}`;
  return y ? label : iso;
}

function TimeNav({
  mode, label, forwardDisabled, onMode, onPrev, onNext,
}: {
  mode: Mode;
  label: string;
  forwardDisabled: boolean;
  onMode: (m: Mode) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-3 space-y-2.5" data-testid="income-time-nav">
      <div role="tablist" data-testid="income-period-tabs" className="relative z-10 flex flex-nowrap gap-1 bg-background/60 p-1 rounded-2xl border border-white/6">
        {MODES.map(({ key, label: tab }) => (
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
            className={`min-w-0 flex-1 py-2 px-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              mode === key ? "bg-[#F59E0B] text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
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
          data-testid="income-prev"
          aria-label="Oldingi davr"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPrev();
          }}
          className="shrink-0 w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div data-testid="income-time-label" className="flex-1 min-w-0 text-center text-xs sm:text-sm font-medium leading-snug">
          Tanlangan vaqt: {label}
        </div>
        <button
          type="button"
          data-testid="income-next"
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
          className="shrink-0 w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DateRangePicker({
  today, initial, onApply, onCancel,
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
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [year, month] = cursor.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = ((new Date(Date.UTC(year, month - 1, 1)).getUTCDay()) + 6) % 7;
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${cursor}-${String(i + 1).padStart(2, "0")}`),
  ];

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

  return (
    <div data-testid="income-date-picker" className="mb-4 rounded-2xl border border-white/10 bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Oldingi oy" onClick={() => setCursor(monthRange(`${cursor}-01`, -1).start.slice(0, 7))}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold">{monthTitle(`${cursor}-01`)}</div>
        <button type="button" aria-label="Keyingi oy" aria-disabled={cursor >= today.slice(0, 7)}
          onClick={() => { if (cursor < today.slice(0, 7)) setCursor(monthRange(`${cursor}-01`, 1).start.slice(0, 7)); }}
          className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${cursor >= today.slice(0, 7) ? "opacity-30 pointer-events-none" : ""}`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
        {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} />;
          const future = iso > today;
          const selected = !future && (iso === draftStart || iso === draftEnd)
            ? "bg-[#F59E0B] text-black font-bold"
            : !future && draftStart && draftEnd && iso > draftStart && iso < draftEnd
              ? "bg-[#F59E0B]/20"
              : iso === today
                ? "border border-[#F59E0B]/60"
                : "text-foreground/80 hover:bg-white/10";
          return (
            <button key={iso} type="button" data-testid="income-day" data-date={iso} disabled={future}
              onClick={() => pick(iso)}
              className={`h-8 rounded-lg text-xs ${selected} ${future ? "opacity-30 pointer-events-none" : ""}`}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-muted-foreground min-h-4" data-testid="income-picker-draft">
        {draftStart && draftEnd && draftEnd !== draftStart
          ? `Tanlangan oraliq: ${dmy(draftStart)} — ${dmy(draftEnd)}`
          : draftStart
            ? `Tanlangan sana: ${dmy(draftStart)}`
            : ""}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground">Bekor qilish</button>
        <button type="button" data-testid="income-picker-apply" disabled={!draftStart}
          onClick={() => {
            if (!draftStart) return;
            const end = draftEnd && draftEnd !== draftStart ? draftEnd : draftStart;
            onApply({ start: draftStart, end });
          }}
          className="flex-1 py-2 rounded-xl bg-[#F59E0B] text-black text-sm font-semibold disabled:opacity-30">
          Tanlash
        </button>
      </div>
    </div>
  );
}

export function IncomeAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const today = tashkentTodayISO();
  const [mode, setMode] = useState<Mode>("bugun");
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState<IncomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const demo = useDemoAnalytics();

  const range = useMemo(() => viewedRange(mode, offset, custom, today), [mode, offset, custom, today]);
  const rangeKey = `${range.start}|${range.end}`;
  const forwardDisabled = range.end >= today;

  useEffect(() => {
    if (demo.on) {
      setData(mockIncome(range, today));
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchIncome(range)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rangeKey, range.start, range.end, demo.on, today]);

  useEffect(() => {
    function onShow() {
      if (demo.on || document.visibilityState !== "visible") return;
      fetchIncome(range).then(setData).catch(() => {});
    }
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [range.start, range.end, demo.on]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const el = target instanceof Element ? target : target.parentElement;
      if (
        pickerRef.current &&
        el &&
        !pickerRef.current.contains(el) &&
        !el.closest("[data-period='sana']") &&
        !el.closest("[data-time-arrows]")
      ) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [pickerOpen]);

  function chooseMode(next: Mode) {
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

  const grouped = new Map<string, IncomeBooking[]>();
  for (const b of data?.bookings ?? []) {
    const list = grouped.get(b.date) ?? [];
    list.push(b);
    grouped.set(b.date, list);
  }

  const change = data?.revChange ?? 0;
  const changeColor = change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <BottomSheet title="Daromad tahlili" onClose={onClose}>
      {demo.available && <DemoDataToggle on={demo.on} toggle={demo.toggle} />}
      <TimeNav
        mode={pickerOpen || mode === "sana" ? "sana" : mode}
        label={timeLabel(mode, range, today)}
        forwardDisabled={forwardDisabled}
        onMode={chooseMode}
        onPrev={() => setOffset((n) => n - 1)}
        onNext={() => setOffset((n) => (n >= 0 && mode !== "sana" ? n : n + 1))}
      />

      {pickerOpen && (
        <div ref={pickerRef}>
          <p data-testid="income-picker-hint" className="text-center text-xs font-medium text-[#F59E0B] mb-2 px-2">
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
            }}
          />
        </div>
      )}

      {loading && !data && (
        <div data-testid="income-loading" className="space-y-3">
          <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      )}
      {!data && !loading && error && (
        <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
      )}

      {data && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-2" data-testid="income-kpis">
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/4 p-3.5">
              <div className="text-xs text-muted-foreground">Jami daromad</div>
              <div data-testid="income-total" className="mt-1 text-2xl font-bold tabular-nums">{soom(data.revenue)}</div>
              <div data-testid="income-change" className={`mt-1 text-sm font-semibold ${changeColor}`}>
                {change > 0 ? "+" : ""}{change}%
              </div>
              <div className="text-[11px] text-muted-foreground">{COMPARE[mode]}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
              <div className="text-xs text-muted-foreground">Tugatilgan bronlar</div>
              <div data-testid="income-count" className="mt-1 text-xl font-bold tabular-nums">{data.completedCount} ta</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
              <div className="text-xs text-muted-foreground">O'rtacha chek</div>
              <div data-testid="income-avg" className="mt-1 text-xl font-bold tabular-nums">{soom(data.averageCheck)}</div>
            </div>
          </div>

          {data.completedCount === 0 ? (
            <div data-testid="income-empty" className="text-center py-10 px-4">
              <Wallet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">{INCOME_EMPTY_TEXT}</p>
            </div>
          ) : (
            <>
              {data.services.length > 0 && (
                <div data-testid="income-services">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Xizmatlar ulushi</div>
                  <div className="space-y-3">
                    {data.services.map((s, index) => (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-sm mb-1 gap-2">
                          <span className="truncate">{s.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">{s.percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(s.percent, 100)}%`,
                              background: ["#F59E0B", "#38BDF8", "#34D399", "#F472B6"][index % 4],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div data-testid="income-history" className="space-y-5">
                {[...grouped.entries()].map(([date, items]) => (
                  <div key={date}>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">{dayHeader(date, today)}</div>
                    <div className="space-y-2">
                      {items.map((b) => (
                        <div key={b.id} data-testid="income-row" className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-white/3 border border-white/6">
                          <div className="w-9 h-9 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0 text-sm font-bold">
                            {(b.clientName || "M").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{b.clientName}</div>
                            <div className="text-xs text-muted-foreground truncate">{b.serviceName} · {soom(b.price)}</div>
                          </div>
                          <div className="text-xs font-medium text-muted-foreground shrink-0">{b.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
