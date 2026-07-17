import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  useGetDashboardStats,
  useListBookings,
  useGetClient,
  useUpdateBooking,
  useUpdateClient,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import {
  CalendarDays, Wallet, Timer, Clock,
  HardHat, Armchair, ChevronRight,
  X, Phone, CheckCircle, XCircle, Save, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

// ── Demo data (shown when real data is empty) ─────────────────────────────────
function buildDemoBookings(today: string): Booking[] {
  const slots: Array<{
    id: string; start: string; end: string; name: string;
    service: string; price: number; status: Booking["status"];
  }> = [
    { id: "d1", start: "09:00", end: "09:45", name: "Jasur Toshmatov",  service: "Soch oldirish",    price: 50000,  status: "completed"  },
    { id: "d2", start: "10:00", end: "10:30", name: "Sherzod Nazarov",  service: "Soqol olish",      price: 30000,  status: "completed"  },
    { id: "d3", start: "11:00", end: "11:45", name: "Bobur Raximov",    service: "Soch + Soqol",     price: 70000,  status: "confirmed"  },
    { id: "d4", start: "12:30", end: "13:15", name: "Ulugbek Yusupov",  service: "Fade (gradyen)",   price: 60000,  status: "confirmed"  },
    { id: "d5", start: "14:00", end: "14:45", name: "Azizbek Karimov",  service: "Soch oldirish",    price: 50000,  status: "confirmed"  },
    { id: "d6", start: "15:30", end: "16:00", name: "Mirzo Hasanov",    service: "Qoshlarni tartib", price: 25000,  status: "pending"    },
    { id: "d7", start: "17:00", end: "17:45", name: "Sardor Mirzayev",  service: "Soch + Soqol",     price: 70000,  status: "pending"    },
  ];
  return slots.map((s) => ({
    id: s.id,
    barberId: "demo",
    clientId: null,
    clientName: s.name,
    serviceId: null,
    serviceName: s.service,
    date: today,
    startTime: s.start,
    endTime: s.end,
    price: s.price,
    status: s.status,
    notes: null,
    createdAt: new Date().toISOString(),
  }));
}

const DEMO_STATS = { todayBookings: 7, todayRevenue: 355000, totalClients: 42 };

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  iconColor: string;
  loading?: boolean;
  delay?: number;
  onClick?: () => void;
}

