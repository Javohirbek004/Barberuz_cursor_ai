import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, X, Loader2, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "bugun" | "hafta" | "oy";

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
  return n.toLocaleString("uz-UZ") + " so'm";
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

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

async function fetchExpenses(period: string): Promise<Expense[]> {
  const res = await fetch(`/api/expenses?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.expenses ?? [];
}

async function deleteExpense(id: string): Promise<void> {
  await fetch(`/api/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

async function updateExpense(id: string, payload: Partial<Pick<Expense, "title" | "amount" | "category">>): Promise<void> {
  await fetch(`/api/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload),
  });
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
      <div className="h-28 rounded-2xl bg-white/5 animate-pulse" />
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  emoji, label, value, sub, subColor, index,
}: {
  emoji: string; label: string; value: string;
  sub?: string; subColor?: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      className="bg-card border border-white/6 rounded-2xl p-4"
    >
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-bold text-base text-foreground leading-tight">{value}</div>
      {sub && (
        <div className={`text-xs mt-0.5 font-semibold ${subColor ?? "text-muted-foreground"}`}>{sub}</div>
      )}
    </motion.div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────

function Section({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
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

// ── Expense edit modal ─────────────────────────────────────────────────────────

function ExpenseEditModal({
  expense,
  onClose,
  onSaved,
}: {
  expense: Expense;
  onClose: () => void;
  onSaved: (updated: Expense) => void;
}) {
  const [title, setTitle]     = useState(expense.title);
  const [amount, setAmount]   = useState(expense.amount);
  const [saving, setSaving]   = useState(false);

  async function handleSave() {
    if (!title.trim() || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await updateExpense(expense.id, { title: title.trim(), amount });
      onSaved({ ...expense, title: title.trim(), amount });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm bg-[#18181d] rounded-3xl border border-white/8 p-6 z-10 shadow-2xl space-y-4"
        initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">✏️ Xarajatni tahrirlash</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nomi</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full h-11 px-3 rounded-2xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Miqdor (so'm)</label>
          <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full h-11 px-3 rounded-2xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button onClick={onClose}
            className="py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all">
            Bekor
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim() || Number(amount) <= 0}
            className="py-3 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Saqlash
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── YAKKA MODE UI ─────────────────────────────────────────────────────────────

function YakkaAnalytics({ period }: { period: Period }) {
  const [data, setData]             = useState<SoloData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setExpLoading(true);
    const apiPeriod = PERIOD_API[period];
    fetchSolo(apiPeriod)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    fetchExpenses(apiPeriod)
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setExpLoading(false));
  }, [period]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <SkeletonKPI />;
  if (!data) return (
    <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
  );

  const netColor = data.netProfit >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Daromad" value={fmtFull(data.revenue)} />
        <KpiCard index={1} emoji="👥" label="Mijozlar" value={`${data.clients} ta`} />
        <KpiCard index={2} emoji="💸" label="Xarajatlar" value={fmtFull(data.totalExpenses ?? 0)} subColor="text-red-400" />
        <KpiCard index={3} emoji="📈" label="Sof foyda" value={fmtFull(data.netProfit ?? 0)} subColor={netColor} />
      </div>

      {/* Expense history */}
      <Section title="💸 Xarajatlar tarixi" index={1}>
        {expLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Xarajatlar yo'q</div>
        ) : (
          <div className="space-y-1">
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-2 py-2.5 px-1 rounded-xl group hover:bg-white/4 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{exp.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{exp.category} · {exp.date}</div>
                </div>
                <div className="text-sm font-bold text-red-400 tabular-nums shrink-0">
                  −{Number(exp.amount).toLocaleString()}
                </div>
                <button onClick={() => setEditingExp(exp)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground transition-all text-xs">
                  ✏️
                </button>
                <button onClick={() => handleDelete(exp.id)} disabled={deletingId === exp.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all disabled:opacity-30">
                  {deletingId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-xs">🗑️</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {data.topService && (
        <Section title="🏆 Faoliyat" index={2}>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Eng ko'p xizmat</div>
                <div className="font-bold text-foreground mt-0.5">
                  {data.topService.name} — {data.topService.count} ta
                </div>
                <div className="text-xs text-primary mt-0.5">
                  💰 {fmtFull(data.topService.revenue)}
                </div>
              </div>
            </div>
            {data.busiestTime !== "—" && (
              <>
                <div className="h-px bg-white/6" />
                <div>
                  <div className="text-xs text-muted-foreground">Eng band vaqt</div>
                  <div className="font-bold text-foreground mt-0.5">🕒 {data.busiestTime}</div>
                </div>
              </>
            )}
          </div>
        </Section>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editingExp && (
          <ExpenseEditModal
            expense={editingExp}
            onClose={() => setEditingExp(null)}
            onSaved={updated => {
              setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
              setEditingExp(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
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
    <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Umumiy daromad" value={fmtFull(data.revenue)} />
        <KpiCard index={1} emoji="👥" label="Jami mijozlar" value={`${data.clients} ta`} />
        <KpiCard index={2} emoji="❌" label="Bekor qilingan" value={`${data.cancelled} ta`} />
        <KpiCard index={3} emoji="📅" label="Jami bronlar" value={`${data.totalBookings} ta`} />
      </div>

      {data.barbers.length > 0 && (
        <Section title="👨‍✂️ Ustalar statistikasi" index={1}>
          <div className="space-y-1">
            {data.barbers.map((b) => (
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
        Birinchi bronni qabul qiling<br />va statistikani ko'ring ✂️
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
        <h1 className="text-xl font-display font-bold text-foreground">📊 Tahlil</h1>
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
