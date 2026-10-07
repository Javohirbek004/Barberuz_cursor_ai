import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
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

const COMPARE: Record<Mode, string> = {
  bugun: "kechaga nisbatan",
  hafta: "o'tgan haftaga nisbatan",
  oy: "o'tgan oyga nisbatan",
  sana: "oldingi davrga nisbatan",
};

const DEFAULT_CATS = ["✂️ Ish qurollari", "🏢 Ijara va Kommunal", "🍔 Shaxsiy", "📦 Boshqa"];

interface DateRange { start: string; end: string }

interface ExpenseRow {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

function asISODate(value: string): string {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? String(value);
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

function previousRange(range: DateRange): DateRange {
  const span = daysBetweenISO(range.start, range.end) + 1;
  const end = addDaysISO(range.start, -1);
  return { start: addDaysISO(end, -(span - 1)), end };
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

function categoryColor(name: string, index: number): string {
  const key = name.toLowerCase();
  if (key.includes("ish qurollari")) return "#F59E0B";
  if (key.includes("ijara")) return "#38BDF8";
  if (key.includes("shaxsiy")) return "#34D399";
  if (key.includes("boshqa")) return "#F472B6";
  return ["#A78BFA", "#FB7185", "#22D3EE", "#FBBF24"][index % 4];
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
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
    <div className="mb-3 space-y-2.5" data-testid="expense-time-nav">
      <div role="tablist" data-testid="expense-period-tabs" className="relative z-10 flex flex-nowrap gap-1 bg-background/60 p-1 rounded-2xl border border-white/6">
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
          data-testid="expense-prev"
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
        <div data-testid="expense-time-label" className="flex-1 min-w-0 text-center text-xs sm:text-sm font-medium leading-snug">
          Tanlangan vaqt: {label}
        </div>
        <button
          type="button"
          data-testid="expense-next"
          aria-label="Keyingi davr"
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
    <div data-testid="expense-date-picker" className="mb-4 rounded-2xl border border-white/10 bg-background p-3">
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
            <button key={iso} type="button" disabled={future} onClick={() => pick(iso)}
              className={`h-8 rounded-lg text-xs ${selected} ${future ? "opacity-30 pointer-events-none" : ""}`}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-muted-foreground min-h-4">
        {draftStart && draftEnd && draftEnd !== draftStart
          ? `Tanlangan oraliq: ${dmy(draftStart)} — ${dmy(draftEnd)}`
          : draftStart
            ? `Tanlangan sana: ${dmy(draftStart)}`
            : ""}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground">Bekor qilish</button>
        <button type="button" disabled={!draftStart}
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

function ExpenseEditDialog({
  expense, today, onClose, onSaved,
}: {
  expense: ExpenseRow;
  today: string;
  onClose: () => void;
  onSaved: (row: ExpenseRow) => void;
}) {
  const [title, setTitle] = useState(expense.title);
  const [amountRaw, setAmountRaw] = useState(String(Math.round(Number(expense.amount))));
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const cats = DEFAULT_CATS.includes(expense.category) ? DEFAULT_CATS : [expense.category, ...DEFAULT_CATS];
  const amountNum = amountRaw ? parseInt(amountRaw, 10) : 0;
  const valid = title.trim().length > 0 && amountNum > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ title: title.trim(), amount: amountNum, category, date }),
      });
      if (!res.ok) throw new Error("save_error");
      const saved = await res.json();
      onSaved({
        id: saved.id ?? expense.id,
        title: saved.title ?? title.trim(),
        amount: String(saved.amount ?? amountNum),
        category: saved.category ?? category,
        date: asISODate(saved.date ?? date),
      });
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" data-testid="expense-edit-modal">
      <button type="button" aria-label="Yopish" className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-5 space-y-4 border border-white/10">
        <div className="font-display font-bold text-lg">Xarajatni tahrirlash</div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Nomi</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-sm focus:outline-none focus:border-[#F59E0B]/60"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Miqdor (so'm)</span>
          <input
            inputMode="numeric"
            value={amountRaw ? Number(amountRaw).toLocaleString("uz-UZ") : ""}
            onChange={(e) => setAmountRaw(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-sm tabular-nums focus:outline-none focus:border-[#F59E0B]/60"
          />
        </label>
        <div>
          <div className="text-xs text-muted-foreground mb-2">Kategoriya</div>
          <div className="flex flex-wrap gap-2">
            {cats.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  category === cat
                    ? "bg-[#F59E0B] text-black border-[#F59E0B]"
                    : "bg-white/4 border-white/8 text-muted-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Sana</span>
          <input
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-sm focus:outline-none focus:border-[#F59E0B]/60"
          />
        </label>
        {error && <div className="text-sm text-red-400">Saqlanmadi. Qayta urinib ko'ring.</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-muted-foreground">Bekor qilish</button>
          <button
            type="button"
            data-testid="expense-edit-save"
            disabled={!valid || saving}
            onClick={save}
            className="flex-1 py-3 rounded-xl bg-[#F59E0B] text-black text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ExpensesAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const today = tashkentTodayISO();
  const [mode, setMode] = useState<Mode>("bugun");
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => viewedRange(mode, offset, custom, today), [mode, offset, custom, today]);
  const prior = useMemo(() => previousRange(range), [range]);
  const forwardDisabled = range.end >= today;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchExpenses()
      .then((list) => { if (!cancelled) setRows(list); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onShow() {
      if (document.visibilityState !== "visible") return;
      fetchExpenses().then(setRows).catch(() => {});
    }
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

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

  const currentRows = rows.filter((row) => inRange(row.date, range));
  const previousTotal = rows
    .filter((row) => inRange(row.date, prior))
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const total = currentRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const count = currentRows.length;
  const average = count > 0 ? total / count : 0;
  const change = percentChange(total, previousTotal);
  const changeColor = change > 0 ? "text-red-400" : change < 0 ? "text-green-400" : "text-muted-foreground";

  const categories = Object.values(
    currentRows.reduce<Record<string, { name: string; amount: number }>>((acc, row) => {
      const name = row.category || "📦 Boshqa";
      acc[name] = acc[name] ?? { name, amount: 0 };
      acc[name].amount += Number(row.amount);
      return acc;
    }, {}),
  )
    .map((cat) => ({ ...cat, percent: total > 0 ? Math.round((cat.amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const grouped = new Map<string, ExpenseRow[]>();
  for (const row of [...currentRows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
    const list = grouped.get(row.date) ?? [];
    list.push(row);
    grouped.set(row.date, list);
  }

  async function handleDelete(id: string) {
    const snapshot = rows;
    setRows((list) => list.filter((row) => row.id !== id));
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("delete_error");
    } catch {
      setRows(snapshot);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <BottomSheet title="Xarajatlar tahlili" onClose={onClose}>
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
            <p className="text-center text-xs font-medium text-[#F59E0B] mb-2 px-2">
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

        {loading && rows.length === 0 && (
          <div data-testid="expense-loading" className="space-y-3">
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        )}
        {!loading && error && rows.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
        )}

        {(rows.length > 0 || !loading) && !error && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2" data-testid="expense-kpis">
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/4 p-3.5">
                <div className="text-xs text-muted-foreground">Jami xarajat</div>
                <div data-testid="expense-total" className="mt-1 text-2xl font-bold tabular-nums">{soom(total)}</div>
                <div data-testid="expense-change" className={`mt-1 text-sm font-semibold ${changeColor}`}>
                  {change > 0 ? "+" : ""}{change}%
                </div>
                <div className="text-[11px] text-muted-foreground">{COMPARE[mode]}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
                <div className="text-xs text-muted-foreground">Xarajatlar soni</div>
                <div data-testid="expense-count" className="mt-1 text-xl font-bold tabular-nums">{count} ta</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
                <div className="text-xs text-muted-foreground">O'rtacha xarajat</div>
                <div data-testid="expense-avg" className="mt-1 text-xl font-bold tabular-nums">{soom(average)}</div>
              </div>
            </div>

            {count === 0 ? (
              <div data-testid="expense-empty" className="text-center py-10 px-4">
                <Receipt className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Ushbu davrda xarajatlar mavjud emas</p>
              </div>
            ) : (
              <>
                <div data-testid="expense-categories">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Kategoriyalar bo'yicha
                  </div>
                  <div className="space-y-3">
                    {categories.map((cat, index) => (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between text-sm mb-1 gap-2">
                          <span className="truncate">{cat.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">{cat.percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(cat.percent, 100)}%`, background: categoryColor(cat.name, index) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div data-testid="expense-history" className="space-y-5">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarix</div>
                  {[...grouped.entries()].map(([date, items]) => (
                    <div key={date}>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">{dayHeader(date, today)}</div>
                      <div className="space-y-2">
                        {items.map((row) => (
                          <div key={row.id} data-testid="expense-row" className="flex items-center gap-2 py-2.5 px-3 rounded-2xl bg-white/3 border border-white/6">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{row.title}</div>
                              <div className="mt-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/6 text-muted-foreground/80">
                                  {row.category}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-red-400/90 tabular-nums shrink-0">
                              −{soom(Number(row.amount))}
                            </div>
                            <button
                              type="button"
                              data-testid="expense-edit"
                              aria-label="Tahrirlash"
                              onClick={() => setEditing(row)}
                              className="p-1.5 rounded-lg hover:bg-white/8 shrink-0"
                            >
                              <span className="text-xs">✏️</span>
                            </button>
                            <button
                              type="button"
                              data-testid="expense-delete"
                              aria-label="O'chirish"
                              disabled={deletingId === row.id}
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 shrink-0 disabled:opacity-30"
                            >
                              {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-xs">🗑️</span>}
                            </button>
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

      {editing && (
        <ExpenseEditDialog
          expense={editing}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((list) => list.map((row) => (row.id === updated.id ? updated : row)));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
