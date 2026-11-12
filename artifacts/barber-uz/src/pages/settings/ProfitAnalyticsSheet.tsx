import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { useTranslation } from "@/i18n/LanguageContext";
import { monthNames, moneyLabel, pick, weekdayNames } from "@/i18n/pick";
import { addDaysISO, tashkentTodayISO } from "@/lib/schedule";

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

interface DateRange { start: string; end: string }

interface IncomeBooking {
  id: string;
  price: number;
  date: string;
}

interface ExpenseRow {
  id: string;
  amount: string;
  date: string;
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

function asISODate(value: string): string {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? String(value);
}

async function fetchIncome(range: DateRange): Promise<IncomeBooking[]> {
  const res = await fetch(`/api/analytics/income?from=${range.start}&to=${range.end}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  const data = await res.json();
  return ((data.bookings ?? []) as IncomeBooking[]).map((row) => ({
    ...row,
    date: asISODate(row.date),
    price: Number(row.price),
  }));
}

async function fetchExpenses(): Promise<ExpenseRow[]> {
  const res = await fetch("/api/expenses", {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  const data = await res.json();
  return ((data.expenses ?? []) as ExpenseRow[]).map((row) => ({
    ...row,
    date: asISODate(row.date),
  }));
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
function monthTitle(iso: string, lang = "uz"): string {
  const names = monthNames(lang);
  const [y, m] = iso.split("-").map(Number);
  return `${names[(m ?? 1) - 1]} ${y}`;
}

function modesFor(lang: string): { key: Mode; label: string }[] {
  return [
    { key: "bugun", label: pick(lang, "Bugun", "Сегодня") },
    { key: "hafta", label: pick(lang, "Shu hafta", "Эта неделя") },
    { key: "oy", label: pick(lang, "Oy", "Месяц") },
    { key: "sana", label: pick(lang, "📅 Sana", "📅 Дата") },
  ];
}

function timeLabel(mode: Mode, range: DateRange, today: string, lang = "uz"): string {
  if (mode === "sana") {
    return range.start === range.end ? dmy(range.start) : `${dmy(range.start)} — ${dmy(range.end)}`;
  }
  if (mode === "bugun") {
    if (range.start === today) return `${pick(lang, "Bugun", "Сегодня")}, ${dmy(range.start)}`;
    if (range.start === addDaysISO(today, -1)) return `${pick(lang, "Kecha", "Вчера")}, ${dmy(range.start)}`;
    return dmy(range.start);
  }
  if (mode === "hafta") {
    const current = mondayOf(today);
    const previous = addDaysISO(current, -7);
    const inner = `${dm(range.start)} — ${dm(range.end)}`;
    if (range.start === current) return `${pick(lang, "Shu hafta", "Эта неделя")}: ${inner}`;
    if (range.start === previous) return `${pick(lang, "O'tgan hafta", "Прошлая неделя")}: ${inner}`;
    return inner;
  }
  const name = monthTitle(range.start, lang);
  if (range.start === monthRange(today, 0).start) return `${pick(lang, "Shu oy", "Этот месяц")}: ${name}`;
  if (range.start === monthRange(today, -1).start) return `${pick(lang, "O'tgan oy", "Прошлый месяц")}: ${name}`;
  return name;
}

function soom(n: number, lang = "uz"): string {
  return moneyLabel(lang, Math.round(Math.abs(n)));
}

function signedSoom(n: number, lang = "uz"): string {
  if (n > 0) return `+${soom(n, lang)}`;
  if (n < 0) return `−${soom(n, lang)}`;
  return soom(0, lang);
}

function dayHeader(iso: string, today: string, lang = "uz"): string {
  const names = monthNames(lang);
  const [y, m, d] = iso.split("-").map(Number);
  const label = `${d}-${names[(m ?? 1) - 1]}`;
  if (iso === today) return `${pick(lang, "Bugun", "Сегодня")}, ${label}`;
  if (iso === addDaysISO(today, -1)) return `${pick(lang, "Kecha", "Вчера")}, ${label}`;
  return y ? label : iso;
}

function TimeNav({
  mode, label, forwardDisabled, onMode, onPrev, onNext, lang,
}: {
  mode: Mode;
  label: string;
  forwardDisabled: boolean;
  onMode: (m: Mode) => void;
  onPrev: () => void;
  onNext: () => void;
  lang: string;
}) {
  return (
    <div className="mb-3 space-y-2.5" data-testid="profit-time-nav">
      <div role="tablist" data-testid="profit-period-tabs" className="relative z-10 flex flex-nowrap gap-1 bg-background/60 p-1 rounded-2xl border border-white/6">
        {modesFor(lang).map(({ key, label: tab }) => (
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
          data-testid="profit-prev"
          aria-label={pick(lang, "Oldingi davr", "Предыдущий период")}
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
        <div data-testid="profit-time-label" className="flex-1 min-w-0 text-center text-xs sm:text-sm font-medium leading-snug">
          {pick(lang, "Tanlangan vaqt", "Выбранное время")}: {label}
        </div>
        <button
          type="button"
          data-testid="profit-next"
          aria-label={pick(lang, "Keyingi davr", "Следующий период")}
          disabled={forwardDisabled}
          aria-disabled={forwardDisabled}
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
  today, initial, onApply, onCancel, lang,
}: {
  today: string;
  initial: DateRange | null;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
  lang: string;
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
    <div data-testid="profit-date-picker" className="mb-4 rounded-2xl border border-white/10 bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label={pick(lang, "Oldingi oy", "Предыдущий месяц")} onClick={() => setCursor(monthRange(`${cursor}-01`, -1).start.slice(0, 7))}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold">{monthTitle(`${cursor}-01`, lang)}</div>
        <button type="button" aria-label={pick(lang, "Keyingi oy", "Следующий месяц")} aria-disabled={cursor >= today.slice(0, 7)}
          onClick={() => { if (cursor < today.slice(0, 7)) setCursor(monthRange(`${cursor}-01`, 1).start.slice(0, 7)); }}
          className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${cursor >= today.slice(0, 7) ? "opacity-30 pointer-events-none" : ""}`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
        {weekdayNames(lang).map((w) => <div key={w}>{w}</div>)}
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
            <button key={iso} type="button" disabled={future} onClick={() => pick(iso)}
              className={`h-8 rounded-lg text-xs ${selected} ${future ? "opacity-30 pointer-events-none" : ""}`}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-muted-foreground min-h-4">
        {draftStart && draftEnd && draftEnd !== draftStart
          ? `${pick(lang, "Tanlangan oraliq", "Выбранный период")}: ${dmy(draftStart)} — ${dmy(draftEnd)}`
          : draftStart
            ? `${pick(lang, "Tanlangan sana", "Выбранная дата")}: ${dmy(draftStart)}`
            : ""}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground">{pick(lang, "Bekor qilish", "Отмена")}</button>
        <button type="button" disabled={!draftStart}
          onClick={() => {
            if (!draftStart) return;
            const end = draftEnd && draftEnd !== draftStart ? draftEnd : draftStart;
            onApply({ start: draftStart, end });
          }}
          className="flex-1 py-2 rounded-xl bg-[#F59E0B] text-black text-sm font-semibold disabled:opacity-30">
          {pick(lang, "Tanlash", "Выбрать")}
        </button>
      </div>
    </div>
  );
}

export function ProfitAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const { lang } = useTranslation();
  const today = tashkentTodayISO();
  const [mode, setMode] = useState<Mode>("bugun");
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const range = useMemo(() => viewedRange(mode, offset, custom, today), [mode, offset, custom, today]);
  const [bookings, setBookings] = useState<IncomeBooking[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [readyRange, setReadyRange] = useState(range);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const rangeKey = `${range.start}|${range.end}`;
  const forwardDisabled = range.end >= today;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([fetchIncome(range), fetchExpenses()])
      .then(([incomeRows, expenseRows]) => {
        if (cancelled) return;
        setBookings(incomeRows);
        setExpenses(expenseRows);
        setReadyRange({ start: range.start, end: range.end });
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rangeKey, range.start, range.end]);

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

  const revenue = bookings.reduce((sum, row) => sum + Number(row.price), 0);
  const expenseTotal = expenses
    .filter((row) => row.date >= readyRange.start && row.date <= readyRange.end)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const net = revenue - expenseTotal;
  const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const flow = revenue + expenseTotal;
  const revenueShare = flow > 0 ? Math.round((revenue / flow) * 100) : 0;
  const expenseShare = flow > 0 ? 100 - revenueShare : 0;

  const byDay = new Map<string, { revenue: number; expenses: number }>();
  for (const row of bookings) {
    const day = byDay.get(row.date) ?? { revenue: 0, expenses: 0 };
    day.revenue += Number(row.price);
    byDay.set(row.date, day);
  }
  for (const row of expenses) {
    if (row.date < readyRange.start || row.date > readyRange.end) continue;
    const day = byDay.get(row.date) ?? { revenue: 0, expenses: 0 };
    day.expenses += Number(row.amount);
    byDay.set(row.date, day);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const hasActivity = revenue > 0 || expenseTotal > 0;

  return (
    <BottomSheet title={pick(lang, "Sof foyda tahlili", "Анализ чистой прибыли")} onClose={onClose}>
      <TimeNav
        mode={pickerOpen || mode === "sana" ? "sana" : mode}
        label={timeLabel(mode, range, today, lang)}
        forwardDisabled={forwardDisabled}
        lang={lang}
        onMode={chooseMode}
        onPrev={() => setOffset((n) => n - 1)}
        onNext={() => setOffset((n) => (n >= 0 && mode !== "sana" ? n : n + 1))}
      />

      {pickerOpen && (
        <div ref={pickerRef}>
          <p className="text-center text-xs font-medium text-[#F59E0B] mb-2 px-2">
            {pick(lang, "Bitta kunni tanlash uchun ustiga bosing yoki oraliqni belgilang", "Нажмите на день или выберите период")}
          </p>
          <DateRangePicker
            today={today}
            lang={lang}
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

      {loading && bookings.length === 0 && expenses.length === 0 && (
        <div data-testid="profit-loading" className="space-y-3">
          <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-10 text-sm text-muted-foreground">{pick(lang, "Ma'lumot yuklanmadi", "Не удалось загрузить")}</div>
      )}

      {!error && (bookings.length > 0 || expenses.length > 0 || !loading) && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-2" data-testid="profit-kpis">
            <div className="col-span-2 rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-3.5">
              <div className="text-xs text-muted-foreground">{pick(lang, "Sof foyda", "Чистая прибыль")}</div>
              <div data-testid="profit-net" className="mt-1 text-2xl font-bold tabular-nums text-[#F59E0B]">
                {signedSoom(net, lang)}
              </div>
              <div data-testid="profit-margin" className="mt-1 text-sm font-semibold text-muted-foreground">
                Samaradorlik darajasi: {margin}%
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
              <div className="text-xs text-muted-foreground">{pick(lang, "Jami daromad", "Общий доход")}</div>
              <div data-testid="profit-revenue" className="mt-1 text-lg font-bold tabular-nums text-[#10B981]">{revenue > 0 ? `+${soom(revenue, lang)}` : soom(0, lang)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
              <div className="text-xs text-muted-foreground">{pick(lang, "Jami xarajat", "Всего расходов")}</div>
              <div data-testid="profit-expenses" className="mt-1 text-lg font-bold tabular-nums text-[#EF4444]">{expenseTotal > 0 ? `−${soom(expenseTotal, lang)}` : soom(0, lang)}</div>
            </div>
          </div>

          {hasActivity && (
            <div data-testid="profit-compare">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {pick(lang, "Daromad va xarajat", "Доход и расход")}
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/10">
                <div style={{ width: `${revenueShare}%`, background: "#10B981" }} />
                <div style={{ width: `${expenseShare}%`, background: "#EF4444" }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#10B981] font-semibold">{pick(lang, "Daromad", "Доход")} {revenueShare}%</span>
                <span className="text-[#EF4444] font-semibold">{pick(lang, "Xarajat", "Расход")} {expenseShare}%</span>
              </div>
            </div>
          )}

          {!hasActivity ? (
            <div data-testid="profit-empty" className="text-center py-10 px-4">
              <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">{pick(lang, "Ushbu davrda daromad va xarajat yo'q", "За этот период нет дохода и расходов")}</p>
            </div>
          ) : (
            <div data-testid="profit-days" className="space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{pick(lang, "Kunlar bo'yicha", "По дням")}</div>
              {days.map(([date, day]) => {
                const dayNet = day.revenue - day.expenses;
                return (
                  <div key={date} data-testid="profit-day">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">{dayHeader(date, today, lang)}</div>
                    <div className="rounded-2xl border border-white/6 bg-white/3 px-3 py-2.5 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{pick(lang, "Daromad", "Доход")}</span>
                        <span className="font-semibold tabular-nums text-[#10B981]">{day.revenue > 0 ? `+${soom(day.revenue, lang)}` : soom(0, lang)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{pick(lang, "Xarajat", "Расход")}</span>
                        <span className="font-semibold tabular-nums text-[#EF4444]">{day.expenses > 0 ? `−${soom(day.expenses, lang)}` : soom(0, lang)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/6">
                        <span className="font-semibold">{pick(lang, "Sof foyda", "Чистая прибыль")}</span>
                        <span data-testid="profit-day-net" className="font-bold tabular-nums text-[#F59E0B]">{signedSoom(dayNet, lang)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
