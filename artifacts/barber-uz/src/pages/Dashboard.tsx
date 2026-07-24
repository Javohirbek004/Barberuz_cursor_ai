import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetDashboardStats,
  useListBookings,
  useGetProfile,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import {
  CalendarDays, Wallet, Timer, Clock,
  HardHat, Armchair, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BookingDetailModal } from "@/components/BookingDetailModal";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function calcTotalDuration(bookings: Booking[]): string {
  let total = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    total += toMins(b.endTime) - toMins(b.startTime);
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `Bandlik • ${h}s ${m}d`;
}

function calcNextBookingInfo(
  upcomingBookings: Booking[],
  now: Date,
): { main: string; sub: string; nextId: string | null } {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const b of upcomingBookings) {
    const start = toMins(b.startTime);
    const end = toMins(b.endTime);
    if (nowMins >= start && nowMins < end) {
      return { main: "Hozir band", sub: "Mijoz stulda", nextId: b.id };
    }
    if (start > nowMins) {
      const diff = start - nowMins;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      const main = h > 0 ? `${h}s ${m}d keyin` : `${m}d keyin`;
      return { main, sub: b.startTime.slice(0, 5), nextId: b.id };
    }
  }
  return { main: "Bugun tugadi", sub: "Ish yakunlandi", nextId: null };
}

// ── Static team barbers ───────────────────────────────────────────────────────
const TEAM_BARBERS = [
  { id: "1", name: "Ali Karimov",    bookings: 4, active: true  },
  { id: "2", name: "Sardor Yusupov", bookings: 5, active: true  },
  { id: "3", name: "Jasur Toshev",   bookings: 0, active: true  },
  { id: "4", name: "Bobur Mirzayev", bookings: 0, active: false },
];

const MOCK_TEAM_BOOKINGS = [
  { id: "t1", time: "14:30", client: "Aziz",    service: "Soch oldirish", barber: "Sardor barber" },
  { id: "t2", time: "15:30", client: "Jamshid", service: "Fade",          barber: "Jasur barber"  },
  { id: "t3", time: "17:00", client: "Olim",    service: "Soqol",         barber: "Kamol barber"  },
];


