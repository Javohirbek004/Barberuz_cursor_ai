import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Check, CheckCircle, XCircle, AlertTriangle, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClient,
  useUpdateBooking,
  useUpdateClient,
  getListBookingsQueryKey,
  getGetClientQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { isElapsedBooking } from "@/lib/booking-feed";

const UZ_SHORT_MONTHS = [
  "Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek",
];

function parseBookingNotes(raw: string | null): { phone: string | null; userNotes: string } {
  if (!raw) return { phone: null, userNotes: "" };
  const lines = raw.split("\n");
  if (lines[0].startsWith("Tel: ")) {
    return {
      phone: lines[0].slice(5).trim(),
      userNotes: lines.slice(1).join("\n").trim(),
    };
  }
  return { phone: null, userNotes: raw.trim() };
}

function formatBookingDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Bugun";
  const d = new Date(dateStr);
  return `${d.getDate()}-${UZ_SHORT_MONTHS[d.getMonth()]}`;
}

function formatSom(value: number | string): string {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString("uz-UZ")} so'm`;
}

/** Display and dial as +998XXXXXXXXX. */
function formatDialPhone(raw: string): { display: string; href: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const national = digits.startsWith("998") ? digits.slice(3) : digits;
  if (national.length < 9) return { display: raw.trim(), href: `tel:${raw.trim()}` };
  const e164 = `+998${national.slice(-9)}`;
  return { display: e164, href: `tel:${e164}` };
}

function SheetRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[48px] py-3 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 text-right text-[13px] font-medium text-foreground leading-snug">
        {children}
      </div>
    </div>
  );
}

function PhoneRow({ phone }: { phone: string }) {
  const dial = formatDialPhone(phone);
  if (!dial) {
    return <SheetRow label="Telefon"><span className="text-muted-foreground/40">—</span></SheetRow>;
  }
  return (
    <SheetRow label="Telefon">
      <a
        href={dial.href}
        data-testid="call-client"
        aria-label={`Qo'ng'iroq qilish: ${dial.display}`}
        className="inline-flex items-center justify-end gap-1.5 text-emerald-400 font-medium tabular-nums hover:underline underline-offset-4 decoration-emerald-400/50 active:opacity-80"
      >
        <Phone className="w-3.5 h-3.5 shrink-0" />
        {dial.display}
      </a>
    </SheetRow>
  );
}

// ── NoteSection — defined OUTSIDE BookingDetailModal so React never treats it
// as a new component type on parent re-render (which would unmount the textarea
// and dismiss the mobile keyboard on every keystroke).
interface NoteSectionProps {
  label: string;
  value: string;
  isEditing: boolean;
  isSaving: boolean;
  isSaved: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  emptyLabel?: string;
  onEditEnter: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onRevert: () => void;
}

