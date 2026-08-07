import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, X, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "bugun" | "hafta" | "oy";
type ModalKind = "daromad" | "mijozlar" | "xarajatlar" | "sof-foyda" | null;

const PERIOD_API: Record<Period, string> = {
  bugun: "today",
  hafta: "week",
  oy: "month",
};

interface SoloData {
  revenue: number;
  revChange: number;
  totalExpenses: number;
  netProfit: number;
  clients: number;
  activeBookings: number;
  totalBookings: number;
  cancelled: number;
  noshow: number;
  topService: { name: string; count: number; revenue: number } | null;
  busiestTime: string;
  tips: string[];
}

interface Expense {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
}

interface CompletedBooking {
  id: string;
  clientName: string;
  serviceName: string | null;
  startTime: string;
  date: string;
  price: number;
}

interface BarberStat {
  id: string;
  name: string;
  medal: string;
  revenue: number;
  clients: number;
}

interface TeamData {
  revenue: number;
  revChange: number;
  clients: number;
  activeBookings: number;
  totalBookings: number;
  cancelled: number;
  noshow: number;
  barbers: BarberStat[];
  bestBarber: string | null;
  mostNoshow: string | null;
  tips: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} 000`;
  return String(n);
}

function fmtFull(n: number) {
  return Math.abs(n).toLocaleString("uz-UZ") + " so'm";
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

const UZ_MONTHS = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr",
];

function fmtDateGroupHeader(iso: string): string {
  const today = todayIso();
  const ydObj = new Date();
  ydObj.setDate(ydObj.getDate() - 1);
  const yesterday = ydObj.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  const d = new Date(`${iso}T12:00:00`);
  const dateStr = `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
  if (iso === today) return `Bugun, ${dateStr}`;
  if (iso === yesterday) return `Kecha, ${dateStr}`;
  return dateStr;
}

const PERIOD_COMPARE_LABEL: Record<Period, string> = {
  bugun: "Kechaga nisbatan",
  hafta: "O'tgan haftaga nisbatan",
  oy: "O'tgan oyga nisbatan",
};

