import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "bugun" | "hafta" | "oy";

const PERIOD_API: Record<Period, string> = {
  bugun: "today",
  hafta: "week",
  oy: "month",
};

interface BarberStats {
  barberId: string;
  name: string;
  revenue: number;
  clients: number;
  activeBookings: number;
  totalBookings: number;
  cancelled: number;
  noshow: number;
  topService: { name: string; count: number } | null;
  busiestTime: string;
  daily: { day: string; clients: number; revenue: number }[];
  tips: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

async function fetchBarberDetail(barberId: string, period: string): Promise<BarberStats> {
  const res = await fetch(`/api/analytics/barber/${encodeURIComponent(barberId)}?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
      <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ emoji, label, value, index }: { emoji: string; label: string; value: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      className="bg-card border border-white/6 rounded-2xl p-4"
    >
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-bold text-sm text-foreground">{value}</div>
    </motion.div>
  );
}

function Section({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07 }}
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

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: { barberId: string };
}

export default function AnalyticsBarberDetail({ params }: Props) {
  useAuth();
  const barberId = decodeURIComponent(params?.barberId ?? "");
  const [period, setPeriod] = useState<Period>("bugun");
  const [stats, setStats] = useState<BarberStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barberId) return;
    setLoading(true);
    fetchBarberDetail(barberId, PERIOD_API[period])
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [barberId, period]);

  const displayName = stats?.name ?? "Usta";

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings/analytics">
          <button className="flex items-center gap-1.5 h-10 px-3 rounded-2xl bg-card border border-white/8 hover:bg-white/5 transition-colors text-sm font-semibold">
            <ChevronLeft className="w-4 h-4" />
            Orqaga
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">
          📊 {displayName} — Tahlil
        </h1>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} />

      {loading ? (
        <Skeleton />
      ) : !stats ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Ma'lumot yuklanmadi
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard index={0} emoji="💰" label="Daromad" value={fmtFull(stats.revenue)} />
            <KpiCard index={1} emoji="👥" label="Mijozlar" value={`${stats.clients} ta`} />
            <KpiCard index={2} emoji="❌" label="Bekor" value={`${stats.cancelled} ta`} />
            <KpiCard index={3} emoji="📅" label="Jami bronlar" value={`${stats.totalBookings} ta`} />
          </div>

          {stats.topService && (
            <Section title="🏆 Faoliyat" index={1}>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Eng ko'p xizmat</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {stats.topService.name} — {stats.topService.count} ta
                  </div>
                </div>
                {stats.busiestTime !== "—" && (
                  <>
                    <div className="h-px bg-white/6" />
                    <div>
                      <div className="text-xs text-muted-foreground">Eng band vaqt</div>
                      <div className="font-bold text-foreground mt-0.5">🕒 {stats.busiestTime}</div>
                    </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {stats.daily.length > 0 && (
            <Section title="📅 Oxirgi kunlar" index={2}>
              <div className="space-y-1">
                {stats.daily.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground w-28">{d.day}</span>
                    <span className="text-sm text-foreground flex-1 text-center">{d.clients} mijoz</span>
                    <span className="text-sm font-semibold text-primary text-right">{fmtShort(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {stats.daily.length === 0 && (
            <Section title="📅 Oxirgi kunlar" index={2}>
              <div className="text-sm text-muted-foreground text-center py-4">
                Bu davr uchun ma'lumot yo'q
              </div>
            </Section>
          )}

          <Section title="💡 Tavsiyalar" index={3}>
            <ul className="space-y-2">
              {stats.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </Layout>
  );
}
