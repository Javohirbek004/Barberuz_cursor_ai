import { Link } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useGetDashboardStats, useListBookings } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import {
  CalendarDays,
  Wallet,
  Timer,
  Smartphone,
  HardHat,
  Armchair,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

// ── Uzbek date formatter ──────────────────────────────────────────────────────
const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const UZ_DAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const RU_MONTHS = [
  "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
  "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
];
const RU_DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function formatDateLocale(lang: string): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const weekday = now.getDay();
  if (lang === "ru") return `${day} ${RU_MONTHS[month]}, ${RU_DAYS[weekday]}`;
  return `${day}-${UZ_MONTHS[month]}, ${UZ_DAYS[weekday]}`;
}

// ── Static barbers for team view (until real barbers API exists) ──────────────
const TEAM_BARBERS = [
  { id: "1", name: "Ali Karimov",    bookings: 4, active: true  },
  { id: "2", name: "Sardor Yusupov", bookings: 5, active: true  },
  { id: "3", name: "Jasur Toshev",   bookings: 0, active: true  },
  { id: "4", name: "Bobur Mirzayev", bookings: 0, active: false },
];

// ── Mock bookings shown when API returns empty ────────────────────────────────
const MOCK_INDIVIDUAL_BOOKINGS = [
  { id: "m1", time: "14:00", client: "Aziz",    service: "Haircut" },
  { id: "m2", time: "15:00", client: "Jamshid", service: "Fade"    },
  { id: "m3", time: "16:30", client: "Olim",    service: "Soqol"   },
];

const MOCK_TEAM_BOOKINGS = [
  { id: "t1", time: "14:30", client: "Aziz",    service: "Soch oldirish", barber: "Sardor barber" },
  { id: "t2", time: "15:30", client: "Jamshid", service: "Fade",          barber: "Jasur barber"  },
  { id: "t3", time: "17:00", client: "Olim",    service: "Soqol",         barber: "Kamol barber"  },
];

// ── Stat card component ───────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  loading?: boolean;
  delay?: number;
}

function StatCard({ label, value, icon: Icon, iconColor, loading, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="p-4 bg-card/50 backdrop-blur border-white/5 hover:border-white/10 transition-colors h-full">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg bg-white/5 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-medium text-muted-foreground leading-tight">{label}</h3>
        </div>
        <div className="text-2xl font-display font-bold text-foreground">
          {loading ? <span className="text-muted-foreground text-base">...</span> : value}
        </div>
      </Card>
    </motion.div>
  );
}

