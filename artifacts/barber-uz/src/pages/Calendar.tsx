import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListBookings, useGetDashboardStats, useUpdateBooking, getListClientsQueryKey } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isOpenBooking } from "@/lib/booking-feed";
import {
  demoUnresolvedDates,
  isDemoBookingId,
  mergeDemoBookings,
  setDemoBookingStatus,
  useDemoUnresolved,
} from "@/lib/demo-unresolved";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { NoShowConfirmModal } from "@/components/NoShowConfirmModal";

// ── Date helpers ───────────────────────────────────────────────────────────────
const UZ_MONTHS = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];
const UZ_DAY_SHORT = ["Yak","Du","Se","Cho","Pa","Ju","Sha"];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Same calendar day the booking form and API use (Tashkent), not the computer clock. */
function tashkentTodayDate(): Date {
  const iso = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

function formatHeaderDate(date: Date): string {
  const d = date.getDate();
  const m = UZ_MONTHS[date.getMonth()];
  const wd = UZ_DAY_SHORT[date.getDay()];
  return `${d}-${m.toLowerCase()}, ${wd}`;
}

// ── 3-status config ───────────────────────────────────────────────────────────
const STATUS_CARD: Record<string, string> = {
  confirmed: "border-emerald-500/25 bg-emerald-500/5",
  completed: "border-blue-400/20 bg-blue-500/5",
  cancelled:  "border-red-500/20 bg-red-500/5 opacity-60",
  auto_cancelled: "border-red-500/20 bg-red-500/5 opacity-60",
  no_show: "border-red-500/20 bg-red-500/5 opacity-60",
  pending:    "border-amber-400/25 bg-amber-400/5",
};
const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-emerald-500",
  completed: "bg-blue-400/70",
  cancelled:  "bg-red-500",
  auto_cancelled: "bg-red-500",
  no_show: "bg-red-500",
  pending:    "bg-amber-400",
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Tasdiqlandi",
  completed: "Yakunlandi",
  cancelled:  "Bekor qilindi",
  auto_cancelled: "Avtomatik bekor",
  no_show: "Kelmadi",
  pending:    "Kutilmoqda",
};
const STATUS_TEXT: Record<string, string> = {
  confirmed: "text-emerald-400",
  completed: "text-blue-400/80",
  cancelled:  "text-red-400",
  auto_cancelled: "text-red-400",
  no_show: "text-red-400",
  pending:    "text-amber-400",
};