function StatCard({
  label, value, subtext, icon: Icon, iconColor, loading, delay = 0, onClick,
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
        <div className={`font-display font-bold text-foreground leading-tight ${String(value).length > 10 ? "text-lg" : "text-2xl"}`}>
          {loading ? <span className="text-muted-foreground text-base">...</span> : value}
        </div>
        {subtext && !loading && (
          <div className="text-xs text-muted-foreground/60 mt-1 truncate">{subtext}</div>
        )}
      </Card>
    </motion.div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
const UZ_SHORT_MONTHS = [
  "Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek",
];

function formatBookingDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Bugun";
  const d = new Date(dateStr);
  return `${d.getDate()}-${UZ_SHORT_MONTHS[d.getMonth()]}`;
}

// ── Booking Bottom Sheet ──────────────────────────────────────────────────────
function BookingDetailModal({
  booking,
  onClose,
  onRefetch,
  onRefetchStats,
}: {
  booking: Booking;
  onClose: () => void;
  onRefetch: () => void;
  onRefetchStats: () => void;
}) {
  const { toast } = useToast();
  const [notesValue, setNotesValue]   = useState("");
  const [notesSaved, setNotesSaved]   = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: clientData } = useGetClient(
    booking.clientId ?? "",
    { query: { enabled: !!booking.clientId } },
  );

  const updateBookingMut = useUpdateBooking();
  const updateClientMut  = useUpdateClient();

  // Hide bottom nav while sheet is open — visibility:hidden blocks all descendants
  useEffect(() => {
    document.body.classList.add("sheet-open");
    const nav = document.getElementById("bottom-nav-root");
    if (nav) nav.style.visibility = "hidden";
    return () => {
      document.body.classList.remove("sheet-open");
      if (nav) nav.style.visibility = "";
    };
  }, []);

  useEffect(() => {
    if (clientData?.notes !== undefined) setNotesValue(clientData.notes ?? "");
  }, [clientData?.notes]);

  const handleSaveNotes = () => {
    if (!booking.clientId) {
      // Demo mode — just show local feedback
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
      return;
    }
    updateClientMut.mutate(
      { clientId: booking.clientId, data: { notes: notesValue } },
      { onSuccess: () => { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500); } },
    );
  };

  const handleComplete = () => {
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { status: "completed" } },
      {
        onSuccess: () => {
          onClose();
          onRefetch();
          onRefetchStats();
          toast({
            title: "✓ Muvaffaqiyatli yakunlandi",
            description: `${booking.clientName} — ${booking.price.toLocaleString()} so'm daromadga qo'shildi`,
            duration: 3000,
          });
        },
      },
    );
  };

  const handleConfirmCancel = () => {
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { status: "cancelled" } },
      {
        onSuccess: () => {
          onClose();
          onRefetch();
          onRefetchStats();
        },
      },
    );
  };

  const isBusy   = updateBookingMut.isPending;
  const isActive = booking.status !== "cancelled" && booking.status !== "completed";
  const dateLabel = formatBookingDate(booking.date);
  const phone = clientData?.phone;

  return (
    <div className="fixed inset-0 z-[200] flex items-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative w-full bg-[#1a1a1f] rounded-t-3xl border-t border-x border-white/8 z-10 flex flex-col"
        style={{ maxHeight: "70vh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">

          {/* ── Section 1: Customer header ── */}
          <div className="flex items-center justify-between pt-3 pb-5 border-b border-white/8">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-widest font-medium">Mijoz</p>
              <h2 className="text-xl font-bold text-foreground leading-tight truncate">
                {booking.clientName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all flex-shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* ── Section 2: Info grid ── */}
          <div className="py-4 space-y-0 border-b border-white/8">
            <SheetRow label="Xizmat" value={booking.serviceName ?? "—"} />
            <SheetRow
              label="Vaqt va Sana"
              value={`${dateLabel} • ${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`}
            />
            {/* Phone row */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Telefon raqami</span>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-2 text-emerald-400 font-semibold text-sm hover:text-emerald-300 active:opacity-70 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  {phone}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
              )}
            </div>
            {/* Price */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Narxi</span>
              <span className="text-xl font-bold text-primary">
                {booking.price.toLocaleString()} so'm
              </span>
            </div>
            {/* Status badge */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Holat</span>
              <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wide ${
                booking.status === "confirmed"  ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20" :
                booking.status === "pending"    ? "bg-amber-500/12 text-amber-400 border border-amber-500/20" :
                booking.status === "completed"  ? "bg-blue-500/12 text-blue-400 border border-blue-500/20" :
                                                   "bg-red-500/12 text-red-400 border border-red-500/20"
              }`}>
                {booking.status === "confirmed" ? "Tasdiqlangan" :
                 booking.status === "pending"   ? "Kutilmoqda" :
                 booking.status === "completed" ? "Yakunlangan" : "Bekor qilingan"}
              </span>
            </div>
          </div>

          {/* ── Section 3: Notes ── */}
          <div className="py-4 border-b border-white/8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Mijoz haqida eslatma</p>
              <AnimatePresence>
                {notesSaved && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Eslatma saqlandi
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Soch uzunligi, rang xohishi, maxsus talablar..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/35 resize-none focus:outline-none focus:border-primary/40 focus:bg-white/[0.07] transition-all"
              rows={3}
            />
            {booking.clientId ? (
              <button
                onClick={handleSaveNotes}
                disabled={updateClientMut.isPending}
                className="mt-2.5 w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4 text-primary" />
                {updateClientMut.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground/50 text-center">
                Demo bron — eslatma saqlanmaydi
              </p>
            )}
          </div>

          {/* ── Section 4: Action buttons ── */}
          {isActive && !confirmCancel && (
            <div className="pt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                Bekor qilish
              </button>
              <button
                onClick={handleComplete}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                {isBusy ? "..." : "Yakunlash"}
              </button>
            </div>
          )}

          {/* Cancel confirmation */}
          {isActive && confirmCancel && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-4"
            >
              <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-400">Bronni bekor qilasizmi?</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {booking.clientName} uchun {booking.startTime.slice(0,5)} da belgilangan bron o'chiriladi.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="py-3.5 rounded-2xl bg-white/8 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/12 active:scale-[0.98] transition-all"
                >
                  Qaytish
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={isBusy}
                  className="py-3.5 rounded-2xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {isBusy ? "..." : "Ha, bekor qilish"}
                </button>
              </div>
            </motion.div>
          )}

          {!isActive && (
            <div className={`mt-4 text-center text-sm font-semibold py-3 rounded-2xl ${
              booking.status === "cancelled"
                ? "bg-red-500/10 text-red-400 border border-red-500/15"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/15"
            }`}>
              {booking.status === "cancelled" ? "✕  Bekor qilingan" : "✓  Yakunlangan"}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground flex-shrink-0 mr-4">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

// ── Individual Dashboard ──────────────────────────────────────────────────────
function IndividualDashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const today = new Date().toISOString().split("T")[0];
  const { data: bookingsData, isLoading: bookingsLoading, refetch } = useListBookings({ date: today });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const bookingsListRef = useRef<HTMLDivElement>(null);
  const bookingItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const realBookings = bookingsData?.bookings ?? [];
  const isEmpty = !bookingsLoading && !statsLoading && realBookings.length === 0 && (stats?.todayBookings ?? 0) === 0;
  const demoBookings = isEmpty ? buildDemoBookings(today) : [];

  const bookings = isEmpty ? demoBookings : realBookings;
  const activeStats = isEmpty ? DEMO_STATS : stats;

  const upcomingBookings = bookings
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalSlots = 18;
  const busySlots = activeStats?.todayBookings ?? 0;
  const freeSlots = Math.max(0, totalSlots - busySlots);
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
        <StatCard
          label="Bugungi bronlar"
          value={statsLoading ? "..." : `${activeStats?.todayBookings ?? 0} ta`}
          subtext={statsLoading ? undefined : durationLabel}
          icon={CalendarDays}
          iconColor="text-amber-400"
          loading={statsLoading}
          delay={0}
          onClick={() => navigate("/calendar")}
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
        <StatCard
          label="Bo'sh vaqtlar"
          value={statsLoading ? "..." : `${freeSlots} ta`}
          icon={Timer}
          iconColor="text-blue-400"
          loading={statsLoading}
          delay={0.1}
          onClick={() => navigate("/calendar")}
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
