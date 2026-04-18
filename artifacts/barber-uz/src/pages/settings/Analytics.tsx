import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "bugun" | "hafta" | "oy";

// ── Mock data — Yakka (solo) ───────────────────────────────────────────────────

const SOLO_DATA: Record<Period, {
  revenue: number; revChange: number;
  clients: number; cancelled: number; noshow: number;
  topService: { name: string; count: number; revenue: number };
  busiestTime: string;
  traffic: { source: string; visits: number; bookings: number }[];
  convIn: number; convBook: number;
  tips: string[];
}> = {
  bugun: {
    revenue: 1_200_000, revChange: 12,
    clients: 18, cancelled: 3, noshow: 2,
    topService: { name: "Fade", count: 12, revenue: 600_000 },
    busiestTime: "18:00 – 20:00",
    traffic: [
      { source: "QR", visits: 8, bookings: 4 },
      { source: "Link", visits: 14, bookings: 6 },
      { source: "Direct", visits: 5, bookings: 2 },
    ],
    convIn: 27, convBook: 12,
    tips: [
      "Kechki vaqtlar eng foydali",
      "QR orqali mijozlar faol",
      "No-show biroz yuqori",
    ],
  },
  hafta: {
    revenue: 6_400_000, revChange: 8,
    clients: 94, cancelled: 11, noshow: 7,
    topService: { name: "Fade", count: 58, revenue: 2_900_000 },
    busiestTime: "17:00 – 20:00",
    traffic: [
      { source: "QR", visits: 42, bookings: 21 },
      { source: "Link", visits: 70, bookings: 28 },
      { source: "Direct", visits: 22, bookings: 9 },
    ],
    convIn: 134, convBook: 58,
    tips: [
      "Shanba kunlari eng band",
      "Link orqali trafik o'sgan",
      "No-show nazoratga olinsin",
    ],
  },
  oy: {
    revenue: 24_500_000, revChange: 15,
    clients: 380, cancelled: 42, noshow: 28,
    topService: { name: "Fade", count: 210, revenue: 10_500_000 },
    busiestTime: "17:00 – 20:00",
    traffic: [
      { source: "QR", visits: 180, bookings: 90 },
      { source: "Link", visits: 290, bookings: 110 },
      { source: "Direct", visits: 85, bookings: 34 },
    ],
    convIn: 555, convBook: 234,
    tips: [
      "Oylik daromad o'sishda",
      "Fade eng daromadli xizmat",
      "No-show kamaytirish kerak",
    ],
  },
};

// ── Mock data — Jamoa (team) ───────────────────────────────────────────────────