function NoteSection({
  label, value, isEditing, isSaving, isSaved, textareaRef,
  placeholder, emptyLabel = "Eslatma qo'shilmagan",
  onEditEnter, onChange, onSave, onRevert,
}: NoteSectionProps) {
  return (
    <div className="py-4 border-b border-white/8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>

        <AnimatePresence mode="wait">
          {isSaved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Saqlandi
            </motion.span>
          ) : isEditing ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              <button
                onClick={onRevert}
                disabled={isSaving}
                className="w-8 h-8 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center hover:bg-white/14 active:scale-95 transition-all disabled:opacity-40"
                aria-label="Bekor qilish"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/25 active:scale-95 transition-all disabled:opacity-40"
                aria-label="Saqlash"
              >
                {isSaving
                  ? <span className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                  : <Check className="w-4 h-4 text-emerald-400" />
                }
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="edit-btn"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              onClick={onEditEnter}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/6 border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">Tahrirlash</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Body: view text OR editable textarea */}
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.textarea
            key="textarea"
            ref={textareaRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full bg-white/5 border border-primary/40 bg-white/[0.07] rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/35 resize-none focus:outline-none focus:border-primary/60 transition-all"
          />
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onEditEnter}
            className="w-full min-h-[72px] bg-white/4 border border-white/8 rounded-2xl px-4 py-3 cursor-text"
          >
            {value ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground/40 italic">{emptyLabel}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BookingDetailModal({
  booking,
  onClose,
  onRefetch,
  onRefetchStats,
}: {
  booking: Booking;
  onClose: () => void;
  onRefetch: () => void;
  onRefetchStats?: () => void;
}) {
  const { toast } = useToast();

  // ── Client note (registered-client bookings) ──────────────────
  const [clientNote, setClientNote] = useState("");
  const [clientNoteEditing, setClientNoteEditing] = useState(false);
  const [clientNoteSaved, setClientNoteSaved] = useState(false);
  const clientNoteBase = useRef("");
  const clientTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Booking note (quick / no-clientId bookings) ───────────────
  const [bookingNote, setBookingNote] = useState("");
  const [bookingNoteEditing, setBookingNoteEditing] = useState(false);
  const [bookingNoteSaved, setBookingNoteSaved] = useState(false);
  const bookingNoteBase = useRef("");
  const bookingTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: clientData } = useGetClient(
    booking.clientId ?? "",
    { query: { enabled: !!booking.clientId } },
  );

  const queryClient = useQueryClient();
  const updateBookingMut = useUpdateBooking();
  const updateClientMut = useUpdateClient();

  // Hide bottom nav while sheet is open
  useEffect(() => {
    document.body.classList.add("sheet-open");
    const nav = document.getElementById("bottom-nav-root");
    if (nav) nav.style.visibility = "hidden";
    return () => {
      document.body.classList.remove("sheet-open");
      if (nav) nav.style.visibility = "";
    };
  }, []);

  // Init client note value when data first arrives or after a confirmed save.
  // Do NOT reset clientNoteEditing here — editing state is managed exclusively
  // by enterClientEdit / handleClientNoteSave / handleClientNoteRevert so that
  // background refetches (triggered by onRefetch()) can't kill a mid-edit session.
  const clientNoteInitialized = useRef(false);
  useEffect(() => {
    if (clientData?.notes !== undefined) {
      const val = clientData.notes ?? "";
      clientNoteBase.current = val;
      if (!clientNoteInitialized.current) {
        // First load: seed the textarea value
        setClientNote(val);
        clientNoteInitialized.current = true;
      }
      // Subsequent refetches (e.g. after onRefetch()): only update base snapshot so
      // revert works correctly, but leave any in-progress textarea content alone.
    }
  }, [clientData?.notes]);

  // Init booking note only when booking ID changes (no stale overwrite)
  useEffect(() => {
    const { userNotes } = parseBookingNotes(booking.notes ?? null);
    setBookingNote(userNotes);
    setBookingNoteEditing(false);
    bookingNoteBase.current = userNotes;
  }, [booking.id]);

  const { phone: parsedPhone } = parseBookingNotes(booking.notes ?? null);

  // ── Edit-mode entry (auto-focus textarea) ─────────────────────
  const enterClientEdit = () => {
    setClientNoteEditing(true);
    setTimeout(() => clientTextareaRef.current?.focus(), 60);
  };

  const enterBookingEdit = () => {
    setBookingNoteEditing(true);
    setTimeout(() => bookingTextareaRef.current?.focus(), 60);
  };

  // ── Save / revert handlers ────────────────────────────────────
  const handleClientNoteSave = () => {
    if (!booking.clientId) return;
    updateClientMut.mutate(
      { clientId: booking.clientId, data: { notes: clientNote } },
      {
        onSuccess: () => {
          clientNoteBase.current = clientNote;
          setClientNoteEditing(false);
          setClientNoteSaved(true);
          setTimeout(() => setClientNoteSaved(false), 2500);
          // Invalidate all bookings and this client so Dashboard, Calendar,
          // ClientDetail all reflect the updated note immediately.
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(booking.clientId!) });
          onRefetch();
        },
      },
    );
  };

  const handleClientNoteRevert = () => {
    setClientNote(clientNoteBase.current);
    setClientNoteEditing(false);
  };

  const handleBookingNoteSave = () => {
    const encoded = parsedPhone
      ? `Tel: ${parsedPhone}\n${bookingNote}`.trim()
      : bookingNote.trim() || null;
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { notes: encoded } },
      {
        onSuccess: () => {
          bookingNoteBase.current = bookingNote;
          setBookingNoteEditing(false);
          setBookingNoteSaved(true);
          setTimeout(() => setBookingNoteSaved(false), 2500);
          // Invalidate all bookings so Dashboard, Calendar all reflect the updated note.
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          onRefetch();
        },
      },
    );
  };

  const handleBookingNoteRevert = () => {
    setBookingNote(bookingNoteBase.current);
    setBookingNoteEditing(false);
  };

  const refreshClientLists = () => {
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    if (booking.clientId) {
      queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(booking.clientId) });
    }
  };

  // ── Booking status actions ─────────────────────────────────────
  const bookingPrice = Number(booking.price) || 0;

  const handleComplete = () => {
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { status: "completed", price: bookingPrice } },
      {
        onSuccess: () => {
          refreshClientLists();
          onClose();
          onRefetch();
          onRefetchStats?.();
          toast({
            title: "✓ Muvaffaqiyatli yakunlandi",
            description: `${booking.clientName} — ${bookingPrice.toLocaleString()} so'm daromadga qo'shildi`,
            duration: 3000,
          });
        },
      },
    );
  };

  const handleNoShow = () => {
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { status: "no_show" as "cancelled" } },
      {
        onSuccess: () => {
          refreshClientLists();
          onClose();
          onRefetch();
          onRefetchStats?.();
          toast({ title: "Kelmadi", description: "Bu bron daromadga qo'shilmadi" });
        },
      },
    );
  };

  const handleConfirmCancel = () => {
    updateBookingMut.mutate(
      { bookingId: booking.id, data: { status: "cancelled" } },
      {
        onSuccess: () => {
          refreshClientLists();
          onClose();
          onRefetch();
          onRefetchStats?.();
        },
      },
    );
  };

  const isBusy = updateBookingMut.isPending;
  const bookingStatus = booking.status as string;
  const isActive = bookingStatus !== "cancelled" && bookingStatus !== "auto_cancelled" && bookingStatus !== "completed" && bookingStatus !== "no_show";
  const needsReview = isActive && isElapsedBooking(booking.date, booking.startTime);
  const dateLabel = formatBookingDate(booking.date);
  const phone = clientData?.phone ?? parsedPhone;

  return (
    <div className="fixed inset-0 z-[200] flex items-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative w-full bg-[#1a1a1f] rounded-t-3xl border-t border-x border-white/8 z-10 flex flex-col"
        style={{ maxHeight: "70vh" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

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
          <div className="py-1 border-b border-white/8">
            <SheetRow label="Xizmat">{booking.serviceName ?? "—"}</SheetRow>
            <SheetRow label="Vaqt">
              {`${dateLabel} • ${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`}
            </SheetRow>
            {phone
              ? <PhoneRow phone={phone} />
              : <SheetRow label="Telefon"><span className="text-muted-foreground/40">—</span></SheetRow>}
            <SheetRow label="Narxi">
              <span className="font-semibold tabular-nums text-foreground/95">
                {formatSom(bookingPrice)}
              </span>
            </SheetRow>
            <SheetRow label="Holat">
              <span className={`inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide ${
                booking.status === "confirmed" ? "bg-emerald-500/12 text-emerald-400" :
                booking.status === "pending"   ? "bg-amber-500/12 text-amber-400" :
                booking.status === "completed" ? "bg-blue-500/12 text-blue-400" :
                                                  "bg-red-500/12 text-red-400"
              }`}>
                {booking.status === "confirmed" ? "Tasdiqlangan" :
                 booking.status === "pending"   ? "Kutilmoqda" :
                 booking.status === "completed" ? "Yakunlangan" :
                 bookingStatus === "no_show" ? "Kelmadi" :
                 bookingStatus === "auto_cancelled" ? "Avtomatik bekor" : "Bekor qilingan"}
              </span>
            </SheetRow>
          </div>

          {/* ── Section 3: Note (view/edit toggle) ── */}
          {booking.clientId ? (
            <NoteSection
              label="Mijoz haqida eslatma"
              value={clientNote}
              isEditing={clientNoteEditing}
              isSaving={updateClientMut.isPending}
              isSaved={clientNoteSaved}
              textareaRef={clientTextareaRef}
              placeholder="Soch uzunligi, rang xohishi, maxsus talablar..."
              onEditEnter={enterClientEdit}
              onChange={setClientNote}
              onSave={handleClientNoteSave}
              onRevert={handleClientNoteRevert}
            />
          ) : (
            <NoteSection
              label="Bron eslatmasi"
              value={bookingNote}
              isEditing={bookingNoteEditing}
              isSaving={updateBookingMut.isPending}
              isSaved={bookingNoteSaved}
              textareaRef={bookingTextareaRef}
              placeholder="Maxsus talablar, eslatmalar..."
              onEditEnter={enterBookingEdit}
              onChange={setBookingNote}
              onSave={handleBookingNoteSave}
              onRevert={handleBookingNoteRevert}
            />
          )}

          {/* ── Section 4: Action buttons ── */}
          {needsReview && (
            <div className="pt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleNoShow}
                disabled={isBusy}
                data-testid="modal-kelmadi"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                ❌ Kelmadi
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isBusy}
                data-testid="modal-keldi"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                {isBusy ? "..." : "✅ Keldi va to'ladi"}
              </button>
            </div>
          )}

          {isActive && !needsReview && !confirmCancel && (
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

          {isActive && !needsReview && confirmCancel && (
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
                  {booking.clientName} uchun {booking.startTime.slice(0, 5)} da belgilangan bron o'chiriladi.
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
              bookingStatus === "cancelled" || bookingStatus === "auto_cancelled"
                ? "bg-red-500/10 text-red-400 border border-red-500/15"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/15"
            }`}>
              {bookingStatus === "no_show" ? "✕  Kelmadi" : bookingStatus === "auto_cancelled" ? "✕  Avtomatik bekor" : bookingStatus === "cancelled" ? "✕  Bekor qilingan" : "✓  Yakunlangan"}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
