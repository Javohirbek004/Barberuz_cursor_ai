import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useGetDashboardStats, useListBookings } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ScanLine, MousePointerClick, CalendarDays, Wallet, User } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Dashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  // useAuth fetches the user from the DB (always fresh) and syncs localStorage
  const { user, isLoading } = useAuth();

  /**
   * checkVerificationStatus:
   * Once the user data arrives from the server, if telegramVerified is still
   * false the user hasn't completed phone verification yet — send them back
   * to the verify page so they can complete it.
   *
   * If they arrive here from the bot link AND are verified (telegramVerified = true),
   * they stay on the dashboard — no redirect.
   */
  useEffect(() => {
    if (!isLoading && user && !user.telegramVerified) {
      navigate("/verify-telegram");
    }
  }, [user, isLoading, navigate]);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const today = new Date().toISOString().split("T")[0];
  const { data: bookingsData, isLoading: bookingsLoading } = useListBookings({ date: today });

  const statCards = [
    { label: t("dash.scans"), value: stats?.scans || 0, icon: ScanLine, color: "text-blue-400" },
    { label: t("dash.clicks"), value: stats?.clicks || 0, icon: MousePointerClick, color: "text-purple-400" },
    { label: t("dash.today_bookings"), value: stats?.todayBookings || 0, icon: CalendarDays, color: "text-amber-400" },
    {
      label: t("dash.today_revenue"),
      value: `${(stats?.todayRevenue || 0).toLocaleString()} UZS`,
      icon: Wallet,
      color: "text-emerald-400",
    },
  ];

  // Show nothing while we determine the auth/verification state
  if (isLoading || !user) return null;

  return (
    <Layout>
      <PageHeader
        title={t("nav.dashboard")}
        subtitle={format(new Date(), "dd MMMM, yyyy")}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-medium text-muted-foreground leading-tight">
                  {stat.label}
                </h3>
              </div>
              <div className="text-xl font-display font-bold text-foreground">
                {statsLoading ? "..." : stat.value}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Today's Bookings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{t("dash.recent_bookings")}</h2>
        </div>

        <div className="space-y-3">
          {bookingsLoading ? (
            <p className="text-muted-foreground text-center py-8">{t("loading")}</p>
          ) : bookingsData?.bookings && bookingsData.bookings.length > 0 ? (
            bookingsData.bookings.map((booking) => (
              <Card
                key={booking.id}
                className="p-4 bg-card border-white/5 flex items-center justify-between hover-lift"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary font-bold">
                    <span className="text-sm">{booking.startTime.split(":")[0]}</span>
                    <span className="text-xs opacity-80">{booking.startTime.split(":")[1]}</span>
                  </div>
                  <div>
                    <div className="font-bold text-foreground mb-1">{booking.clientName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {booking.serviceName || "Xizmat"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary mb-1">
                    {booking.price.toLocaleString()}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold
                    ${
                      booking.status === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : booking.status === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-white/10 text-white/60"
                    }`}
                  >
                    {t(`status.${booking.status}` as any)}
                  </span>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-white/5 border border-white/5 rounded-2xl border-dashed">
              <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{t("dash.no_bookings")}</p>
            </div>
          )}
        </div>
      </motion.div>
    </Layout>
  );
}
