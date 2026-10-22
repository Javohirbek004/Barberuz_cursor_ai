import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useListBookings, useGetDashboardStats, useUpdateBooking, getListClientsQueryKey } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isOpenBooking } from "@/lib/booking-feed";
import { BookingStatusBadge, bookingLook } from "@/components/BookingStatusBadge";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { BookingNoteBadge } from "@/components/BookingNoteBadge";
import { noteFromBooking } from "@/lib/booking-note";
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

function fromISO(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
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

// ── Month Nav ─────────────────────────────────────────────────────────────────
function MonthNav({
  selected,
  onSelect,
  unresolvedDates,
  unresolvedCount,
  jumpIso,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  unresolvedDates: Set<string>;
  unresolvedCount: number;
  jumpIso: string | null;
}) {
  const today = tashkentTodayDate();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = getDaysInMonth(viewYear, viewMonth);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const selectedIso = toISO(selected);

  useEffect(() => {
    const year = selected.getFullYear();
    const month = selected.getMonth();
    if (year !== viewYear || month !== viewMonth) {
      setViewYear(year);
      setViewMonth(month);
    }
    // View month is only synced when the selected day itself changes (e.g. Bugun).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIso]);

  useEffect(() => {
    const container = scrollRef.current;
    const el = pillRefs.current[selectedIso];
    if (container && el) {
      const left = el.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    } else if (container && isCurrentMonth) {
      container.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [viewMonth, viewYear, isCurrentMonth, selectedIso]);

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

      {unresolvedCount > 0 && jumpIso && (
        <button
          type="button"
          data-testid="unresolved-banner"
          onClick={() => {
            const day = fromISO(jumpIso);
            setViewYear(day.getFullYear());
            setViewMonth(day.getMonth());
            onSelect(day);
          }}
          className="w-full flex items-center gap-2 rounded-xl bg-card border border-white/5 px-3 py-2.5 text-left hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          <span className="text-lg leading-none text-foreground shrink-0">←</span>
          <span className="text-sm font-medium text-foreground">
            🔴 {unresolvedCount} ta tasdiqlanmagan bron bor
          </span>
        </button>
      )}

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
              ref={(el) => { pillRefs.current[iso] = el; }}
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
  const [showDropped, setShowDropped] = useState(false);

  const selectedISO = toISO(selectedDate);
  useEffect(() => { setReviewOpen(true); }, [selectedISO]);
  const { data: bookingsData, isLoading, refetch } = useListBookings({ date: selectedISO });
  const { data: overdueData, refetch: refetchOverdue } = useListBookings({ date: "overdue" as any });
  const { refetch: refetchStats } = useGetDashboardStats();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const bookings = (bookingsData?.bookings ?? [])
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const isPastDay = selectedISO < todayISO;
  const reviewBookings = isPastDay
    ? bookings.filter((b) => isOpenBooking(b.status))
    : [];
  const reviewIds = new Set(reviewBookings.map((b) => b.id));
  const listedBookings = bookings.filter((b) => !reviewIds.has(b.id));
  const isDroppedVisit = (status: string) =>
    status === "cancelled" || status === "auto_cancelled" || status === "no_show";
  const droppedCount = listedBookings.filter((b) => isDroppedVisit(b.status)).length;
  const visibleBookings = showDropped
    ? listedBookings
    : listedBookings.filter((b) => !isDroppedVisit(b.status));
  const pastUnresolved = (overdueData?.bookings ?? [])
    .filter((b) => isOpenBooking(b.status) && b.date < todayISO)
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));
  const unresolvedDates = new Set(pastUnresolved.map((b) => b.date));
  const unresolvedCount = pastUnresolved.length;
  const jumpIso = pastUnresolved[0]?.date ?? null;

  async function markBooking(row: Booking, status: "completed" | "no_show") {
    if (busyKey) return;
    setBusyKey(row.id);
    try {
      await updateBooking.mutateAsync({
        bookingId: row.id,
        data: { status: status as "completed" },
      });
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
      <MonthNav
        selected={selectedDate}
        onSelect={setSelectedDate}
        unresolvedDates={unresolvedDates}
        unresolvedCount={unresolvedCount}
        jumpIso={jumpIso}
      />

      <label className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-card px-3.5 py-3">
        <span className="text-[13px] font-semibold leading-snug text-foreground">
          🚫 Bekor qilinganlar & Kelmaganlar ({droppedCount})
        </span>
        <Switch
          checked={showDropped}
          onCheckedChange={setShowDropped}
          data-testid="calendar-dropped-toggle"
          aria-label="Bekor qilinganlar va kelmaganlarni ko'rsatish"
          className="data-[state=unchecked]:bg-white/25 data-[state=checked]:bg-primary"
        />
      </label>

      {/* Booking list */}
      <div className="space-y-3" data-testid="calendar-timeline">
        {reviewBookings.length > 0 && (
          <section data-testid="calendar-review" className="space-y-2">
            <button
              type="button"
              data-testid="calendar-review-toggle"
              onClick={() => setReviewOpen((open) => !open)}
              className="w-full min-h-11 flex items-center justify-between gap-3 text-left py-2.5 px-1 rounded-xl hover:bg-white/5 active:bg-white/8"
            >
              <span className="text-sm font-bold text-foreground">
                ⚠️ Yakunlash kutilmoqda ({reviewBookings.length})
              </span>
              {reviewOpen
                ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
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
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold truncate text-foreground">{b.clientName}</span>
                          <BookingStatusBadge booking={b} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-sm truncate text-muted-foreground">{b.serviceName ?? "—"}</span>
                          <span className="text-sm font-semibold ml-2 shrink-0 text-primary">{b.price.toLocaleString()} so'm</span>
                        </div>
                        <BookingNoteBadge note={noteFromBooking(b)} />
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
        ) : visibleBookings.length === 0 && reviewBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Bugun bronlar mavjud emas</p>
            <p className="text-xs text-muted-foreground/45 mt-1.5">Yangi bron qo'shish uchun + tugmasini bosing</p>
          </div>
        ) : (
          visibleBookings.map((b, i) => {
            const view = bookingLook(b);
            return (
            <motion.button
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: view.key === "completed" ? 0.6 : 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedBooking(b)}
              data-testid={`cal-card-${b.id}`}
              className={`w-full text-left rounded-2xl border p-4 flex items-start gap-4 transition-colors ${view.card}`}
            >
              <div className="flex flex-col items-center min-w-[2.75rem]">
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {b.startTime.slice(0, 5)}
                </span>
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full ${view.dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold truncate text-foreground">
                    {b.clientName}
                  </span>
                  <BookingStatusBadge booking={b} testId={`cal-status-${b.id}`} />
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm truncate text-muted-foreground">
                    {b.serviceName ?? "—"}
                  </span>
                  <span className={`text-sm font-semibold ml-2 shrink-0 ${view.price}`}>
                    {b.price.toLocaleString()} so'm
                  </span>
                </div>
                <BookingNoteBadge
                  note={noteFromBooking(b)}
                  muted={b.status === "completed" || b.status === "cancelled" || b.status === "auto_cancelled"}
                />
              </div>
            </motion.button>
            );
          })
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