const CAT_COLORS = [
  "bg-amber-400",
  "bg-blue-400",
  "bg-green-400",
  "bg-purple-400",
  "bg-pink-400",
  "bg-orange-400",
  "bg-cyan-400",
  "bg-red-400",
];
const CAT_TEXT_COLORS = [
  "text-amber-400",
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-pink-400",
  "text-orange-400",
  "text-cyan-400",
  "text-red-400",
];

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchSolo(period: string): Promise<SoloData> {
  const res = await fetch(`/api/analytics/solo?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

async function fetchTeam(period: string): Promise<TeamData> {
  const res = await fetch(`/api/analytics/team?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

async function fetchDetail(period: string): Promise<CompletedBooking[]> {
  const res = await fetch(`/api/analytics/detail?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.completedBookings ?? [];
}

async function fetchExpenses(period: string): Promise<Expense[]> {
  const res = await fetch(`/api/expenses?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.expenses ?? [];
}

async function deleteExpenseApi(id: string): Promise<void> {
  await fetch(`/api/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

async function updateExpenseApi(
  id: string,
  payload: Partial<Pick<Expense, "title" | "amount" | "category">>,
): Promise<void> {
  await fetch(`/api/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload),
  });
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

// ── Period filter ─────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: "bugun", label: "Bugun" },
  { key: "hafta", label: "Hafta" },
  { key: "oy", label: "Oy" },
];

function PeriodFilter({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1.5 bg-card p-1 rounded-2xl border border-white/6 mb-6">
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            period === key
              ? "bg-primary text-black shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Bottom Sheet ───────────────────────────────────────────────────────────────

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col shadow-2xl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0">
          <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-white/6 mx-5 shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 pb-12">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ── Clickable KPI Card ─────────────────────────────────────────────────────────

function ClickableKpiCard({
  emoji,
  label,
  value,
  valueColor,
  sub,
  subColor,
  index,
  onClick,
}: {
  emoji: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  subColor?: string;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="bg-card border border-white/6 rounded-2xl p-4 text-left w-full hover:bg-white/4 active:bg-white/6 transition-colors"
    >
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`font-bold text-base leading-tight ${valueColor ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-xs mt-0.5 font-semibold ${subColor ?? "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </motion.button>
  );
}

// ── Metric Pill ────────────────────────────────────────────────────────────────

function MetricPill({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex-1 bg-white/4 border border-white/8 rounded-2xl p-3">
      <div className="text-xs text-muted-foreground mb-0.5 leading-tight">{label}</div>
      <div className={`font-bold text-sm leading-snug ${valueColor ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Expense Edit Modal ─────────────────────────────────────────────────────────

function ExpenseEditModal({
  expense,
  onClose,
  onSaved,
}: {
  expense: Expense;
  onClose: () => void;
  onSaved: (updated: Expense) => void;
}) {
  const [title, setTitle]   = useState(expense.title);
  const [amount, setAmount] = useState(expense.amount);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await updateExpenseApi(expense.id, { title: title.trim(), amount });
      onSaved({ ...expense, title: title.trim(), amount });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-[#18181d] rounded-3xl border border-white/8 p-6 z-10 shadow-2xl space-y-4"
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">✏️ Xarajatni tahrirlash</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nomi</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full h-11 px-3 rounded-2xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Miqdor (so'm)</label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full h-11 px-3 rounded-2xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onClose}
            className="py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
          >
            Bekor
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || Number(amount) <= 0}
            className="py-3 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Saqlash
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Daromad Modal ─────────────────────────────────────────────────────────────

function DaromadModal({
  data,
  bookings,
  onClose,
}: {
  data: SoloData;
  bookings: CompletedBooking[];
  onClose: () => void;
}) {
  const avgCheck =
    bookings.length > 0 ? Math.round(data.revenue / bookings.length) : 0;
  const topSvcPct =
    data.topService && data.revenue > 0
      ? Math.round((data.topService.revenue / data.revenue) * 100)
      : 0;

  // Group by date desc; within each group sort by startTime asc
  const grouped: Record<string, CompletedBooking[]> = {};
  for (const b of bookings) {
    if (!grouped[b.date]) grouped[b.date] = [];
    grouped[b.date].push(b);
  }
  for (const d of Object.keys(grouped)) {
    grouped[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <BottomSheet title="💰 Daromad tahlili" onClose={onClose}>
      {/* Top metrics */}
      <div className="flex gap-2 mb-5">
        <MetricPill label="O'rtacha chek" value={fmtFull(avgCheck)} />
        {data.topService ? (
          <MetricPill
            label="Top xizmat"
            value={`${data.topService.name} · ${topSvcPct}%`}
          />
        ) : (
          <MetricPill label="Top xizmat" value="—" />
        )}
      </div>

      {/* Transaction list */}
      {bookings.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Tugatilgan bronlar yo'q
        </div>
      ) : (
        <div className="space-y-5">
          {dates.map(date => {
            const entries = grouped[date];
            const dayTotal = entries.reduce((s, b) => s + b.price, 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {fmtDateGroupHeader(date)}
                  </span>
                  <span className="text-xs font-bold text-green-400">
                    +{fmtFull(dayTotal)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {entries.map(b => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-white/3 border border-white/5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {b.clientName || "Mijoz"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {b.serviceName ?? "—"} · {b.startTime}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-green-400 tabular-nums shrink-0">
                        +{fmtFull(b.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

// ── Mijozlar Modal ────────────────────────────────────────────────────────────

function MijozlarModal({
  bookings,
  onClose,
}: {
  bookings: CompletedBooking[];
  onClose: () => void;
}) {
  const clientMap: Record<string, { visits: number; totalSpent: number }> = {};
  for (const b of bookings) {
    const key = b.clientName || "Noma'lum";
    if (!clientMap[key]) clientMap[key] = { visits: 0, totalSpent: 0 };
    clientMap[key].visits++;
    clientMap[key].totalSpent += b.price;
  }
  const ranked = Object.entries(clientMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.visits - a.visits || b.totalSpent - a.totalSpent);

  const uniqueCount = ranked.length;
  const returningCount = ranked.filter(c => c.visits > 1).length;
  const returningRate =
    uniqueCount > 0 ? Math.round((returningCount / uniqueCount) * 100) : 0;

  function badge(rank: number) {
    if (rank === 1) return <span className="text-lg leading-none">🥇</span>;
    if (rank === 2) return <span className="text-lg leading-none">🥈</span>;
    if (rank === 3) return <span className="text-lg leading-none">🥉</span>;
    return <span className="text-xs font-bold text-muted-foreground">{rank}</span>;
  }

  return (
    <BottomSheet title="👥 Mijozlar tahlili" onClose={onClose}>
      <div className="flex gap-2 mb-5">
        <MetricPill label="Jami mijozlar" value={`${uniqueCount} ta`} />
        <MetricPill
          label="Qayta kelganlar"
          value={`${returningRate}%`}
          valueColor={returningRate >= 30 ? "text-green-400" : "text-foreground"}
        />
      </div>

      {ranked.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Mijozlar yo'q
        </div>
      ) : (
        <div className="space-y-1.5">
          {ranked.map((c, i) => (
            <div
              key={c.name}
              className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-white/3 border border-white/5"
            >
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                {badge(i + 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.visits} marta</div>
              </div>
              <div className="text-sm font-bold text-primary tabular-nums shrink-0">
                {fmtFull(c.totalSpent)}
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ── Xarajatlar Modal ──────────────────────────────────────────────────────────

function XarajatlarModal({
  expenses,
  onExpensesChange,
  onClose,
}: {
  expenses: Expense[];
  onExpensesChange: (updated: Expense[]) => void;
  onClose: () => void;
}) {
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const catMap: Record<string, number> = {};
  for (const e of expenses) {
    catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
  }
  const catEntries = Object.entries(catMap)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const grouped: Record<string, Expense[]> = {};
  for (const e of expenses) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }
  const dates = Object.keys(grouped).sort().reverse();

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteExpenseApi(id);
      onExpensesChange(expenses.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <BottomSheet title="💸 Xarajatlar tahlili" onClose={onClose}>
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Xarajatlar yo'q
          </div>
        ) : (
          <div className="space-y-5">
            {/* Category breakdown */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Kategoriyalar bo'yicha
              </div>
              <div className="space-y-3">
                {catEntries.map((cat, i) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CAT_COLORS[i % CAT_COLORS.length]}`} />
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmtFull(cat.amount)}</span>
                        <span className={`text-xs font-bold w-9 text-right ${CAT_TEXT_COLORS[i % CAT_TEXT_COLORS.length]}`}>
                          {cat.pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${CAT_COLORS[i % CAT_COLORS.length]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.pct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.08 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/6" />

            {/* History */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Tarix
              </div>
              <div className="space-y-5">
                {dates.map(date => {
                  const entries = grouped[date];
                  const dayTotal = entries.reduce((s, e) => s + Number(e.amount), 0);
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {fmtDateGroupHeader(date)}
                        </span>
                        <span className="text-xs font-bold text-red-400">
                          −{fmtFull(dayTotal)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {entries.map(exp => (
                          <div
                            key={exp.id}
                            className="flex items-center gap-2 py-2.5 px-3 rounded-2xl bg-white/3 border border-white/5"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate">
                                {exp.title}
                              </div>
                              <div className="mt-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/6 text-muted-foreground/80">
                                  {exp.category}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-red-400 tabular-nums shrink-0">
                              −{fmtFull(Number(exp.amount))}
                            </div>
                            <button
                              onClick={() => setEditingExp(exp)}
                              className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-all shrink-0"
                            >
                              <span className="text-xs">✏️</span>
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              disabled={deletingId === exp.id}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all disabled:opacity-30 shrink-0"
                            >
                              {deletingId === exp.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span className="text-xs">🗑️</span>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Edit modal stacks on top */}
      <AnimatePresence>
        {editingExp && (
          <ExpenseEditModal
            expense={editingExp}
            onClose={() => setEditingExp(null)}
            onSaved={updated => {
              onExpensesChange(expenses.map(e => (e.id === updated.id ? updated : e)));
              setEditingExp(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sof Foyda Modal ───────────────────────────────────────────────────────────

function SofFoydaModal({
  data,
  totalExpenses,
  netProfit,
  period,
  onClose,
}: {
  data: SoloData;
  totalExpenses: number;
  netProfit: number;
  period: Period;
  onClose: () => void;
}) {
  const profitMargin =
    data.revenue > 0 ? Math.round((netProfit / data.revenue) * 100) : 0;
  const netPositive = netProfit >= 0;
  const netColor = netPositive ? "text-green-400" : "text-red-400";
  const netBg = netPositive
    ? "bg-green-500/8 border-green-500/20"
    : "bg-red-500/8 border-red-500/20";
  const trendSign = data.revChange > 0 ? "+" : "";
  const trendColor =
    data.revChange > 0
      ? "text-green-400"
      : data.revChange < 0
        ? "text-red-400"
        : "text-muted-foreground";

  return (
    <BottomSheet title="📈 Sof foyda tahlili" onClose={onClose}>
      <div className="space-y-4">
        {/* Financial summary */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">💰 Jami daromad</span>
            <span className="font-bold text-foreground tabular-nums">+{fmtFull(data.revenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">💸 Jami xarajat</span>
            <span className="font-bold text-red-400 tabular-nums">−{fmtFull(totalExpenses)}</span>
          </div>
          <div className="h-px bg-white/8" />
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${netBg}`}>
            <span className="text-sm font-semibold text-foreground">📈 Sof foyda</span>
            <span className={`font-bold text-lg tabular-nums ${netColor}`}>
              {netPositive ? "+" : "−"}{fmtFull(Math.abs(netProfit))}
            </span>
          </div>
        </div>

        {/* Key metrics */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Foydalilik darajasi</div>
            <div className={`font-bold text-2xl tabular-nums ${netColor}`}>{profitMargin}%</div>
            <div className="text-xs text-muted-foreground mt-1">Daromaddan sof foyda</div>
          </div>
          <div className="flex-1 bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">O'sish ko'rsatkichi</div>
            <div className={`font-bold text-2xl tabular-nums ${trendColor}`}>
              {trendSign}{data.revChange}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {PERIOD_COMPARE_LABEL[period]}
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Section card (kept for JamoaAnalytics) ────────────────────────────────────

function Section({
  title,
  children,
  index,
}: {
  title: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="bg-card border border-white/6 rounded-2xl p-4"
    >
      <div className="font-bold text-sm mb-3 text-foreground">{title}</div>
      {children}
    </motion.div>
  );
}

// ── YAKKA MODE UI ─────────────────────────────────────────────────────────────

function YakkaAnalytics({ period }: { period: Period }) {
  const [data, setData]         = useState<SoloData | null>(null);
  const [bookings, setBookings] = useState<CompletedBooking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  useEffect(() => {
    setLoading(true);
    setActiveModal(null);
    const apiPeriod = PERIOD_API[period];
    Promise.all([
      fetchSolo(apiPeriod),
      fetchDetail(apiPeriod),
      fetchExpenses(apiPeriod),
    ])
      .then(([solo, detail, exp]) => {
        setData(solo);
        setBookings(detail);
        setExpenses(exp);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  // Re-fetch whenever the user navigates back to this page
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      const apiPeriod = PERIOD_API[period];
      setLoading(true);
      Promise.all([
        fetchSolo(apiPeriod),
        fetchDetail(apiPeriod),
        fetchExpenses(apiPeriod),
      ])
        .then(([solo, detail, exp]) => {
          setData(solo);
          setBookings(detail);
          setExpenses(exp);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [period]);

  // Derive locally so edits/deletes in XarajatlarModal update cards instantly
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit     = (data?.revenue ?? 0) - totalExpenses;
  const netColor      = netProfit >= 0 ? "text-green-400" : "text-red-400";

  if (loading) return <SkeletonKPI />;
  if (!data) return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      Ma'lumot yuklanmadi
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ClickableKpiCard
          index={0} emoji="💰" label="Daromad"
          value={fmtFull(data.revenue)}
          onClick={() => setActiveModal("daromad")}
        />
        <ClickableKpiCard
          index={1} emoji="👥" label="Mijozlar"
          value={`${data.clients} ta`}
          onClick={() => setActiveModal("mijozlar")}
        />
        <ClickableKpiCard
          index={2} emoji="💸" label="Xarajatlar"
          value={fmtFull(totalExpenses)}
          valueColor="text-red-400"
          onClick={() => setActiveModal("xarajatlar")}
        />
        <ClickableKpiCard
          index={3} emoji="📈" label="Sof foyda"
          value={fmtFull(Math.abs(netProfit))}
          valueColor={netColor}
          sub={netProfit < 0 ? "Zarar" : undefined}
          subColor="text-red-400"
          onClick={() => setActiveModal("sof-foyda")}
        />
      </div>

      <AnimatePresence>
        {activeModal === "daromad" && (
          <DaromadModal
            data={data}
            bookings={bookings}
            onClose={() => setActiveModal(null)}
          />
        )}
        {activeModal === "mijozlar" && (
          <MijozlarModal
            bookings={bookings}
            onClose={() => setActiveModal(null)}
          />
        )}
        {activeModal === "xarajatlar" && (
          <XarajatlarModal
            expenses={expenses}
            onExpensesChange={setExpenses}
            onClose={() => setActiveModal(null)}
          />
        )}
        {activeModal === "sof-foyda" && (
          <SofFoydaModal
            data={data}
            totalExpenses={totalExpenses}
            netProfit={netProfit}
            period={period}
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── JAMOA MODE UI ─────────────────────────────────────────────────────────────

function JamoaAnalytics({ period }: { period: Period }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTeam(PERIOD_API[period])
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <SkeletonKPI />;
  if (!data) return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      Ma'lumot yuklanmadi
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ClickableKpiCard index={0} emoji="💰" label="Umumiy daromad" value={fmtFull(data.revenue)} onClick={() => {}} />
        <ClickableKpiCard index={1} emoji="👥" label="Jami mijozlar"  value={`${data.clients} ta`}  onClick={() => {}} />
        <ClickableKpiCard index={2} emoji="❌" label="Bekor qilingan" value={`${data.cancelled} ta`} onClick={() => {}} />
        <ClickableKpiCard index={3} emoji="📅" label="Jami bronlar"   value={`${data.totalBookings} ta`} onClick={() => {}} />
      </div>

      {data.barbers.length > 0 && (
        <Section title="👨‍✂️ Ustalar statistikasi" index={1}>
          <div className="space-y-1">
            {data.barbers.map(b => (
              <Link key={b.id} href={`/settings/analytics/barber/${encodeURIComponent(b.id)}`}>
                <div className="flex items-center gap-3 py-3 px-1 rounded-xl hover:bg-white/4 cursor-pointer transition-all group">
                  <span className="text-lg w-7 shrink-0">{b.medal}</span>
                  <span className="font-semibold text-sm flex-1 text-foreground">{b.name}</span>
                  <span className="text-sm text-primary font-bold">{fmt(b.revenue)}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{b.clients} ta</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {(data.bestBarber || data.mostNoshow) && (
        <Section title="📈 Ko'rsatkich" index={2}>
          <div className="space-y-3">
            {data.bestBarber && (
              <div className="flex items-start gap-3">
                <span className="text-lg">🏆</span>
                <div>
                  <div className="text-xs text-muted-foreground">Eng yaxshi usta</div>
                  <div className="font-bold text-foreground">{data.bestBarber}</div>
                </div>
              </div>
            )}
            {data.bestBarber && data.mostNoshow && <div className="h-px bg-white/6" />}
            {data.mostNoshow && (
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="text-xs text-muted-foreground">Eng ko'p bekor qilish</div>
                  <div className="font-bold text-red-400">{data.mostNoshow}</div>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-5xl mb-4">📊</div>
      <div className="font-bold text-foreground mb-2">Hozircha ma'lumot yo'q</div>
      <div className="text-sm text-muted-foreground">
        Birinchi bronni qabul qiling
        <br />
        va statistikani ko'ring ✂️
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const [period, setPeriod] = useState<Period>("bugun");

  const isTeam = user?.mode === "team";

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">
          📊 Tahlil
        </h1>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} />

      {isLoading ? (
        <SkeletonKPI />
      ) : !user ? (
        <EmptyState />
      ) : isTeam ? (
        <JamoaAnalytics period={period} />
      ) : (
        <YakkaAnalytics period={period} />
      )}
    </Layout>
  );
}
