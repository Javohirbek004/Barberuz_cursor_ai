import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetDashboardStats,
  useListBookings,
  useGetProfile,
  useUpdateBooking,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { bookingDay, bookingStartMs, isOpenBooking, tashkentClock } from "@/lib/booking-feed";
import { BookingStatusBadge, bookingLook } from "@/components/BookingStatusBadge";
import { Layout } from "@/components/Layout";
import { NoShowConfirmModal } from "@/components/NoShowConfirmModal";
import { Card } from "@/components/ui/card";
import {
  CalendarDays, Wallet, Timer, Clock, Calendar, CheckCircle2, XCircle,
  HardHat, Armchair, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { BookingNoteBadge } from "@/components/BookingNoteBadge";
import { noteFromBooking } from "@/lib/booking-note";
import { IncomeAnalyticsSheet } from "@/pages/settings/IncomeAnalyticsSheet";
import { resolveDaySchedule, type ScheduleSource } from "@/lib/schedule";
import { APP_ORIGIN } from "@/lib/config";
import { BookingFlowDialog } from "@/components/BookingFlowDialog";

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
  const iso = tashkentClock().date;
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date(y || 1970, (m || 1) - 1, d || 1);
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

function isDroppedBooking(status: string): boolean {
  return status === "cancelled" || status === "auto_cancelled";
}

function calcTotalDuration(bookings: Booking[]): string {
  let total = 0;
  for (const b of bookings) {
    if (isDroppedBooking(b.status)) continue;
    total += toMins(b.endTime) - toMins(b.startTime);
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `Bandlik • ${h}s ${m}d`;
}

function countdownUntil(diffMins: number): string {
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  if (hours > 0 && minutes > 0) return `${hours} soat ${minutes} daqiqadan keyin`;
  if (hours > 0) return `${hours} soatdan keyin`;
  return `${minutes} daqiqadan keyin`;
}

function calcNextBookingInfo(
  upcomingBookings: Booking[],
  now: Date,
  shift: { enabled: boolean; startMins: number; endMins: number },
  hadCompletedToday: boolean,
): { main: string; sub: string; nextId: string | null } {
  const clock = tashkentClock(now);
  const nowMins = clock.mins;
  const today = clock.date;
  for (const b of upcomingBookings) {
    if (bookingDay(b.date) !== today) continue;
    const start = toMins(b.startTime);
    if (start <= nowMins) continue;
    return {
      main: countdownUntil(start - nowMins),
      sub: b.startTime.slice(0, 5),
      nextId: b.id,
    };
  }
  const beforeOpen = shift.enabled && nowMins < shift.startMins;
  if (beforeOpen) return { main: "Ish vaqti hali boshlanmadi", sub: "", nextId: null };
  const duringHours = shift.enabled && nowMins < shift.endMins;
  if (duringHours && !hadCompletedToday) return { main: "Hali bron yo'q", sub: "", nextId: null };
  return { main: "Bugun boshqa bron yo'q", sub: "", nextId: null };
}

function serviceNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[,·+]/).map((part) => part.trim()).filter(Boolean);
}

function canUseShare(data: ShareData): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
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
    // Bookings outside working hours (after-hours override) must not stretch the free time.
    if (b.s > cursor) windows.push({ start: cursor, end: Math.min(b.s, workEnd) });
    cursor = Math.max(cursor, b.e);
    if (cursor >= workEnd) break;
  }
  if (cursor < workEnd) windows.push({ start: cursor, end: workEnd });
  return windows.filter((w) => w.end > w.start);
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function DetailsPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: "#FACC15", backgroundColor: "rgba(250,204,21,0.12)" }}
    >
      {label} ➔
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  pillLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  loading?: boolean;
  delay?: number;
  onClick?: () => void;
  testId?: string;
}