// ── Individual Barber Dashboard ───────────────────────────────────────────────
function IndividualDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const today = new Date().toISOString().split("T")[0];
  const { data: bookingsData, isLoading: bookingsLoading } = useListBookings({ date: today });

  const bookings = bookingsData?.bookings ?? [];
  const upcomingBookings = bookings
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalSlots = 18;
  const busySlots = (stats?.todayBookings ?? 0);
  const freeSlots = Math.max(0, totalSlots - busySlots);

  const statCards: StatCardProps[] = [
    {
      label: t("dash.today_bookings"),
      value: stats?.todayBookings ?? 0,
      icon: CalendarDays,
      iconColor: "text-amber-400",
      loading: statsLoading,
      delay: 0,
    },
    {
      label: t("dash.today_revenue"),
      value: `${(stats?.todayRevenue ?? 0).toLocaleString()} UZS`,
      icon: Wallet,
      iconColor: "text-emerald-400",
      loading: statsLoading,
      delay: 0.05,
    },
    {
      label: t("dash.free_slots"),
      value: `${freeSlots}${t("dash.slots_unit") ? " " + t("dash.slots_unit") : ""}`,
      icon: Timer,
      iconColor: "text-blue-400",
      loading: statsLoading,
      delay: 0.1,
    },
    {
      label: t("dash.visits"),
      value: stats?.totalClients ?? 0,
      icon: Smartphone,
      iconColor: "text-violet-400",
      loading: statsLoading,
      delay: 0.15,
    },
  ];

  const statusLabel = (status: string) => {
    if (status === "confirmed") return t("status.confirmed");
    if (status === "pending") return t("status.pending");
    return t("status.completed");
  };

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Upcoming bookings */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t("dash.recent_bookings")}
        </h2>

        {bookingsLoading ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            {t("loading")}
          </p>
        ) : upcomingBookings.length > 0 ? (
          <div className="space-y-2">
            {upcomingBookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="px-4 py-3 bg-card border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary font-bold flex-shrink-0">
                    <span className="text-sm leading-none">{b.startTime.slice(0, 5).split(":")[0]}</span>
                    <span className="text-xs opacity-70">:{b.startTime.slice(0, 5).split(":")[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{b.clientName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.serviceName || t("dash.service_fallback")}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-primary">
                      {b.price.toLocaleString()} UZS
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold
                        ${b.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : b.status === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-white/10 text-white/60"
                        }`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {MOCK_INDIVIDUAL_BOOKINGS.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="px-4 py-3 bg-card border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {b.time}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{b.client}</div>
                    <div className="text-xs text-muted-foreground truncate">{b.service}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}

// ── Team / Salon Dashboard ────────────────────────────────────────────────────
function TeamDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  const activeBarbers = TEAM_BARBERS.filter((b) => b.active);
  const busyBarbers  = activeBarbers.filter((b) => b.bookings > 0).length;
  const freeBarbers  = activeBarbers.filter((b) => b.bookings === 0).length;

  const statCards: StatCardProps[] = [
    {
      label: t("dash.team_bookings"),
      value: stats?.todayBookings ?? 0,
      icon: CalendarDays,
      iconColor: "text-amber-400",
      loading: statsLoading,
      delay: 0,
    },
    {
      label: t("dash.team_revenue"),
      value: `${(stats?.todayRevenue ?? 0).toLocaleString()} UZS`,
      icon: Wallet,
      iconColor: "text-emerald-400",
      loading: statsLoading,
      delay: 0.05,
    },
    {
      label: t("dash.busy_slots"),
      value: busyBarbers,
      icon: HardHat,
      iconColor: "text-orange-400",
      delay: 0.1,
    },
    {
      label: t("dash.active_barbers"),
      value: freeBarbers,
      icon: Armchair,
      iconColor: "text-blue-400",
      delay: 0.15,
    },
  ];

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Team status list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t("dash.barber_status")}
        </h2>
        <div className="space-y-2">
          {TEAM_BARBERS.map((barber) => (
            <Link key={barber.id} href={`/calendar?barber=${barber.id}`}>
              <Card className="px-4 py-3 bg-card border-white/5 flex items-center gap-3 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    !barber.active
                      ? "bg-white/20"
                      : barber.bookings > 0
                      ? "bg-red-500"
                      : "bg-green-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground text-sm">{barber.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {barber.bookings > 0 ? `${barber.bookings} ${t("dash.bookings_unit")}` : ""}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      !barber.active
                        ? "bg-white/10 text-white/40"
                        : barber.bookings > 0
                        ? "bg-red-500/10 text-red-500"
                        : "bg-green-500/10 text-green-500"
                    }`}
                  >
                    {!barber.active
                      ? t("dash.day_off")
                      : barber.bookings > 0
                      ? t("dash.busy")
                      : t("dash.free")}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Upcoming bookings */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t("dash.recent_bookings")}
        </h2>

        <div className="space-y-2">
          {MOCK_TEAM_BOOKINGS.map((b) => (
            <Card
              key={b.id}
              className="px-4 py-3 bg-card border-white/5 flex items-center gap-3 hover:border-white/10 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {b.time}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm truncate">{b.client}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {b.service}
                  {" · "}
                  <span className="text-primary/70">{b.barber}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t, lang } = useTranslation();
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isTeam = user.mode === "team";
  const dateStr = formatDateLocale(lang);
  const activeCount = TEAM_BARBERS.filter((b) => b.active).length;

  return (
    <Layout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-display font-bold text-foreground">
          {isTeam ? t("nav.calendar.team") : t("nav.dashboard")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{dateStr}</p>
        {isTeam && (
          <p className="text-xs text-emerald-400 mt-1 font-medium">
            {dateStr.split(",")[0]}: {activeCount} {t("dash.masters_working")}
          </p>
        )}
      </motion.div>

      {isTeam ? <TeamDashboard /> : <IndividualDashboard />}
    </Layout>
  );
}