// ── Month Nav ─────────────────────────────────────────────────────────────────
function MonthNav({
  selected,
  onSelect,
  unresolvedDates,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  unresolvedDates: Set<string>;
}) {
  const today = tashkentTodayDate();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = getDaysInMonth(viewYear, viewMonth);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  useEffect(() => {
    if (isCurrentMonth && todayRef.current && scrollRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    } else if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [viewMonth, viewYear, isCurrentMonth]);

  const goToPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="space-y-2 mb-5">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrev}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {UZ_MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={goToNext}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {days.map((day) => {
          const isSelected = isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          const dowIdx = day.getDay();
          const iso = toISO(day);
          const showDot = !isToday && day < today && unresolvedDates.has(iso);

          return (
            <button
              key={day.toISOString()}
              ref={isToday ? todayRef : undefined}
              onClick={() => onSelect(day)}
              data-testid={`cal-pill-${iso}`}
              className={`relative flex flex-col items-center min-w-[3rem] py-2.5 px-1 rounded-2xl transition-all flex-shrink-0 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : isToday
                  ? "bg-primary/15 border border-primary/35 text-primary"
                  : "bg-card border border-white/5 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {showDot && (
                <span
                  data-testid={`unresolved-dot-${iso}`}
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(0,0,0,0.25)]"
                />
              )}
              <span className="text-[9px] font-bold uppercase tracking-wider mb-1">
                {UZ_DAY_SHORT[dowIdx]}
              </span>
              <span className={`text-lg font-bold ${
                isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "text-foreground"
              }`}>
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
  const today = tashkentTodayDate();
  const todayISO = toISO(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [noShowTarget, setNoShowTarget] = useState<Booking | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  useDemoUnresolved();

  const selectedISO = toISO(selectedDate);
  useEffect(() => { setReviewOpen(true); }, [selectedISO]);
  const { data: bookingsData, isLoading, refetch } = useListBookings({ date: selectedISO });
  const { data: overdueData, refetch: refetchOverdue } = useListBookings({ date: "overdue" as any });
  const { refetch: refetchStats } = useGetDashboardStats();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const bookings = mergeDemoBookings(bookingsData?.bookings ?? [], { date: selectedISO })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const isPastDay = selectedISO < todayISO;
  const reviewBookings = isPastDay
    ? bookings.filter((b) => isOpenBooking(b.status))
    : [];
  const reviewIds = new Set(reviewBookings.map((b) => b.id));
  const listedBookings = bookings.filter((b) => !reviewIds.has(b.id));
  const unresolvedDates = new Set([
    ...demoUnresolvedDates(),
    ...(overdueData?.bookings ?? [])
      .filter((b) => isOpenBooking(b.status))
      .map((b) => b.date),
  ]);

  async function markBooking(row: Booking, status: "completed" | "no_show") {
    if (busyKey) return;
    setBusyKey(row.id);
    try {
      if (isDemoBookingId(row.id)) {
        setDemoBookingStatus(row.id, status);
      } else {
        await updateBooking.mutateAsync({
          bookingId: row.id,
          data: { status: status as "completed" },
        });
      }
      await Promise.all([
        refetch(),
        refetchOverdue(),
        refetchStats(),
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() }),
      ]);
      toast({
        title: status === "completed" ? "✓ Keldi" : "Kelmadi",
        description: status === "completed"
          ? `${Number(row.price || 0).toLocaleString()} so'm bron sanasidagi daromadga qo'shildi`
          : "Bu bron daromadga qo'shilmadi",
      });
    } catch {
      toast({ title: "Saqlanmadi", description: "Qayta urinib ko'ring", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Kalendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatHeaderDate(selectedDate)}</p>
        </div>
        <Button
          onClick={() => setSelectedDate(today)}
          size="sm"
          className="rounded-full bg-primary/20 text-primary hover:bg-primary/30 border-0 text-xs h-8"
        >
          Bugun
        </Button>
      </div>

      {/* Month nav */}
      <MonthNav selected={selectedDate} onSelect={setSelectedDate} unresolvedDates={unresolvedDates} />

      {/* Booking list */}
      <div className="space-y-3">
        {reviewBookings.length > 0 && (
          <section data-testid="calendar-review" className="space-y-2">
            <button
              type="button"
              data-testid="calendar-review-toggle"
              onClick={() => setReviewOpen((open) => !open)}
              className="w-full flex items-center justify-between text-left py-1"
            >
              <span className="text-sm font-bold text-foreground">
                ⚠️ Tasdiqlash kutilmoqda ({reviewBookings.length})
              </span>
              <span className="text-muted-foreground text-xs">{reviewOpen ? "⌃" : "⌄"}</span>
            </button>
            {reviewOpen && (
              <div className="space-y-2">
                {reviewBookings.map((b) => (
                  <div key={b.id} className="relative rounded-2xl bg-card border border-white/5 overflow-hidden">
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400/80" aria-hidden />
                    <button type="button" onClick={() => setSelectedBooking(b)} className="w-full p-4 flex items-start gap-4 text-left">
                      <div className="flex flex-col items-center min-w-[2.75rem]">
                        <span className="text-sm font-bold tabular-nums text-foreground">{b.startTime.slice(0, 5)}</span>
                        <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold truncate text-foreground">{b.clientName}</span>
                          <span className="text-xs font-semibold shrink-0 text-amber-400">Kutilmoqda</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-sm truncate text-muted-foreground">{b.serviceName ?? "—"}</span>
                          <span className="text-sm font-semibold ml-2 shrink-0 text-primary">{b.price.toLocaleString()} so'm</span>
                        </div>
                      </div>
                    </button>
                    <p className="px-4 pb-2 text-xs text-muted-foreground leading-snug">
                      ⚠️ Holati belgilanmaguncha daromadga qoʻshilmaydi
                    </p>
                    <div className="flex gap-1.5 px-4 pb-3">
                      <button
                        type="button"
                        data-testid={`cal-keldi-${b.id}`}
                        disabled={busyKey !== null}
                        onClick={() => void markBooking(b, "completed")}
                        className="flex-1 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-40"
                      >✅ Keldi</button>
                      <button
                        type="button"
                        data-testid={`cal-kelmadi-${b.id}`}
                        disabled={busyKey !== null}
                        onClick={() => setNoShowTarget(b)}
                        className="flex-1 h-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold disabled:opacity-40"
                      >❌ Kelmadi</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          </div>
        ) : listedBookings.length === 0 && reviewBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Bugun bronlar mavjud emas</p>
            <p className="text-xs text-muted-foreground/45 mt-1.5">Yangi bron qo'shish uchun + tugmasini bosing</p>
          </div>
        ) : (
          listedBookings.map((b, i) => (
            <motion.button
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedBooking(b)}
              className={`w-full text-left rounded-2xl border p-4 flex items-start gap-4 transition-all ${STATUS_CARD[b.status] ?? STATUS_CARD.confirmed}`}
            >
              <div className="flex flex-col items-center min-w-[2.75rem]">
                <span className={`text-sm font-bold tabular-nums ${b.status === "completed" ? "text-white/40" : "text-foreground"}`}>
                  {b.startTime.slice(0, 5)}
                </span>
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full ${STATUS_DOT[b.status] ?? STATUS_DOT.confirmed}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-bold truncate ${b.status === "completed" ? "text-white/40" : "text-foreground"}`}>
                    {b.clientName}
                  </span>
                  <span className={`text-xs font-semibold shrink-0 ${STATUS_TEXT[b.status] ?? STATUS_TEXT.confirmed}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`text-sm truncate ${b.status === "completed" ? "text-white/30" : "text-muted-foreground"}`}>
                    {b.serviceName ?? "—"}
                  </span>
                  <span className={`text-sm font-semibold ml-2 shrink-0 ${b.status === "completed" ? "text-white/35" : "text-primary"}`}>
                    {b.price.toLocaleString()} so'm
                  </span>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onRefetch={() => { void refetch(); void refetchOverdue(); setSelectedBooking(null); }}
            onRefetchStats={refetchStats}
          />
        )}
      </AnimatePresence>

      <NoShowConfirmModal
        open={!!noShowTarget}
        busy={busyKey !== null}
        onCancel={() => setNoShowTarget(null)}
        onConfirm={() => {
          if (!noShowTarget) return;
          const row = noShowTarget;
          setNoShowTarget(null);
          void markBooking(row, "no_show");
        }}
      />
    </>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function Calendar() {
  const { user } = useAuth();
  const isTeam = user?.mode === "team";

  return (
    <Layout>
      <IndividualCalendar />
    </Layout>
  );
}
