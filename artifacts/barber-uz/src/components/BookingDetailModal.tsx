import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, CheckCircle, XCircle, Save, AlertTriangle } from "lucide-react";
import {
  useGetClient,
  useUpdateBooking,
  useUpdateClient,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const UZ_SHORT_MONTHS = [
  "Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek",
];

function formatBookingDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Bugun";
  const d = new Date(dateStr);
  return `${d.getDate()}-${UZ_SHORT_MONTHS[d.getMonth()]}`;
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground flex-shrink-0 mr-4">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
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
  const [notesValue, setNotesValue] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: clientData } = useGetClient(
    booking.clientId ?? "",
    { query: { enabled: !!booking.clientId } },
  );

  const updateBookingMut = useUpdateBooking();
  const updateClientMut = useUpdateClient();

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
          onRefetchStats?.();
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
          onRefetchStats?.();
        },
      },
    );
  };

  const isBusy = updateBookingMut.isPending;
  const isActive = booking.status !== "cancelled" && booking.status !== "completed";
  const dateLabel = formatBookingDate(booking.date);
  const phone = clientData?.phone;

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
          <div className="py-4 space-y-0 border-b border-white/8">
            <SheetRow label="Xizmat" value={booking.serviceName ?? "—"} />
            <SheetRow
              label="Vaqt va Sana"
              value={`${dateLabel} • ${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`}
            />
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Telefon raqami</span>
              {phone ? (
                <a href={`tel:${phone}`} className="flex items-center gap-2 text-emerald-400 font-semibold text-sm hover:text-emerald-300 active:opacity-70 transition-all">
                  <Phone className="w-4 h-4" />
                  {phone}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
              )}
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Narxi</span>
              <span className="text-xl font-bold text-primary">
                {booking.price.toLocaleString()} so'm
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Holat</span>
              <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wide ${
                booking.status === "confirmed" ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20" :
                booking.status === "pending"   ? "bg-amber-500/12 text-amber-400 border border-amber-500/20" :
                booking.status === "completed" ? "bg-blue-500/12 text-blue-400 border border-blue-500/20" :
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
