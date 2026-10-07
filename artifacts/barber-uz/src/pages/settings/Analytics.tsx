import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Loader2,
  Wallet, Users, Receipt, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientsAnalyticsSheet } from "@/pages/settings/ClientsAnalyticsSheet";
import { IncomeAnalyticsSheet } from "@/pages/settings/IncomeAnalyticsSheet";
import { ExpensesAnalyticsSheet } from "@/pages/settings/ExpensesAnalyticsSheet";

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

const PERIOD_COMPARE_LABEL: Record<Period, string> = {
  bugun: "Kechaga nisbatan",
  hafta: "O'tgan haftaga nisbatan",
  oy: "O'tgan oyga nisbatan",
};

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

async function fetchExpenses(period: string): Promise<Expense[]> {
  const res = await fetch(`/api/expenses?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.expenses ?? [];
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

function PeriodFilter({
  period,
  onChange,
  className = "mb-6",
}: {
  period: Period;
  onChange: (p: Period) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 bg-card p-1 rounded-2xl border border-white/6 ${className}`}>
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

// ── Entry card (icon + title + hint, whole card opens its sheet) ───────────────

const ENTRY_TONES: Record<string, { box: string; icon: string }> = {
  amber: { box: "bg-amber-400/10 border-amber-400/20", icon: "text-amber-400" },
  blue: { box: "bg-sky-400/10 border-sky-400/20", icon: "text-sky-400" },
  red: { box: "bg-red-400/10 border-red-400/20", icon: "text-red-400" },
  green: { box: "bg-emerald-400/10 border-emerald-400/20", icon: "text-emerald-400" },
};

function AnalyticsEntryCard({
  icon: Icon,
  title,
  tone,
  index,
  testId,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  tone: keyof typeof ENTRY_TONES;
  index: number;
  testId: string;
  onClick: () => void;
}) {
  const t = ENTRY_TONES[tone];
  return (
    <motion.button
      type="button"
      data-testid={testId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="bg-card border border-white/6 rounded-2xl p-4 text-left w-full min-h-[132px] flex flex-col justify-between hover:bg-white/4 active:bg-white/6 transition-colors"
    >
      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${t.box}`}>
        <Icon className={`w-5 h-5 ${t.icon}`} />
      </div>
      <div>
        <div className="font-display font-bold text-base text-foreground">{title}</div>
        <div className="text-xs text-primary/80 font-medium mt-1">Tahlilni ko'rish ➔</div>
      </div>
    </motion.button>
  );
}

function SheetSpinner() {
  return (
    <div className="flex justify-center py-16" data-testid="sheet-spinner">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
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

// ── Sof Foyda Modal ───────────────────────────────────────────────────────────

function SofFoydaModal({
  data,
  totalExpenses,
  netProfit,
  period,
  onPeriodChange,
  loading,
  onClose,
}: {
  data: SoloData | null;
  totalExpenses: number;
  netProfit: number;
  period: Period;
  onPeriodChange: (p: Period) => void;
  loading: boolean;
  onClose: () => void;
}) {
  const revenue = data?.revenue ?? 0;
  const revChange = data?.revChange ?? 0;
  const profitMargin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
  const netPositive = netProfit >= 0;
  const netColor = netPositive ? "text-green-400" : "text-red-400";
  const netBg = netPositive
    ? "bg-green-500/8 border-green-500/20"
    : "bg-red-500/8 border-red-500/20";
  const trendSign = revChange > 0 ? "+" : "";
  const trendColor =
    revChange > 0
      ? "text-green-400"
      : revChange < 0
        ? "text-red-400"
        : "text-muted-foreground";

  return (
    <BottomSheet title="📈 Sof foyda tahlili" onClose={onClose}>
      <PeriodFilter period={period} onChange={onPeriodChange} className="mb-4" />
      {loading || !data ? (
        <SheetSpinner />
      ) : (
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
              {trendSign}{revChange}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {PERIOD_COMPARE_LABEL[period]}
            </div>
          </div>
        </div>
      </div>
      )}
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

function YakkaAnalytics() {
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  // Each money sheet has its own Bugun / Hafta / Oy tabs; the cards themselves show no numbers.
  const [period, setPeriod]     = useState<Period>("bugun");
  const [data, setData]         = useState<SoloData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(false);

  const moneySheetOpen = activeModal === "sof-foyda";

  // Load figures only while a money sheet is open, and again when its period changes.
  useEffect(() => {
    if (!moneySheetOpen) return;
    let cancelled = false;
    setLoading(true);
    const apiPeriod = PERIOD_API[period];
    Promise.all([
      fetchSolo(apiPeriod),
      fetchExpenses(apiPeriod),
    ])
      .then(([solo, exp]) => {
        if (cancelled) return;
        setData(solo);
        setExpenses(exp);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moneySheetOpen, period]);

  // Sof foyda uses the expenses loaded for its own period tabs.
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit     = (data?.revenue ?? 0) - totalExpenses;
  const close = () => setActiveModal(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3" data-testid="analytics-cards">
        <AnalyticsEntryCard
          index={0} icon={Wallet} tone="amber" title="Daromad"
          testId="card-daromad" onClick={() => setActiveModal("daromad")}
        />
        <AnalyticsEntryCard
          index={1} icon={Users} tone="blue" title="Mijozlar"
          testId="card-mijozlar" onClick={() => setActiveModal("mijozlar")}
        />
        <AnalyticsEntryCard
          index={2} icon={Receipt} tone="red" title="Xarajatlar"
          testId="card-xarajatlar" onClick={() => setActiveModal("xarajatlar")}
        />
        <AnalyticsEntryCard
          index={3} icon={TrendingUp} tone="green" title="Sof foyda"
          testId="card-sof-foyda" onClick={() => setActiveModal("sof-foyda")}
        />
      </div>

      <AnimatePresence>
        {activeModal === "daromad" && (
          <IncomeAnalyticsSheet key="daromad" onClose={close} />
        )}
        {activeModal === "mijozlar" && (
          <ClientsAnalyticsSheet key="mijozlar" onClose={close} />
        )}
        {activeModal === "xarajatlar" && (
          <ExpensesAnalyticsSheet key="xarajatlar" onClose={close} />
        )}
        {activeModal === "sof-foyda" && (
          <SofFoydaModal
            key="sof-foyda"
            data={data}
            totalExpenses={totalExpenses}
            netProfit={netProfit}
            period={period}
            onPeriodChange={setPeriod}
            loading={loading}
            onClose={close}
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
    <Layout hideBottomNav>
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

      {/* Team mode keeps its page-level filter; solo mode picks the period inside each sheet. */}
      {isTeam && <PeriodFilter period={period} onChange={setPeriod} />}

      {isLoading ? (
        <SkeletonKPI />
      ) : !user ? (
        <EmptyState />
      ) : isTeam ? (
        <JamoaAnalytics period={period} />
      ) : (
        <YakkaAnalytics />
      )}
    </Layout>
  );
}