const TEAM_DATA: Record<Period, {
  revenue: number; revChange: number;
  clients: number; cancelled: number; noshow: number;
  barbers: { name: string; medal: string; revenue: number; clients: number }[];
  bestBarber: string; mostNoshow: string;
  traffic: { source: string; visits: number; bookings: number }[];
  tips: string[];
}> = {
  bugun: {
    revenue: 5_800_000, revChange: 10,
    clients: 64, cancelled: 8, noshow: 6,
    barbers: [
      { name: "Sardor", medal: "🥇", revenue: 2_000_000, clients: 20 },
      { name: "Javohir", medal: "🥈", revenue: 1_800_000, clients: 18 },
      { name: "Ali", medal: "🥉", revenue: 1_200_000, clients: 14 },
    ],
    bestBarber: "Sardor",
    mostNoshow: "Ali",
    traffic: [
      { source: "QR", visits: 40, bookings: 20 },
      { source: "Link", visits: 90, bookings: 18 },
    ],
    tips: [
      "Sardor eng yaxshi ishlayapti",
      "Ali'da no-show yuqori",
      "QR marketing yaxshi ishlayapti",
    ],
  },
  hafta: {
    revenue: 32_000_000, revChange: 7,
    clients: 340, cancelled: 38, noshow: 26,
    barbers: [
      { name: "Sardor", medal: "🥇", revenue: 12_000_000, clients: 130 },
      { name: "Javohir", medal: "🥈", revenue: 11_000_000, clients: 118 },
      { name: "Ali", medal: "🥉", revenue: 8_000_000, clients: 92 },
    ],
    bestBarber: "Sardor",
    mostNoshow: "Ali",
    traffic: [
      { source: "QR", visits: 220, bookings: 110 },
      { source: "Link", visits: 480, bookings: 96 },
    ],
    tips: [
      "Haftalik daromad o'sishda",
      "Ali'da no-show nazorat qilinsin",
      "QR kampaniya davom ettirilsin",
    ],
  },
  oy: {
    revenue: 128_000_000, revChange: 13,
    clients: 1_380, cancelled: 148, noshow: 102,
    barbers: [
      { name: "Sardor", medal: "🥇", revenue: 48_000_000, clients: 520 },
      { name: "Javohir", medal: "🥈", revenue: 44_000_000, clients: 480 },
      { name: "Ali", medal: "🥉", revenue: 32_000_000, clients: 380 },
    ],
    bestBarber: "Sardor",
    mostNoshow: "Ali",
    traffic: [
      { source: "QR", visits: 900, bookings: 450 },
      { source: "Link", visits: 1_900, bookings: 380 },
    ],
    tips: [
      "Oylik rekord daromad",
      "Sardor barbershopni olib borayapti",
      "No-show tizimi joriy qilinsin",
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} 000`;
  return String(n);
}

function fmtFull(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
      ))}
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

// ── Traffic row ────────────────────────────────────────────────────────────────

function TrafficRow({ source, visits, bookings }: { source: string; visits: number; bookings: number }) {
  const pct = Math.round((bookings / visits) * 100);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground w-14">{source}</span>
      <div className="flex-1 mx-3">
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-24 text-right">
        {visits} → <span className="text-foreground font-semibold">{bookings} bron</span>
      </span>
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

// ── YAKKA MODE UI ─────────────────────────────────────────────────────────────

function YakkaAnalytics({ period }: { period: Period }) {
  const d = SOLO_DATA[period];
  const convPct = Math.round((d.convBook / d.convIn) * 100);

  return (
    <div className="space-y-4">
      {/* KPI 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Daromad" value={fmtFull(d.revenue)}
          sub={`↑ +${d.revChange}%`} subColor="text-emerald-400" />
        <KpiCard index={1} emoji="👥" label="Mijozlar" value={`${d.clients} ta`} />
        <KpiCard index={2} emoji="❌" label="Bekor qilingan" value={`${d.cancelled} ta`} subColor="text-red-400" />
        <KpiCard index={3} emoji="🔴" label="Kelmadi" value={`${d.noshow} ta`} subColor="text-red-400" />
      </div>

      {/* Faoliyat */}
      <Section title="🏆 Faoliyat" index={1}>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Eng ko'p xizmat</div>
              <div className="font-bold text-foreground mt-0.5">{d.topService.name} — {d.topService.count} ta</div>
              <div className="text-xs text-primary mt-0.5">💰 {fmtFull(d.topService.revenue)}</div>
            </div>
          </div>
          <div className="h-px bg-white/6" />
          <div>
            <div className="text-xs text-muted-foreground">Eng band vaqt</div>
            <div className="font-bold text-foreground mt-0.5">🕒 {d.busiestTime}</div>
          </div>
        </div>
      </Section>

      {/* Trafik */}
      <Section title="🚀 Trafik" index={2}>
        {d.traffic.map(t => (
          <TrafficRow key={t.source} source={t.source} visits={t.visits} bookings={t.bookings} />
        ))}
      </Section>

      {/* Konversiya */}
      <Section title="🎯 Bron konversiya" index={3}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Kirish:</span>
              <span className="font-semibold">{d.convIn}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Bron:</span>
              <span className="font-semibold">{d.convBook}</span>
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-primary">{convPct}%</div>
        </div>
      </Section>

      {/* Tavsiyalar */}
      <Section title="💡 Tavsiyalar" index={4}>
        <ul className="space-y-2">
          {d.tips.map((tip, i) => (
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
  const d = TEAM_DATA[period];

  return (
    <div className="space-y-4">
      {/* KPI 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard index={0} emoji="💰" label="Umumiy daromad" value={fmtFull(d.revenue)}
          sub={`↑ +${d.revChange}%`} subColor="text-emerald-400" />
        <KpiCard index={1} emoji="👥" label="Jami mijozlar" value={`${d.clients} ta`} />
        <KpiCard index={2} emoji="❌" label="Bekor qilingan" value={`${d.cancelled} ta`} />
        <KpiCard index={3} emoji="🔴" label="Kelmadi" value={`${d.noshow} ta`} />
      </div>

      {/* Ustalar statistikasi */}
      <Section title="👨‍✂️ Ustalar statistikasi" index={1}>
        <div className="space-y-1">
          {d.barbers.map((b) => (
            <Link key={b.name} href={`/settings/analytics/barber/${encodeURIComponent(b.name)}`}>
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

      {/* Ko'rsatkich */}
      <Section title="📈 Ko'rsatkich" index={2}>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg">🏆</span>
            <div>
              <div className="text-xs text-muted-foreground">Eng yaxshi usta</div>
              <div className="font-bold text-foreground">{d.bestBarber}</div>
            </div>
          </div>
          <div className="h-px bg-white/6" />
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-xs text-muted-foreground">Eng ko'p no-show</div>
              <div className="font-bold text-red-400">{d.mostNoshow}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Trafik */}
      <Section title="🚀 Trafik" index={3}>
        {d.traffic.map(t => (
          <TrafficRow key={t.source} source={t.source} visits={t.visits} bookings={t.bookings} />
        ))}
      </Section>

      {/* Tavsiyalar */}
      <Section title="💡 Tavsiyalar" index={4}>
        <ul className="space-y-2">
          {d.tips.map((tip, i) => (
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">📊 Tahlil</h1>
      </div>

      {/* Period filter */}
      <PeriodFilter period={period} onChange={setPeriod} />

      {/* Content */}
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