function StatCard({
  label, value, subtext, pillLabel, icon: Icon, iconColor, loading, delay = 0, onClick, testId,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={!loading ? onClick : undefined}
      data-testid={testId}
      className={onClick ? "cursor-pointer select-none" : ""}
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
        ) : (
          <div className={`font-display font-bold text-foreground leading-tight ${pillLabel ? "mb-3" : ""} ${String(value).length > 10 ? "text-lg" : "text-2xl"}`}>
            {value}
          </div>
        )}
        {pillLabel && !loading && <DetailsPill label={pillLabel} />}
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
        <DetailsPill label={pillLabel} />
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
function TodayStatsModal({ open, onClose, total, completed, remaining, cancelled, durationMins }: {
  open: boolean; onClose: () => void;
  total: number; completed: number; remaining: number; cancelled: number; durationMins: number;
}) {
  const dh = Math.floor(durationMins / 60);
  const dm = durationMins % 60;
  const durStr = dh > 0 ? (dm > 0 ? `${dh} soat ${dm} daq` : `${dh} soat`) : `${dm} daq`;
  const metricCard =
    "rounded-2xl p-4 text-center min-h-[6.25rem] h-full flex flex-col items-center justify-center";
  const metricLabel = "text-xs mb-1 leading-snug";
  const metricValue = "font-bold text-2xl leading-tight";
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
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`${metricCard} bg-blue-500/8 border border-blue-500/20`}>
            <div className={`${metricLabel} text-blue-400 inline-flex items-center justify-center gap-1.5`}>
              <CheckCircle2 className="w-5 h-5 text-blue-400 stroke-[2.5] shrink-0" />
              <span>Tugallangan</span>
            </div>
            <div className={`${metricValue} text-blue-400`}>{completed} ta</div>
          </div>
          <div className={`${metricCard} bg-green-500/8 border border-green-500/20`}>
            <div className={`${metricLabel} text-emerald-400 inline-flex items-center justify-center gap-1.5`}>
              <Calendar className="w-5 h-5 text-emerald-400 stroke-[2.5] shrink-0" />
              <span>Tasdiqlangan</span>
            </div>
            <div className={`${metricValue} text-emerald-400`}>{remaining} ta</div>
          </div>
          <div className={`${metricCard} bg-red-500/8 border border-red-500/20`}>
            <div className={`${metricLabel} text-red-400 inline-flex items-center justify-center gap-1.5`}>
              <XCircle className="w-5 h-5 text-red-400 stroke-[2.5] shrink-0" />
              <span>Kelmadi & Bekor qilingan</span>
            </div>
            <div className={`${metricValue} text-red-400`}>{cancelled} ta</div>
          </div>
          <div className={`${metricCard} bg-white/5 border border-white/8`}>
            <div className={`${metricLabel} text-slate-300 inline-flex items-center justify-center gap-1.5`}>
              <Timer className="w-5 h-5 text-slate-300 stroke-[2.5] shrink-0" />
              <span>Ishlangan vaqt</span>
            </div>
            <div className={`${metricValue} text-foreground`}>{durationMins > 0 ? durStr : "—"}</div>
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

  const { isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const { data: profile } = useGetProfile();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = tashkentClock(now).date;
  const { data: bookingsData, isLoading: bookingsLoading, refetch } = useListBookings({ date: today });

  // Refresh often and when the app comes back to the screen, so Telegram changes
  // (new, confirmed or cancelled bookings) show up without a reload.
  useEffect(() => {
    const refreshAll = () => {
      void refetch();
      void refetchStats();
    };
    const id = setInterval(refreshAll, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshAll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch, refetchStats]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateBooking = useUpdateBooking();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showBronModal, setShowBronModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
  const [noShowTarget, setNoShowTarget] = useState<Booking | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const bookingsListRef = useRef<HTMLDivElement>(null);
  const bookingItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Today's bookings — for stats, free-slot calc, and TodayStatsModal
  const bookings = bookingsData?.bookings ?? [];
  const todayRevenue = bookings
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + Number(b.price || 0), 0);

  const openBookings = bookings
    .filter((b) => isOpenBooking(b.status) && bookingDay(b.date) === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  // A confirmed visit whose clock time has passed waits for Keldi / Kelmadi.
  const awaitingClose = (b: Booking) => {
    if (!isOpenBooking(b.status)) return false;
    const start = bookingStartMs(b.date, b.startTime);
    return Number.isFinite(start) && start < now.getTime();
  };
  const reviewBookings = openBookings
    .filter((b) => bookingDay(b.date) === today && awaitingClose(b))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcomingBookings = openBookings
    .filter((b) => !awaitingClose(b))
    .slice(0, 10);

  // Today's upcoming only — used for "next booking" time calculation (same-day, time-based)
  const todayUpcoming = bookings
    .filter((b) => !isDroppedBooking(b.status) && b.status !== "completed")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Compute free time windows from today's own working hours (per weekday) and bookings
  const extraProfile = (profile ?? {}) as ScheduleSource & {
    lunchBreakEnabled?: boolean;
    lunchBreakStart?: string | null;
    lunchBreakEnd?: string | null;
  };
  const todayHours = resolveDaySchedule(extraProfile, today);
  const workStart = toMins(todayHours.start);
  const workEnd   = toMins(todayHours.end);
  const todayBusy = bookings.filter(b => !isDroppedBooking(b.status));
  const lunchBusy =
    extraProfile.lunchBreakEnabled && extraProfile.lunchBreakStart && extraProfile.lunchBreakEnd
      ? [{ startTime: extraProfile.lunchBreakStart, endTime: extraProfile.lunchBreakEnd }]
      : [];
  const isOffDay = !todayHours.enabled;
  const freeWindows = isOffDay
    ? []
    : computeFreeWindows(workStart, workEnd, [...todayBusy, ...lunchBusy]);
  const SLOT_MIN = 30;
  const freeSlots   = freeWindows.reduce((s, w) => s + Math.floor((w.end - w.start) / SLOT_MIN), 0);

  // The report tiles must add up to every booking made today.
  const reportStatus = (status: string) => status.trim().toLowerCase();
  const todayCompleted = bookings.filter((b) => reportStatus(b.status) === "completed").length;
  const todayRemaining = bookings.filter((b) => {
    const status = reportStatus(b.status);
    return status === "confirmed" || status === "pending" || status === "pending_action";
  }).length;
  const todayCancelled = bookings.filter((b) => {
    const status = reportStatus(b.status);
    return status === "no_show" || status === "cancelled" || status === "auto_cancelled";
  }).length;
  const todayTotal = todayCompleted + todayRemaining + todayCancelled;
  const todayDurMins = bookings
    .filter(b => b.status === "completed")
    .reduce((s, b) => s + toMins(b.endTime) - toMins(b.startTime), 0);

  const durationLabel = calcTotalDuration(todayUpcoming);

  const hadCompletedToday = bookings.some((b) => reportStatus(b.status) === "completed");
  const { main: nextMain, sub: nextSub, nextId } = calcNextBookingInfo(upcomingBookings, now, {
    enabled: todayHours.enabled,
    startMins: workStart,
    endMins: workEnd,
  }, hadCompletedToday);

  async function shareBookingLink() {
    const slug = profile?.username?.trim();
    if (!slug) {
      toast({ title: "Havola tayyor emas", description: "Avval sahifa manzilini saqlang" });
      return;
    }
    const url = `${APP_ORIGIN}/${slug}`;
    const shareData: ShareData = {
      title: "Onlayn bron qilish -",
      text: "Barbershopimizga onlayn bron qilish uchun ushbu havola orqali o'ting:",
      url,
    };
    if (canUseShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
      return;
    }
    const copied = await copyText(url);
    toast(copied
      ? { title: "✅ Havola nusxalandi! Uni mijozga yuborishingiz mumkin." }
      : { title: "Nusxalanmadi", description: "Qayta urinib ko'ring", variant: "destructive" });
  }

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

  async function markBookings(rows: Booking[], status: "completed" | "no_show") {
    if (rows.length === 0 || busyKey) return;
    const key = rows.length === 1 ? rows[0].id : "all";
    setBusyKey(key);
    try {
      await Promise.all(rows.map((row) => updateBooking.mutateAsync({
        bookingId: row.id,
        data: { status: status as "completed" },
      })));
      await Promise.all([
        refetch(),
        refetchStats(),
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() }),
      ]);
      const sum = rows.reduce((total, row) => total + Number(row.price || 0), 0);
      if (status === "completed") {
        const allToday = rows.every((row) => bookingDay(row.date) === today);
        toast({
          title: rows.length > 1 ? "Barchasi bajarildi" : "✓ Keldi",
          description: allToday
            ? `${sum.toLocaleString()} so'm bugungi daromadga qo'shildi`
            : `${sum.toLocaleString()} so'm bron sanasidagi daromadga qo'shildi`,
        });
      } else {
        toast({ title: "Kelmadi", description: "Bu bron daromadga qo'shilmadi" });
      }
    } catch {
      toast({ title: "Saqlanmadi", description: "Qayta urinib ko'ring", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {/* Card 1: Bugungi bronlar */}
        <InteractiveCard
          label="Bugungi bronlar"
          value={todayBusy.length === 0 ? "—" : `${todayBusy.length} ta`}
          pillLabel="Tafsilotlar"
          icon={CalendarDays}
          iconColor="text-amber-400"
          loading={bookingsLoading}
          delay={0}
          onClick={() => setShowBronModal(true)}
        />

        {/* Card 2: Bugungi daromad */}
        <StatCard
          label="Bugungi daromad"
          value={bookingsLoading ? "..." : todayRevenue === 0 ? "—" : `${todayRevenue.toLocaleString()} so'm`}
          pillLabel="Tafsilotlar"
          icon={Wallet}
          iconColor="text-emerald-400"
          loading={bookingsLoading}
          delay={0.05}
          testId="revenue-details"
          onClick={() => setIsFinancialModalOpen(true)}
        />

        {/* Card 3: Bo'sh joylar */}
        <InteractiveCard
          label="Bo'sh joylar"
          value={`${freeSlots} ta`}
          pillLabel="Ko'rish"
          icon={Timer}
          iconColor="text-blue-400"
          loading={statsLoading || bookingsLoading}
          delay={0.1}
          onClick={() => setShowSlotModal(true)}
        />

        {/* Card 4: Keyingi bron */}
        <StatCard
          label="Keyingi bron"
          value={nextMain}
          subtext={nextSub || undefined}
          icon={Clock}
          iconColor="text-purple-400"
          delay={0.15}
          testId="next-booking-card"
          onClick={nextId ? handleScrollToNext : undefined}
        />
      </div>

      {bookingsLoading ? (
        <p className="text-muted-foreground text-center py-8 text-sm">{t("loading")}</p>
      ) : (
        <div ref={bookingsListRef} className="space-y-8">
          {upcomingBookings.length > 0 && (
            <section data-testid="upcoming-feed">
              <h2 className="text-lg font-bold text-foreground mb-4">{t("dash.recent_bookings")}</h2>
              <div className="space-y-2">
                {upcomingBookings.map((b) => {
                  const look = bookingLook(b, now.getTime());
                  return (
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
                    >
                      <div className={`w-14 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${look.badge}`}>
                        <span className="text-sm whitespace-nowrap">{b.startTime.slice(0, 5)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">{b.clientName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {serviceNames(b.serviceName).join(", ") || t("dash.service_fallback")}
                        </div>
                        <BookingNoteBadge note={noteFromBooking(b)} />
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <div className={`text-sm font-semibold ${look.price}`}>{b.price.toLocaleString()} so'm</div>
                        <BookingStatusBadge booking={b} now={now.getTime()} />
                      </div>
                    </Card>
                  </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {reviewBookings.length > 0 && (
            <section data-testid="review-feed">
              <h2 className="text-lg font-bold text-foreground mb-4">⚠️ Yakunlash kutilmoqda</h2>
              <div className="space-y-2">
                {reviewBookings.map((b) => (
                  <Card key={b.id} className="relative bg-card border-white/5 overflow-hidden">
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400/80" aria-hidden />
                    <button type="button" onClick={() => setSelectedBooking(b)} className="w-full px-4 py-3 flex items-center gap-4 text-left">
                      <div className="w-14 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                        <span className="text-sm whitespace-nowrap">{b.startTime.slice(0, 5)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">{b.clientName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {serviceNames(b.serviceName).join(", ") || t("dash.service_fallback")}
                        </div>
                        <BookingNoteBadge note={noteFromBooking(b)} />
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <div className="text-sm font-semibold text-yellow-500">{b.price.toLocaleString()} so'm</div>
                        <BookingStatusBadge booking={b} now={now.getTime()} />
                      </div>
                    </button>
                    <p className="px-4 pb-2 text-xs text-muted-foreground leading-snug">
                      ⚠️ Holati belgilanmaguncha daromadga qoʻshilmaydi
                    </p>
                    <div className="flex gap-1.5 px-4 pb-3">
                      <button
                        type="button"
                        data-testid={`keldi-${b.id}`}
                        disabled={busyKey !== null}
                        onClick={() => void markBookings([b], "completed")}
                        className="flex-1 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-40"
                      >✅ Keldi</button>
                      <button
                        type="button"
                        data-testid={`kelmadi-${b.id}`}
                        disabled={busyKey !== null}
                        onClick={() => setNoShowTarget(b)}
                        className="flex-1 h-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold disabled:opacity-40"
                      >❌ Kelmadi</button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {upcomingBookings.length === 0 && reviewBookings.length === 0 && (
            <div data-testid="dashboard-empty" className="px-1 pt-2 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground/70">
                <Calendar className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <p className="mx-auto max-w-[280px] text-base font-semibold leading-snug text-foreground">
                Xayrli kun! Bugun hali bronlar mavjud emas
              </p>
              <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-muted-foreground/70">
                Mijozlaringizga bron havolasini yuboring yoki qo‘lda bron qo‘shing.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="share-booking-link"
                  onClick={() => { void shareBookingLink(); }}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 text-[13px] font-semibold text-foreground"
                >
                  🔗 Havolani ulashish
                </button>
                <button
                  type="button"
                  data-testid="empty-add-booking"
                  onClick={() => setAddOpen(true)}
                  className="h-11 rounded-xl border border-primary/30 bg-primary/15 text-[13px] font-semibold text-primary"
                >
                  ➕ Bron qo‘shish
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking detail modal */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onRefetch={() => { void refetch(); }}
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
        cancelled={todayCancelled}
        durationMins={todayDurMins}
      />

      {/* Free slots bottom sheet */}
      <FreeSlotModal
        open={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        freeWindows={freeWindows}
        totalFreeSlots={freeSlots}
      />

      <BookingFlowDialog open={addOpen} onOpenChange={setAddOpen} />

      <NoShowConfirmModal
        open={!!noShowTarget}
        busy={busyKey !== null}
        onCancel={() => setNoShowTarget(null)}
        onConfirm={() => {
          if (!noShowTarget) return;
          const row = noShowTarget;
          setNoShowTarget(null);
          void markBookings([row], "no_show");
        }}
      />

      <AnimatePresence>
        {isFinancialModalOpen && (
          <IncomeAnalyticsSheet
            key="moliya"
            onClose={() => setIsFinancialModalOpen(false)}
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
