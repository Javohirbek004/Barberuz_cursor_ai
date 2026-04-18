import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

// ── Mock data per barber ──────────────────────────────────────────────────────

type BarberStats = {
  revenue: number;
  clients: number;
  cancelled: number;
  noshow: number;
  topService: { name: string; count: number };
  busiestTime: string;
  traffic: { source: string; visits: number; bookings: number }[];
  daily: { day: string; clients: number; revenue: number }[];
  tips: string[];
};

const BARBER_MOCK: Record<string, BarberStats> = {
  Sardor: {
    revenue: 2_000_000, clients: 20, cancelled: 2, noshow: 1,
    topService: { name: "Fade", count: 10 },
    busiestTime: "17:00 – 20:00",
    traffic: [
      { source: "QR", visits: 12, bookings: 6 },
      { source: "Link", visits: 18, bookings: 7 },
      { source: "Direct", visits: 5, bookings: 2 },
    ],
    daily: [
      { day: "Dushanba", clients: 4, revenue: 400_000 },
      { day: "Seshanba", clients: 3, revenue: 300_000 },
      { day: "Chorshanba", clients: 5, revenue: 500_000 },
      { day: "Payshanba", clients: 4, revenue: 400_000 },
      { day: "Juma", clients: 4, revenue: 400_000 },
    ],
    tips: [
      "Kechki vaqtlar juda samarali",
      "No-show past — yaxshi natija",
      "Fade eng daromadli xizmat",
    ],
  },
  Javohir: {
    revenue: 1_800_000, clients: 18, cancelled: 3, noshow: 2,
    topService: { name: "Classic", count: 9 },
    busiestTime: "16:00 – 19:00",
    traffic: [
      { source: "QR", visits: 10, bookings: 5 },
      { source: "Link", visits: 15, bookings: 6 },
      { source: "Direct", visits: 4, bookings: 2 },
    ],
    daily: [
      { day: "Dushanba", clients: 3, revenue: 300_000 },
      { day: "Seshanba", clients: 4, revenue: 400_000 },
      { day: "Chorshanba", clients: 4, revenue: 400_000 },
      { day: "Payshanba", clients: 3, revenue: 300_000 },
      { day: "Juma", clients: 4, revenue: 400_000 },
    ],
    tips: [
      "Classic xizmat talab yuqori",
      "Trafik muvozanatlangan",
      "No-show kamaytirish mumkin",
    ],
  },
  Ali: {
    revenue: 1_200_000, clients: 14, cancelled: 4, noshow: 3,
    topService: { name: "Beard trim", count: 7 },
    busiestTime: "15:00 – 18:00",
    traffic: [
      { source: "QR", visits: 8, bookings: 3 },
      { source: "Link", visits: 12, bookings: 4 },
      { source: "Direct", visits: 6, bookings: 2 },
    ],
    daily: [
      { day: "Dushanba", clients: 2, revenue: 200_000 },
      { day: "Seshanba", clients: 3, revenue: 300_000 },
      { day: "Chorshanba", clients: 3, revenue: 300_000 },
      { day: "Payshanba", clients: 3, revenue: 200_000 },
      { day: "Juma", clients: 3, revenue: 200_000 },
    ],
    tips: [
      "No-show yuqori — eslatma yuboring",
      "Kechki vaqtlar bo'sh qolmoqda",
      "QR trafik oshirilishi mumkin",
    ],
  },
};

const DEFAULT_STATS: BarberStats = BARBER_MOCK["Sardor"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
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

function TrafficRow({ source, visits, bookings }: { source: string; visits: number; bookings: number }) {
  const pct = Math.round((bookings / visits) * 100);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground w-14">{source}</span>
      <div className="flex-1 mx-3">
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-24 text-right">
        {visits} → <span className="text-foreground font-semibold">{bookings} bron</span>
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: { name: string };
}

export default function AnalyticsBarberDetail({ params }: Props) {
  useAuth();
  const name = decodeURIComponent(params?.name ?? "Sardor");
  const stats = BARBER_MOCK[name] ?? DEFAULT_STATS;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings/analytics">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">
          📊 {name} — Tahlil
        </h1>
      </div>

      <div className="space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard index={0} emoji="💰" label="Daromad" value={fmtFull(stats.revenue)} />
          <KpiCard index={1} emoji="👥" label="Mijozlar" value={`${stats.clients} ta`} />
          <KpiCard index={2} emoji="❌" label="Bekor" value={`${stats.cancelled} ta`} />
          <KpiCard index={3} emoji="🔴" label="Kelmadi" value={`${stats.noshow} ta`} />
        </div>

        {/* Faoliyat */}
        <Section title="🏆 Faoliyat" index={1}>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Eng ko'p xizmat</div>
              <div className="font-bold text-foreground mt-0.5">
                {stats.topService.name} — {stats.topService.count} ta
              </div>
            </div>
            <div className="h-px bg-white/6" />
            <div>
              <div className="text-xs text-muted-foreground">Eng band vaqt</div>
              <div className="font-bold text-foreground mt-0.5">🕒 {stats.busiestTime}</div>
            </div>
          </div>
        </Section>

        {/* Trafik */}
        <Section title="🚀 Trafik" index={2}>
          {stats.traffic.map(t => (
            <TrafficRow key={t.source} source={t.source} visits={t.visits} bookings={t.bookings} />
          ))}
        </Section>

        {/* Kunlik faollik */}
        <Section title="📅 Oxirgi kunlar" index={3}>
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

        {/* Tavsiyalar */}
        <Section title="💡 Tavsiyalar" index={4}>
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
    </Layout>
  );
}
