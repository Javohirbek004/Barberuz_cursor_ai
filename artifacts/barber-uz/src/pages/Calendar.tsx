import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Pencil, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookingStore, AddedBooking } from "@/stores/bookingStore";
import { useLocation } from "wouter";

/** Subscribe to bookingStore and re-render when a booking is added */
function useAddedBookings(): AddedBooking[] {
  const [list, setList] = useState<AddedBooking[]>(() => bookingStore.getAll());
  useEffect(() => bookingStore.subscribe(() => setList(bookingStore.getAll())), []);
  return list;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const RU_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const UZ_DAY_NAMES = [
  "Yakshanba", "Dushanba", "Seshanba", "Chorshanba",
  "Payshanba", "Juma", "Shanba",
];
const RU_DAY_NAMES = [
  "Воскресенье", "Понедельник", "Вторник", "Среда",
  "Четверг", "Пятница", "Суббота",
];

const UZ_DAY_SHORT = ["Ya", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const RU_DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatDate(date: Date, lang: string): string {
  const d = date.getDate();
  const m = lang === "ru" ? RU_MONTHS[date.getMonth()] : UZ_MONTHS[date.getMonth()];
  const wd = lang === "ru" ? RU_DAY_NAMES[date.getDay()] : UZ_DAY_NAMES[date.getDay()];
  if (lang === "ru") return `${d} ${m.toLowerCase()}, ${wd}`;
  return `${d}-${m.toLowerCase()}, ${wd}`;
}

/** Returns array of 7 dates starting from Monday of the given date's week */
function getWeek(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type BookingStatus = "confirmed" | "pending" | "cancelled";

interface MockBooking {
  id: string;
  time: string;
  client: string;
  phone: string;
  service: string;
  status: BookingStatus;
  barber?: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_DOT: Record<BookingStatus, string> = {
  confirmed: "bg-green-500",
  pending: "bg-yellow-400",
  cancelled: "bg-red-500",
};

const STATUS_CARD: Record<BookingStatus, string> = {
  confirmed: "border-green-500/30 bg-green-500/5",
  pending: "border-yellow-400/30 bg-yellow-400/5",
  cancelled: "border-red-500/30 bg-red-500/10 opacity-70",
};

const STATUS_TEXT: Record<BookingStatus, string> = {
  confirmed: "text-green-400",
  pending: "text-yellow-400",
  cancelled: "text-red-400",
};

// ── Mock data ─────────────────────────────────────────────────────────────────
const SOLO_BOOKINGS: MockBooking[] = [
  { id: "b1", time: "14:00", client: "Aziz", phone: "+998 90 123 45 67", service: "Fade + Soqol", status: "confirmed" },
  { id: "b2", time: "15:00", client: "Jamshid", phone: "+998 91 234 56 78", service: "Soch olish", status: "pending" },
  { id: "b3", time: "17:00", client: "Olim", phone: "+998 93 345 67 89", service: "Bolalar uchun", status: "cancelled" },
];

const TEAM_BARBERS = [
  { id: "all", name: "Barchasi", count: null },
  { id: "sardor", name: "Sardor", count: 5 },
  { id: "jasur", name: "Jasur", count: 3 },
  { id: "ali", name: "Ali", count: 0 },
  { id: "kamol", name: "Kamol", count: 2 },
];

const TEAM_BOOKINGS: MockBooking[] = [
  { id: "t1", time: "09:00", client: "Aziz", phone: "+998 90 111 22 33", service: "Fade + Soqol", status: "confirmed", barber: "Sardor" },
  { id: "t2", time: "10:00", client: "Bobur", phone: "+998 91 222 33 44", service: "Soch olish", status: "pending", barber: "Sardor" },
  { id: "t3", time: "11:00", client: "Dilshod", phone: "+998 93 333 44 55", service: "Soqol tekislash", status: "confirmed", barber: "Sardor" },
  { id: "t4", time: "12:00", client: "Eldor", phone: "+998 94 444 55 66", service: "Bolalar uchun", status: "pending", barber: "Sardor" },
  { id: "t5", time: "14:00", client: "Firdavs", phone: "+998 95 555 66 77", service: "Fade", status: "cancelled", barber: "Sardor" },
  { id: "t6", time: "10:30", client: "Hamid", phone: "+998 90 666 77 88", service: "Soch olish", status: "confirmed", barber: "Jasur" },
  { id: "t7", time: "13:00", client: "Ibrohim", phone: "+998 91 777 88 99", service: "Fade + Soqol", status: "pending", barber: "Jasur" },
  { id: "t8", time: "16:00", client: "Jahongir", phone: "+998 93 888 99 00", service: "Bolalar uchun", status: "confirmed", barber: "Jasur" },
  { id: "t9", time: "11:30", client: "Kamoljon", phone: "+998 94 999 00 11", service: "Soqol tekislash", status: "confirmed", barber: "Kamol" },
  { id: "t10", time: "15:30", client: "Lochin", phone: "+998 95 000 11 22", service: "Soch olish", status: "pending", barber: "Kamol" },
];

// ── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, statusLabel, onClick }: { booking: MockBooking; statusLabel: string; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 flex items-start gap-4 transition-all ${STATUS_CARD[booking.status]}`}
    >
      <div className="flex flex-col items-center min-w-[2.5rem]">
        <span className="text-sm font-bold text-foreground">{booking.time}</span>
        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full ${STATUS_DOT[booking.status]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-foreground truncate">
            {booking.client}
            {booking.barber && (
              <span className="text-muted-foreground font-normal text-xs ml-1.5">
                ({booking.barber})
              </span>
            )}
          </span>
          <span className={`text-xs font-semibold shrink-0 ${STATUS_TEXT[booking.status]}`}>
            {statusLabel}
          </span>
        </div>
        <span className="text-sm text-muted-foreground mt-0.5 block">{booking.service}</span>
      </div>
    </motion.button>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({
  booking,
  onClose,
}: {
  booking: MockBooking;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const statusLabelMap: Record<BookingStatus, string> = {
    confirmed: t("cal.status.confirmed"),
    pending: t("cal.status.pending"),
    cancelled: t("cal.status.cancelled"),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="relative w-full max-w-md bg-card rounded-t-3xl p-6 pb-10 space-y-5 z-10"
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-1 mb-2" />

          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-foreground">{t("cal.booking_detail")}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <InfoRow label={t("cal.client")} value={booking.client} />
            <InfoRow label={t("cal.phone")} value={booking.phone} />
            <InfoRow label={t("cal.service")} value={booking.service} />
            <InfoRow label={t("cal.time")} value={booking.time} />
            {booking.barber && <InfoRow label="Barber" value={booking.barber} />}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">{t("cal.status")}</span>
              <span className={`flex items-center gap-2 text-sm font-semibold ${STATUS_TEXT[booking.status]}`}>
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${STATUS_DOT[booking.status]}`} />
                {statusLabelMap[booking.status]}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl border-white/10 gap-2 text-foreground"
            >
              <Pencil className="w-4 h-4" />
              {t("cal.edit")}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
              disabled={booking.status === "cancelled"}
            >
              <Ban className="w-4 h-4" />
              {t("cal.cancel_booking")}
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-primary/20 text-primary hover:bg-primary/30 border-0"
            >
              {t("cal.close")}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── Week Nav ──────────────────────────────────────────────────────────────────
function WeekNav({
  selected,
  onSelect,
  lang,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  lang: string;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const anchor = new Date(today);
  anchor.setDate(today.getDate() + weekOffset * 7);
  const days = getWeek(anchor);

  const MONTHS = lang === "ru" ? RU_MONTHS : UZ_MONTHS;
  const DAY_SHORT = lang === "ru" ? RU_DAY_SHORT : UZ_DAY_SHORT;

  return (
    <div className="space-y-2 mb-5">
      {/* Prev / Next week arrows */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs text-muted-foreground font-medium">
          {MONTHS[days[0].getMonth()]} {days[0].getFullYear()}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {days.map((day) => {
          const isSelected = isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          const dowIdx = day.getDay(); // 0=Sun

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={`flex flex-col items-center min-w-[3rem] py-2.5 px-1 rounded-2xl transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-card border border-white/5 text-muted-foreground hover:bg-white/5"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1">
                {DAY_SHORT[dowIdx]}
              </span>
              <span
                className={`text-lg font-display font-bold ${
                  isSelected
                    ? "text-primary-foreground"
                    : isToday
                    ? "text-primary"
                    : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Individual Calendar ───────────────────────────────────────────────────────
function IndividualCalendar() {
  const { t, lang } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeBooking, setActiveBooking] = useState<MockBooking | null>(null);
  const today = new Date();
  const added = useAddedBookings();

  const statusLabelMap: Record<BookingStatus, string> = {
    confirmed: t("cal.status.confirmed"),
    pending: t("cal.status.pending"),
    cancelled: t("cal.status.cancelled"),
  };

  const addedSolo: MockBooking[] = added
    .filter((b) => !b.barber)
    .map((b) => ({ id: b.id, time: b.time, client: b.client, phone: b.phone, service: b.service, status: b.status }));

  const bookings = [...SOLO_BOOKINGS, ...addedSolo].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{t("cal.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(selectedDate, lang)}</p>
        </div>
        <Button
          onClick={() => setSelectedDate(today)}
          size="sm"
          className="rounded-full bg-primary/20 text-primary hover:bg-primary/30 border-0 text-xs h-8"
        >
          {t("cal.today")}
        </Button>
      </div>

      {/* Week nav */}
      <WeekNav selected={selectedDate} onSelect={setSelectedDate} lang={lang} />

      {/* Booking list */}
      <div className="space-y-3">
        {bookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t("cal.empty")}
          </div>
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              statusLabel={statusLabelMap[b.status]}
              onClick={() => setActiveBooking(b)}
            />
          ))
        )}
      </div>

      {/* Detail modal */}
      {activeBooking && (
        <DetailModal booking={activeBooking} onClose={() => setActiveBooking(null)} />
      )}
    </>
  );
}

// ── Team Calendar ─────────────────────────────────────────────────────────────
function TeamCalendar() {
  const { t, lang } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeBarber, setActiveBarber] = useState("all");
  const [activeBooking, setActiveBooking] = useState<MockBooking | null>(null);
  const today = new Date();
  const added = useAddedBookings();

  const statusLabelMap: Record<BookingStatus, string> = {
    confirmed: t("cal.status.confirmed"),
    pending: t("cal.status.pending"),
    cancelled: t("cal.status.cancelled"),
  };

  const addedTeam: MockBooking[] = added
    .filter((b) => !!b.barber)
    .map((b) => ({ id: b.id, time: b.time, client: b.client, phone: b.phone, service: b.service, status: b.status, barber: b.barber }));

  const allTeam = [...TEAM_BOOKINGS, ...addedTeam].sort((a, b) => a.time.localeCompare(b.time));

  const filteredBookings =
    activeBarber === "all"
      ? allTeam
      : allTeam.filter((b) => b.barber?.toLowerCase() === activeBarber);

  const activeCount = TEAM_BARBERS.filter((b) => b.id !== "all").length;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{t("cal.team_title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(selectedDate, lang)} • {activeCount} {t("cal.master_count")}
          </p>
        </div>
        <Button
          onClick={() => setSelectedDate(today)}
          size="sm"
          className="rounded-full bg-primary/20 text-primary hover:bg-primary/30 border-0 text-xs h-8"
        >
          {t("cal.today")}
        </Button>
      </div>

      {/* Week nav */}
      <WeekNav selected={selectedDate} onSelect={setSelectedDate} lang={lang} />

      {/* Barber filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {TEAM_BARBERS.map((barber) => (
          <button
            key={barber.id}
            onClick={() => setActiveBarber(barber.id)}
            className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all ${
              activeBarber === barber.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-card border border-white/5 text-muted-foreground hover:bg-white/5"
            }`}
          >
            {barber.name}
            {barber.count !== null && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeBarber === barber.id
                    ? "bg-white/20 text-primary-foreground"
                    : barber.count === 0
                    ? "bg-white/5 text-muted-foreground"
                    : "bg-primary/20 text-primary"
                }`}
              >
                {barber.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Booking list */}
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t("cal.empty")}
          </div>
        ) : (
          filteredBookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              statusLabel={statusLabelMap[b.status]}
              onClick={() => setActiveBooking(b)}
            />
          ))
        )}
      </div>

      {/* Detail modal */}
      {activeBooking && (
        <DetailModal booking={activeBooking} onClose={() => setActiveBooking(null)} />
      )}
    </>
  );
}

// ── Telegram banner ───────────────────────────────────────────────────────────
function isTelegramConnected(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return u?.telegramVerified === true;
  } catch {
    return false;
  }
}

function CalendarTelegramBanner() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (isTelegramConnected() || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-3 bg-[#2AABEE]/10 border border-[#2AABEE]/20 rounded-2xl px-4 py-3"
    >
      <span className="text-base shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{t("cal.no_notifications")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate("/verify-telegram")}
          className="h-8 px-3 rounded-xl bg-[#2AABEE] text-white text-xs font-bold hover:bg-[#229ED9] transition-colors"
        >
          {t("cal.connect")}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground/50 hover:text-muted-foreground text-lg leading-none transition-colors"
        >
          ×
        </button>
      </div>
    </motion.div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function Calendar() {
  const { user } = useAuth();
  const isTeam = user?.mode === "team";

  return (
    <Layout>
      <CalendarTelegramBanner />
      {isTeam ? <TeamCalendar /> : <IndividualCalendar />}
    </Layout>
  );
}
