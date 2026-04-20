import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
  clients: number;
  activeBookings: number;
  totalBookings: number;
  cancelled: number;
  noshow: number;
  topService: { name: string; count: number; revenue: number } | null;
  busiestTime: string;
  tips: string[];
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

// ── YAKKA MODE UI ─────────────────────────────────────────────────────────────

function YakkaAnalytics({ period }: { period: Period }) {
  const [data, setData] = useState<SoloData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSolo(PERIOD_API[period])
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <SkeletonKPI />;
  if (!data) return (
    <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
  );

  const revSign = data.revChange > 0 ? "+" : "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Daromad" value={fmtFull(data.revenue)}
          sub={`${revSign}${data.revChange}%`}
          subColor={data.revChange >= 0 ? "text-emerald-400" : "text-red-400"} />
        <KpiCard index={1} emoji="👥" label="Mijozlar" value={`${data.clients} ta`} />
        <KpiCard index={2} emoji="❌" label="Bekor qilingan" value={`${data.cancelled} ta`} subColor="text-red-400" />
        <KpiCard index={3} emoji="📅" label="Bronlar" value={`${data.totalBookings} ta`} />
      </div>

      {data.topService && (
        <Section title="🏆 Faoliyat" index={1}>
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

      <Section title="💡 Tavsiyalar" index={2}>
        <ul className="space-y-2">
          {data.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </Section>
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

  const revSign = data.revChange > 0 ? "+" : "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Umumiy daromad" value={fmtFull(data.revenue)}
          sub={`${revSign}${data.revChange}%`}
          subColor={data.revChange >= 0 ? "text-emerald-400" : "text-red-400"} />
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

      <Section title="💡 Tavsiyalar" index={3}>
        <ul className="space-y-2">
          {data.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </Section>
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