function fmtTimeMins(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function computeFreeWindows(
  workStart: number,
  workEnd: number,
  busyRanges: { startTime: string; endTime: string }[],
): { start: number; end: number }[] {
  const busy = busyRanges
    .map(b => ({ s: toMins(b.startTime), e: toMins(b.endTime) }))
    .sort((a, b) => a.s - b.s);
  const windows: { start: number; end: number }[] = [];
  let cursor = workStart;
  for (const b of busy) {
    if (b.s > cursor) windows.push({ start: cursor, end: b.s });
    cursor = Math.max(cursor, b.e);
  }
  if (cursor < workEnd) windows.push({ start: cursor, end: workEnd });
  return windows;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  secondValue?: string;
  subtext?: string;
  icon: React.ElementType;
  iconColor: string;
  loading?: boolean;
  delay?: number;
  onClick?: () => void;
}

function StatCard({
  label, value, secondValue, subtext, icon: Icon, iconColor, loading, delay = 0, onClick,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={onClick ? "cursor-pointer" : ""}
    >
      <Card className={`p-4 bg-card/50 backdrop-blur border-white/5 transition-colors h-full ${onClick ? "hover:border-primary/30 hover:bg-primary/5 active:scale-95" : "hover:border-white/10"}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg bg-white/5 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-medium text-muted-foreground leading-tight">{label}</h3>
        </div>
        {loading ? (
          <span className="text-muted-foreground text-base">...</span>
        ) : secondValue !== undefined ? (
          <div className="space-y-0.5">
            <div className="font-display font-bold text-foreground text-lg leading-tight">{value}</div>
            <div className="font-display font-semibold text-muted-foreground text-base leading-tight">{secondValue}</div>
          </div>
        ) : (
          <div className={`font-display font-bold text-foreground leading-tight ${String(value).length > 10 ? "text-lg" : "text-2xl"}`}>
            {value}
          </div>
        )}
        {subtext && !loading && (
          <div className="text-xs text-muted-foreground/60 mt-1 truncate">{subtext}</div>
        )}
      </Card>
    </motion.div>
  );
}

// ── Interactive Card (clickable with gold pill) ───────────────────────────────
function InteractiveCard({
  label, value, pillLabel, icon: Icon, iconColor, loading, delay = 0, onClick,
}: {
  label: string; value: string; pillLabel: string;
  icon: React.ElementType; iconColor: string;
  loading?: boolean; delay?: number; onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={!loading ? onClick : undefined}
      className="cursor-pointer select-none"
    >
      <Card className="p-4 bg-card/50 backdrop-blur border-white/5 h-full transition-all active:scale-95 hover:border-amber-400/20">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg bg-white/5 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
        </div>
        {loading ? (
          <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse mb-3" />
        ) : (
          <div className="font-display font-bold text-white text-2xl leading-tight mb-3">{value}</div>
        )}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ color: "#FACC15", backgroundColor: "rgba(250,204,21,0.12)" }}>
          {pillLabel} ➔
        </span>
      </Card>
    </motion.div>
  );
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-white/8 rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Today Stats Modal ─────────────────────────────────────────────────────────
function TodayStatsModal({ open, onClose, total, completed, remaining, durationMins }: {
  open: boolean; onClose: () => void;
  total: number; completed: number; remaining: number; durationMins: number;
}) {
  const dh = Math.floor(durationMins / 60);
  const dm = durationMins % 60;
  const durStr = dh > 0 ? (dm > 0 ? `${dh} soat ${dm} daq` : `${dh} soat`) : `${dm} daq`;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="overflow-y-auto px-5 pb-8 pt-2">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">📊 Bugungi bronlar hisoboti</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground transition-colors text-lg">✖</button>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mb-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Jami bronlar</div>
          <div className="font-bold text-3xl text-white">{total} ta</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <div className="text-xs text-emerald-400/80 mb-1">✅ Tugallangan</div>
            <div className="font-bold text-2xl text-emerald-400">{completed} ta</div>
          </div>
          <div className="bg-amber-400/8 border border-amber-400/20 rounded-2xl p-4 text-center">
            <div className="text-xs text-amber-400/80 mb-1">⏳ Kutilayotgan</div>
            <div className="font-bold text-2xl text-amber-400">{remaining} ta</div>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl shrink-0">⏱</span>
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Umumiy bandlik</div>
            <div className="font-bold text-foreground">{durationMins > 0 ? durStr : "—"}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-primary/15 border border-primary/20 text-primary font-semibold text-sm">
          Tushunarli
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Free Slot Modal ───────────────────────────────────────────────────────────
function FreeSlotModal({ open, onClose, freeWindows, totalFreeSlots }: {
  open: boolean; onClose: () => void;
  freeWindows: { start: number; end: number }[];
  totalFreeSlots: number;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="overflow-y-auto px-5 pb-8 pt-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-foreground">⏱ Bugungi bo'sh vaqtlar</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground transition-colors text-lg">✖</button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Jami {totalFreeSlots} ta bo'sh slot mavjud</p>
        {freeWindows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Hozircha bo'sh vaqt yo'q 😔</div>
        ) : (
          <div>
            {freeWindows.map((w, i) => {
              const dMins = w.end - w.start;
              const dh = Math.floor(dMins / 60);
              const dm = dMins % 60;
              const durStr = dh > 0 ? (dm > 0 ? `${dh} soat ${dm} daq` : `${dh} soat`) : `${dm} daq`;
              return (
                <div key={i}>
                  {i > 0 && <div className="h-px bg-white/6 my-1" />}
                  <div className="flex items-center gap-3 py-3">
                    <span className="text-lg shrink-0">🟢</span>
                    <div>
                      <div className="font-semibold text-foreground text-sm">
                        {fmtTimeMins(w.start)} — {fmtTimeMins(w.end)}
                      </div>
                      <div className="text-xs text-muted-foreground">{durStr} bo'sh</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-5">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-primary/15 border border-primary/20 text-primary font-semibold text-sm">
            Yopish
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Individual Dashboard ──────────────────────────────────────────────────────
function IndividualDashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const { data: profile } = useGetProfile();
  const today = new Date().toISOString().split("T")[0];
  const { data: bookingsData, isLoading: bookingsLoading, refetch } = useListBookings({ date: today });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showBronModal, setShowBronModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);

  const bookingsListRef = useRef<HTMLDivElement>(null);
  const bookingItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const realBookings = bookingsData?.bookings ?? [];
  const bookings = realBookings;
  const activeStats = stats;

  const upcomingBookings = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "completed")
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 2);

  // Compute free time windows from actual working hours and today's bookings
  const workStart = toMins(profile?.workingHoursStart ?? "09:00");
  const workEnd   = toMins(profile?.workingHoursEnd   ?? "20:00");
  const todayBusy = bookings.filter(b => b.status !== "cancelled");
  const freeWindows = computeFreeWindows(workStart, workEnd, todayBusy);
  const freeSlots   = freeWindows.reduce((s, w) => s + Math.floor((w.end - w.start) / 30), 0);

  // Stats for TodayStatsModal
  const todayTotal    = todayBusy.length;
  const todayCompleted  = bookings.filter(b => b.status === "completed").length;
  const todayRemaining  = bookings.filter(b => b.status === "confirmed" || b.status === "pending").length;
  const todayDurMins    = todayBusy.reduce((s, b) => s + toMins(b.endTime) - toMins(b.startTime), 0);

  const durationLabel = calcTotalDuration(upcomingBookings);

  const { main: nextMain, sub: nextSub, nextId } = calcNextBookingInfo(upcomingBookings, now);

  const handleScrollToNext = () => {
    if (!nextId) return;
    const el = bookingItemRefs.current[nextId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(nextId);
      setTimeout(() => setFlashId(null), 1500);
    } else {
      bookingsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const statusLabel = (status: string) => {
    if (status === "confirmed") return t("status.confirmed");
    if (status === "pending") return t("status.pending");
    if (status === "completed") return t("status.completed");
    return status;
  };

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {/* Card 1: Bugungi bronlar */}
        <InteractiveCard
          label="Bugungi bronlar"
          value={`${activeStats?.todayBookings ?? 0} ta`}
          pillLabel="Tafsilotlar"
          icon={CalendarDays}
          iconColor="text-amber-400"
          loading={statsLoading}
          delay={0}
          onClick={() => setShowBronModal(true)}
        />

        {/* Card 2: Bugungi daromad */}
        <StatCard
          label="Bugungi daromad"
          value={statsLoading ? "..." : `${(activeStats?.todayRevenue ?? 0).toLocaleString()} so'm`}
          icon={Wallet}
          iconColor="text-emerald-400"
          loading={statsLoading}
          delay={0.05}
        />

        {/* Card 3: Bo'sh vaqtlar */}
        <InteractiveCard
          label="Bo'sh vaqtlar"
          value={`${freeSlots} ta bo'sh joy`}
          pillLabel="Vaqtlarni ko'rish"
          icon={Timer}
          iconColor="text-blue-400"
          loading={statsLoading || bookingsLoading}
          delay={0.1}
          onClick={() => setShowSlotModal(true)}
        />

        {/* Card 4: Keyingi brongacha */}
        <StatCard
          label="Keyingi brongacha"
          value={nextMain}
          subtext={nextSub}
          icon={Clock}
          iconColor="text-violet-400"
          delay={0.15}
          onClick={nextId ? handleScrollToNext : undefined}
        />
      </div>

      {/* Upcoming bookings */}
      <motion.div
        ref={bookingsListRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t("dash.recent_bookings")}
        </h2>

        {bookingsLoading ? (
          <p className="text-muted-foreground text-center py-8 text-sm">{t("loading")}</p>
        ) : upcomingBookings.length > 0 ? (
          <div className="space-y-2">
            {upcomingBookings.map((b) => (
              <motion.div
                key={b.id}
                ref={(el) => { bookingItemRefs.current[b.id] = el; }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedBooking(b)}
              >
                <Card
                  className={`px-4 py-3 bg-card border-white/5 flex items-center gap-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-[0.98] ${
                    flashId === b.id ? "border-primary/60 bg-primary/10 scale-[1.02]" : ""
                  }`}
                  style={{
                    transition: flashId === b.id ? "all 0.15s ease" : "all 0.2s ease",
                  }}
                >
                  {/* Time badge — fixed to single line */}
                  <div className="w-14 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    <span className="text-sm whitespace-nowrap">{b.startTime.slice(0, 5)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{b.clientName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.serviceName || t("dash.service_fallback")}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-primary">
                      {b.price.toLocaleString()} so'm
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold ${
                        b.status === "confirmed"
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Bugun hali bronlar yo'q</p>
            <p className="text-xs text-muted-foreground/50">
              Yangi bron qo'shish uchun + tugmasini bosing
            </p>
          </div>
        )}
      </motion.div>

      {/* Booking detail modal */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onRefetch={refetch}
            onRefetchStats={refetchStats}
          />
        )}
      </AnimatePresence>

      {/* Today stats bottom sheet */}
      <TodayStatsModal
        open={showBronModal}
        onClose={() => setShowBronModal(false)}
        total={todayTotal}
        completed={todayCompleted}
        remaining={todayRemaining}
        durationMins={todayDurMins}
      />

      {/* Free slots bottom sheet */}
      <FreeSlotModal
        open={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        freeWindows={freeWindows}
        totalFreeSlots={freeSlots}
      />
    </>
  );
}

// ── Team Dashboard ────────────────────────────────────────────────────────────
function TeamDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  const activeBarbers = TEAM_BARBERS.filter((b) => b.active);
  const busyBarbers  = activeBarbers.filter((b) => b.bookings > 0).length;
  const freeBarbers  = activeBarbers.filter((b) => b.bookings === 0).length;

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatCard
          label={t("dash.team_bookings")}
          value={stats?.todayBookings ?? 0}
          icon={CalendarDays}
          iconColor="text-amber-400"
          loading={statsLoading}
          delay={0}
        />
        <StatCard
          label={t("dash.team_revenue")}
          value={`${(stats?.todayRevenue ?? 0).toLocaleString()} so'm`}
          icon={Wallet}
          iconColor="text-emerald-400"
          loading={statsLoading}
          delay={0.05}
        />
        <StatCard
          label={t("dash.busy_slots")}
          value={busyBarbers}
          icon={HardHat}
          iconColor="text-orange-400"
          delay={0.1}
        />
        <StatCard
          label={t("dash.active_barbers")}
          value={freeBarbers}
          icon={Armchair}
          iconColor="text-blue-400"
          delay={0.15}
        />
      </div>

      {/* Team status list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">{t("dash.barber_status")}</h2>
        <div className="space-y-2">
          {TEAM_BARBERS.map((barber) => (
            <Link key={barber.id} href={`/calendar?barber=${barber.id}`}>
              <Card className="px-4 py-3 bg-card border-white/5 flex items-center gap-3 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    !barber.active ? "bg-white/20" : barber.bookings > 0 ? "bg-red-500" : "bg-green-500"
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
                    {!barber.active ? t("dash.day_off") : barber.bookings > 0 ? t("dash.busy") : t("dash.free")}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Upcoming team bookings */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-bold text-foreground mb-4">{t("dash.recent_bookings")}</h2>
        <div className="space-y-2">
          {MOCK_TEAM_BOOKINGS.map((b) => (
            <Card
              key={b.id}
              className="px-4 py-3 bg-card border-white/5 flex items-center gap-3 hover:border-white/10 transition-colors"
            >
              <div className="w-14 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                <span className="whitespace-nowrap">{b.time}</span>
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
