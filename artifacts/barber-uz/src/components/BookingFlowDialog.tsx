/**
 * BookingFlowDialog
 * Central (+) button booking flow — Individual mode.
 *
 * Features:
 *  - Dynamic services from API (empty state → inline add form)
 *  - Phone masking: +998 (XX) XXX-XX-XX
 *  - Standard + after-hours slot generation from barber profile
 *  - Soft override warning before saving after-hours bookings
 *  - Real API save + React Query cache invalidation (Calendar + Dashboard)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  Loader2,
  Calendar,
  Clock,
  Plus,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListServices,
  useCreateService,
  useCreateBooking,
  useListBookings,
  useGetProfile,
  getListBookingsQueryKey,
  getGetDashboardStatsQueryKey,
  getListServicesQueryKey,
} from "@workspace/api-client-react";
import type { Service } from "@workspace/api-client-react";
import { ServiceForm } from "@/components/ServiceForm";
import type { ServiceFormData } from "@/components/ServiceForm";
import {
  useListCategories,
  useCreateCategory,
  type ServiceCategory,
} from "@/hooks/useCategories";

// ── Phone masking ─────────────────────────────────────────────────────────────
function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("998") ? digits.slice(3) : digits;
  const d = withoutCountry.slice(0, 9);

  let result = "+998";
  if (d.length === 0) return result;
  result += " (" + d.slice(0, Math.min(2, d.length));
  if (d.length < 2) return result;
  result += ") " + d.slice(2, Math.min(5, d.length));
  if (d.length < 5) return result;
  result += "-" + d.slice(5, Math.min(7, d.length));
  if (d.length < 7) return result;
  result += "-" + d.slice(7, 9);
  return result;
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtMins(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function generateSlots(
  duration: number,
  busy: { startTime: string; endTime: string }[],
  rangeStart: number,
  rangeEnd: number
): string[] {
  const slots: string[] = [];
  for (let t = rangeStart; t + duration <= rangeEnd; t += 30) {
    const end = t + duration;
    const free = !busy.some((b) => {
      const bs = toMins(b.startTime);
      const be = toMins(b.endTime);
      return t < be && end > bs;
    });
    if (free) slots.push(fmtMins(t));
  }
  return slots;
}

// ── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  phone: string;
  serviceId: string;
  date: string;
  time: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "+998",
  serviceId: "",
  date: todayStr(),
  time: "",
  notes: "",
};

// ── Bottom-sheet wrapper ──────────────────────────────────────────────────────
function Sheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Hide bottom nav while sheet is open
  useEffect(() => {
    const nav = document.getElementById("bottom-nav-root");
    if (nav) nav.style.visibility = "hidden";
    return () => {
      if (nav) nav.style.visibility = "";
    };
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        <div className="overflow-y-auto flex-1 px-5 pb-10">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ── After-hours warning dialog ────────────────────────────────────────────────
function AfterHoursWarning({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="relative w-full max-w-sm bg-[#18181d] rounded-3xl border border-white/8 p-6 z-10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="font-bold text-foreground text-base leading-snug">
            Ish vaqtidan tashqari
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Siz ish vaqtidan tashqari vaqtga bron qo'shmoqdasiz. Baribir davom
          ettirasizmi?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
          >
            Bekor qilish
          </button>
          <button
            onClick={onConfirm}
            className="py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-all"
          >
            Ha, davom etish
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ── Service picker ────────────────────────────────────────────────────────────
function ServicePicker({
  services,
  loading,
  value,
  onChange,
  onAddNew,
}: {
  services: Service[];
  loading: boolean;
  value: string;
  onChange: (id: string) => void;
  onAddNew: () => void;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catCreating, setCatCreating] = useState(false);

  const { data: categories = [] } = useListCategories();
  const createCatMut = useCreateCategory();

  async function handleCreateCat() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setCatCreating(true);
    try {
      const created = await createCatMut.mutateAsync(trimmed);
      setActiveCat(created.id);
      setShowNewCat(false);
      setNewCatName("");
    } finally {
      setCatCreating(false);
    }
  }

  const filtered =
    activeCat === null
      ? services
      : services.filter(
          (s) => (s as Service & { categoryId?: string | null }).categoryId === activeCat,
        );

  if (loading) {
    return (
      <div
        className="overflow-x-auto scrollbar-hide"
        style={{ height: 160 }}
      >
        <div
          className="grid gap-2 pb-1"
          style={{
            gridTemplateRows: "repeat(2, 72px)",
            gridAutoFlow: "column",
            gridAutoColumns: "calc(50% - 4px)",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-full rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 border border-dashed border-white/10 rounded-2xl">
        <p className="text-sm text-muted-foreground">Hali xizmatlar qo'shilmagan</p>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi xizmat qo'shish
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Category bubble filter row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2.5 mb-2">
        <button
          type="button"
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeCat === null ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"}`}
        >
          Hammasi
        </button>
        {categories.map((c: ServiceCategory) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeCat === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"}`}
          >
            {c.name}
          </button>
        ))}
        {showNewCat ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCat()}
              placeholder="Yangi kategoriya"
              className="h-7 w-28 px-2 rounded-full text-xs bg-white/5 border border-white/15 focus:outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={handleCreateCat}
              disabled={catCreating || !newCatName.trim()}
              className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center disabled:opacity-40"
            >
              {catCreating ? (
                <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewCat(false); setNewCatName(""); }}
              className="h-7 w-7 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewCat(true)}
            className="shrink-0 h-7 px-2.5 rounded-full text-xs font-semibold border border-dashed border-white/15 text-muted-foreground/60 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 2-row horizontal scroll grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-white/8 rounded-2xl text-sm text-muted-foreground">
          Bu kategoriyada xizmat yo'q
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div
            className="grid gap-2 pb-1"
            style={{
              gridTemplateRows: "repeat(2, auto)",
              gridAutoFlow: "column",
              gridAutoColumns: "calc(50vw - 52px)",
            }}
          >
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(s.id)}
                className={`flex flex-col items-start p-3 rounded-2xl border transition-all text-left min-w-0 ${
                  value === s.id
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold leading-tight truncate w-full">{s.name}</span>
                <span className="text-xs mt-1 opacity-60 truncate w-full">
                  {s.duration} daqiqa • {s.price.toLocaleString()} so'm
                </span>
              </button>
            ))}
            {/* Inline add tile */}
            <button
              type="button"
              onClick={onAddNew}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-dashed border-white/15 text-muted-foreground/50 hover:border-primary/35 hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-medium">Qo'shish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time slot picker ──────────────────────────────────────────────────────────
function TimePicker({
  standardSlots,
  afterSlots,
  showAfterHours,
  onToggleAfterHours,
  value,
  onChange,
  workEndStr,
}: {
  standardSlots: string[];
  afterSlots: string[];
  showAfterHours: boolean;
  onToggleAfterHours: () => void;
  value: string;
  onChange: (t: string) => void;
  workEndStr: string;
}) {
  const hasStandard = standardSlots.length > 0;
  const hasAfter = afterSlots.length > 0;

  return (
    <div>
      {!hasStandard && !showAfterHours && (
        <p className="text-sm text-muted-foreground py-2 text-center">
          Ish vaqtida bo'sh joy qolmadi
        </p>
      )}

      {hasStandard && (
        <div className="flex flex-wrap gap-2">
          {standardSlots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all tabular-nums ${
                value === s
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* After-hours slots */}
      {showAfterHours && (
        <div className={`flex flex-wrap gap-2 ${hasStandard ? "mt-2 pt-2 border-t border-white/5" : ""}`}>
          {hasAfter ? (
            afterSlots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all tabular-nums ${
                  value === s
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-400"
                    : "border-amber-400/20 bg-amber-400/5 text-amber-400/70 hover:bg-amber-400/10"
                }`}
              >
                {s}
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground/60 py-1">
              {workEndStr} dan keyin bo'sh joy yo'q
            </p>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggleAfterHours}
        className={`mt-3 flex items-center gap-1.5 text-xs font-semibold transition-all px-3 py-2 rounded-xl ${
          showAfterHours
            ? "text-amber-400 bg-amber-400/8 border border-amber-400/20"
            : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-white/5"
        }`}
      >
        <Plus
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            showAfterHours ? "rotate-45" : ""
          }`}
        />
        {showAfterHours
          ? "Ish vaqtidan tashqarini yashirish"
          : "+ Ish vaqtidan tashqari xizmat"}
      </button>
    </div>
  );
}

// ── Main booking form ─────────────────────────────────────────────────────────
function BookingFormContent({
  form,
  onChange,
  services,
  svcLoading,
  selectedSvc,
  standardSlots,
  afterSlots,
  showAfterHours,
  onToggleAfterHours,
  workEndStr,
  isValid,
  saving,
  saved,
  onSave,
  onClose,
  onAddService,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  services: Service[];
  svcLoading: boolean;
  selectedSvc: Service | undefined;
  standardSlots: string[];
  afterSlots: string[];
  showAfterHours: boolean;
  onToggleAfterHours: () => void;
  workEndStr: string;
  isValid: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onAddService: () => void;
}) {
  return (
    <div className="space-y-4 pt-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors -ml-1"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-display font-bold text-foreground">
          Tezkor mijoz qo'shish
        </h2>
      </div>

      {/* Saved banner */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl p-4"
          >
            <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
            <span className="font-bold text-green-400 text-lg">Saqlandi!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Ism */}
      <div>
        <FieldLabel required>Ism</FieldLabel>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Aziz"
          className="w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
        />
      </div>

      {/* 2. Telefon */}
      <div>
        <FieldLabel required>Telefon raqam</FieldLabel>
        <input
          value={form.phone}
          onChange={(e) => onChange({ phone: applyPhoneMask(e.target.value) })}
          placeholder="+998 (90) 123-45-67"
          type="tel"
          inputMode="numeric"
          className="w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
        />
      </div>

      {/* 3. Xizmat turi */}
      <div>
        <FieldLabel required>Xizmat turi</FieldLabel>
        <ServicePicker
          services={services}
          loading={svcLoading}
          value={form.serviceId}
          onChange={(id) => onChange({ serviceId: id, time: "" })}
          onAddNew={onAddService}
        />
      </div>

      {/* 4. Sana */}
      <div>
        <FieldLabel>Sana</FieldLabel>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value, time: "" })}
            className="w-full h-12 pl-9 pr-4 rounded-2xl bg-background/60 border border-white/10 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
          />
        </div>
      </div>

      {/* 5. Vaqt (only shown after service selected) */}
      {selectedSvc && (
        <div>
          <FieldLabel required>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Vaqt
              <span className="text-xs text-primary ml-1">
                ({selectedSvc.duration} daqiqa)
              </span>
            </span>
          </FieldLabel>
          <TimePicker
            standardSlots={standardSlots}
            afterSlots={afterSlots}
            showAfterHours={showAfterHours}
            onToggleAfterHours={onToggleAfterHours}
            value={form.time}
            onChange={(t) => onChange({ time: t })}
            workEndStr={workEndStr}
          />
        </div>
      )}

      {/* 6. Izoh */}
      <div>
        <FieldLabel>Izoh (ixtiyoriy)</FieldLabel>
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Qo'shimcha ma'lumotlar..."
          rows={2}
          className="w-full px-4 py-3 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm resize-none"
        />
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={!isValid || saving || saved}
        className={`w-full h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
          isValid && !saving && !saved
            ? "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25 hover:-translate-y-0.5"
            : "bg-green-500/20 text-green-500/50 cursor-not-allowed"
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saqlanmoqda...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Saqlandi!
          </>
        ) : (
          "Saqlash"
        )}
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTeam?: boolean;
}

// ── Main dialog export ────────────────────────────────────────────────────────
export function BookingFlowDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  // ── Profile (working hours) ───────────────────────────────────────────────
  const { data: profile } = useGetProfile();
  const workStartStr = profile?.workingHoursStart ?? "09:00";
  const workEndStr = profile?.workingHoursEnd ?? "20:00";
  const workStart = toMins(workStartStr);
  const workEnd = toMins(workEndStr);

  // ── Services ──────────────────────────────────────────────────────────────
  const {
    data: svcData,
    refetch: refetchServices,
    isLoading: svcLoading,
  } = useListServices();
  const services: Service[] = (svcData?.services ?? []).filter(
    (s) => s.isActive
  );
  const createSvcMut = useCreateService();

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showAddService, setShowAddService] = useState(false);
  const [svcSaving, setSvcSaving] = useState(false);
  const [showAfterHours, setShowAfterHours] = useState(false);
  const [pendingAfterHours, setPendingAfterHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Existing bookings (conflict detection) ────────────────────────────────
  const { data: bookingsData } = useListBookings({ date: form.date });
  const busy = (bookingsData?.bookings ?? []).filter(
    (b) => b.status !== "cancelled"
  );

  // ── Create booking ────────────────────────────────────────────────────────
  const createBookingMut = useCreateBooking();

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setShowAddService(false);
      setShowAfterHours(false);
      setPendingAfterHours(false);
      setSaving(false);
      setSaved(false);
    }
  }, [open]);

  const selectedSvc = services.find((s) => s.id === form.serviceId);
  const duration = selectedSvc?.duration ?? 0;

  const standardSlots =
    duration > 0 ? generateSlots(duration, busy, workStart, workEnd) : [];
  const afterSlots =
    duration > 0
      ? generateSlots(duration, busy, workEnd, 23 * 60 + 30)
      : [];

  const isAfterHoursTime =
    form.time !== "" && toMins(form.time) >= workEnd;

  const phoneDigits = form.phone.replace(/\D/g, "");
  const isValid =
    form.name.trim().length > 0 &&
    phoneDigits.length >= 12 &&
    form.serviceId !== "" &&
    form.time !== "";

  function handleSave() {
    if (!isValid || saving || saved) return;
    if (isAfterHoursTime) {
      setPendingAfterHours(true);
      return;
    }
    doSave();
  }

  function doSave() {
    setPendingAfterHours(false);
    setSaving(true);
    const endMins = toMins(form.time) + (selectedSvc?.duration ?? 30);

    // Encode phone in notes so BookingDetailModal can display it
    const phoneDigitsLocal = form.phone.replace(/\D/g, "").slice(3); // remove 998
    const hasValidPhone = phoneDigitsLocal.length >= 9;
    const encodedNotes = [
      hasValidPhone ? `Tel: ${form.phone}` : null,
      form.notes.trim() || null,
    ]
      .filter(Boolean)
      .join("\n") || null;

    createBookingMut.mutate(
      {
        data: {
          clientName: form.name.trim(),
          serviceId: form.serviceId || null,
          date: form.date,
          startTime: form.time,
          endTime: fmtMins(endMins),
          price: selectedSvc?.price ?? 0,
          notes: encodedNotes,
        },
      },
      {
        onSuccess: () => {
          setSaving(false);
          setSaved(true);
          // Invalidate so Calendar + Dashboard auto-refresh
          queryClient.invalidateQueries({
            queryKey: getListBookingsQueryKey({ date: form.date }),
          });
          queryClient.invalidateQueries({
            queryKey: getListBookingsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardStatsQueryKey(),
          });
          setTimeout(() => close(), 1200);
        },
        onError: () => setSaving(false),
      }
    );
  }

  async function handleAddService(data: ServiceFormData) {
    setSvcSaving(true);
    createSvcMut.mutate(
      {
        data: {
          name: data.name,
          nameRu: data.categoryId || undefined,
          duration: data.duration,
          price: data.price,
        } as Parameters<typeof createSvcMut.mutate>[0]["data"],
      },
      {
        onSuccess: async (newSvc) => {
          await refetchServices();
          queryClient.invalidateQueries({
            queryKey: getListServicesQueryKey(),
          });
          setForm((f) => ({ ...f, serviceId: newSvc.id, time: "" }));
          setShowAddService(false);
          setSvcSaving(false);
        },
        onError: () => setSvcSaving(false),
      }
    );
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <Sheet onClose={close}>
            <AnimatePresence mode="wait">
              {showAddService ? (
                <motion.div
                  key="svc-form"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="pt-3">
                    <ServiceForm
                      onSave={handleAddService}
                      onCancel={() => setShowAddService(false)}
                      saving={svcSaving}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="booking-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <BookingFormContent
                    form={form}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    services={services}
                    svcLoading={svcLoading}
                    selectedSvc={selectedSvc}
                    standardSlots={standardSlots}
                    afterSlots={afterSlots}
                    showAfterHours={showAfterHours}
                    onToggleAfterHours={() => setShowAfterHours((v) => !v)}
                    workEndStr={workEndStr}
                    isValid={isValid}
                    saving={saving}
                    saved={saved}
                    onSave={handleSave}
                    onClose={close}
                    onAddService={() => setShowAddService(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Sheet>
        )}
      </AnimatePresence>

      {/* After-hours confirmation overlay */}
      <AnimatePresence>
        {pendingAfterHours && open && (
          <AfterHoursWarning
            onConfirm={doSave}
            onCancel={() => setPendingAfterHours(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
