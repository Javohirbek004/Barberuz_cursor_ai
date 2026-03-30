/**
 * BookingFlowDialog
 * Central (+) button booking flow for both Individual and Team modes.
 *
 * Individual: single-step form modal
 * Team: step 1 → barber selection, step 2 → booking form
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  X,
  CheckCircle2,
  Loader2,
  Calendar,
  Clock,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  label: string;
  duration: number;
}

export const SERVICES: Service[] = [
  { id: "fade",    label: "Fade",          duration: 45 },
  { id: "soch",    label: "Soch oldirish", duration: 30 },
  { id: "soqol",   label: "Soqol",         duration: 20 },
  { id: "kompleks",label: "Kompleks",      duration: 60 },
];

interface Barber {
  id: string;
  name: string;
  bookings: number;
  totalSlots: number;
  busy: { start: string; duration: number }[];
}

const BARBERS: Barber[] = [
  {
    id: "sardor", name: "Sardor", bookings: 5, totalSlots: 3,
    busy: [
      { start: "09:00", duration: 45 }, { start: "10:00", duration: 30 },
      { start: "11:00", duration: 30 }, { start: "12:00", duration: 45 },
      { start: "14:00", duration: 45 },
    ],
  },
  {
    id: "jasur", name: "Jasur", bookings: 3, totalSlots: 5,
    busy: [
      { start: "10:30", duration: 45 }, { start: "13:00", duration: 60 },
      { start: "16:00", duration: 20 },
    ],
  },
  {
    id: "ali", name: "Ali", bookings: 0, totalSlots: 8,
    busy: [],
  },
  {
    id: "kamol", name: "Kamol", bookings: 2, totalSlots: 6,
    busy: [
      { start: "11:30", duration: 30 }, { start: "15:30", duration: 45 },
    ],
  },
];

const INDIVIDUAL_BUSY = [
  { start: "14:00", duration: 45 },
  { start: "15:00", duration: 30 },
  { start: "17:00", duration: 20 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtMins(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function generateSlots(
  duration: number,
  busy: { start: string; duration: number }[]
): string[] {
  const START = 9 * 60;
  const END = 20 * 60;
  const slots: string[] = [];
  for (let t = START; t + duration <= END; t += 30) {
    const end = t + duration;
    const free = !busy.some((b) => {
      const bs = toMins(b.start);
      const be = bs + b.duration;
      return t < be && end > bs;
    });
    if (free) slots.push(fmtMins(t));
  }
  return slots;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function barberStatus(b: Barber): "green" | "yellow" | "red" {
  if (b.bookings === 0) return "green";
  if (b.bookings <= 2) return "yellow";
  return "red";
}

const STATUS_DOT: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  green: "Bo'sh",
  yellow: "Band bo'lmoqda",
  red: "Band",
};

const STATUS_TEXT: Record<string, string> = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
};

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

// ── Sheet wrapper ─────────────────────────────────────────────────────────────
function Sheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
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
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        <div className="overflow-y-auto flex-1 px-5 pb-10">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ── Field components ──────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
    />
  );
}

// ── Service picker ────────────────────────────────────────────────────────────
function ServicePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SERVICES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`flex flex-col items-start p-3 rounded-2xl border transition-all text-left ${
            value === s.id
              ? "border-primary/60 bg-primary/10 text-foreground"
              : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"
          }`}
        >
          <span className="text-sm font-semibold">{s.label}</span>
          <span className="text-xs mt-0.5 opacity-70">{s.duration} daqiqa</span>
        </button>
      ))}
    </div>
  );
}

// ── Time slot picker ──────────────────────────────────────────────────────────
function TimePicker({
  slots,
  value,
  onChange,
}: {
  slots: string[];
  value: string;
  onChange: (t: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2 text-center">
        Bu kun bo'sh vaqt qolmadi
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
            value === s
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Booking form (shared by individual & team step 2) ─────────────────────────
function BookingForm({
  form,
  onChange,
  busySlots,
  onBack,
  onSave,
  saving,
  saved,
  barberName,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  busySlots: { start: string; duration: number }[];
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  barberName?: string;
}) {
  const service = SERVICES.find((s) => s.id === form.serviceId);
  const slots = service ? generateSlots(service.duration, busySlots) : [];

  const isValid =
    form.name.trim().length > 0 &&
    form.phone.trim().length > 4 &&
    form.serviceId !== "" &&
    form.time !== "";

  return (
    <div className="space-y-4 pt-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors -ml-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Tezkor mijoz qo'shish
          </h2>
          {barberName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Barber: <span className="text-primary font-semibold">{barberName}</span>
            </p>
          )}
        </div>
      </div>

      {/* Saved state */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
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
        <TextInput
          value={form.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="Aziz"
        />
      </div>

      {/* 2. Telefon */}
      <div>
        <FieldLabel required>Telefon raqam</FieldLabel>
        <TextInput
          value={form.phone}
          onChange={(v) => onChange({ phone: v })}
          placeholder="+998 90 123 45 67"
          type="tel"
        />
      </div>

      {/* 3. Xizmat turi */}
      <div>
        <FieldLabel required>Xizmat turi</FieldLabel>
        <ServicePicker
          value={form.serviceId}
          onChange={(id) => onChange({ serviceId: id, time: "" })}
        />
      </div>

      {/* 4. Sana */}
      <div>
        <FieldLabel>Sana</FieldLabel>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value, time: "" })}
            className="w-full h-12 pl-9 pr-4 rounded-2xl bg-background/60 border border-white/10 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
          />
        </div>
      </div>

      {/* 5. Vaqt (dynamic — only shown after service selected) */}
      {form.serviceId && (
        <div>
          <FieldLabel required>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Vaqt
              {service && (
                <span className="text-xs text-primary ml-1">
                  ({service.duration} daqiqa)
                </span>
              )}
            </span>
          </FieldLabel>
          <TimePicker
            slots={slots}
            value={form.time}
            onChange={(t) => onChange({ time: t })}
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
          rows={3}
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
            ? "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:-translate-y-0.5"
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

// ── Team barber selector (step 1) ─────────────────────────────────────────────
function BarberSelector({
  onSelect,
  onClose,
}: {
  onSelect: (b: Barber) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors -ml-1"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-display font-bold text-foreground">
          Qaysi ustaga mijoz qo'shasiz?
        </h2>
      </div>

      <div className="space-y-2">
        {BARBERS.map((barber) => {
          const st = barberStatus(barber);
          return (
            <motion.button
              key={barber.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(barber)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-background/40 border border-white/8 hover:bg-white/5 hover:border-primary/20 transition-all text-left"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="font-display font-bold text-primary text-lg">
                  {barber.name[0]}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">{barber.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {barber.bookings} ta bron • {barber.totalSlots} bo'sh joy
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[st]}`} />
                <span className={`text-xs font-semibold ${STATUS_TEXT[st]}`}>
                  {STATUS_LABEL[st]}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTeam?: boolean;
  onBookingAdded?: (booking: {
    time: string;
    client: string;
    phone: string;
    service: string;
    barber?: string;
  }) => void;
}

type Step = "team_select" | "form";

export function BookingFlowDialog({
  open,
  onOpenChange,
  isTeam = false,
  onBookingAdded,
}: Props) {
  const [step, setStep] = useState<Step>(isTeam ? "team_select" : "form");
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(isTeam ? "team_select" : "form");
      setSelectedBarber(null);
      setForm(EMPTY_FORM);
      setSaving(false);
      setSaved(false);
    }
  }, [open, isTeam]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const busySlots = selectedBarber
    ? selectedBarber.busy
    : INDIVIDUAL_BUSY;

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      const service = SERVICES.find((s) => s.id === form.serviceId);
      onBookingAdded?.({
        time: form.time,
        client: form.name,
        phone: form.phone,
        service: service?.label ?? form.serviceId,
        barber: selectedBarber?.name,
      });
      setTimeout(() => {
        close();
      }, 1000);
    }, 1200);
  }

  function handleBarberSelect(barber: Barber) {
    setSelectedBarber(barber);
    setStep("form");
  }

  function handleBack() {
    if (isTeam && step === "form") {
      setStep("team_select");
      setSelectedBarber(null);
      setForm((f) => ({ ...f, time: "" }));
    } else {
      close();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <Sheet onClose={close}>
          <AnimatePresence mode="wait">
            {step === "team_select" ? (
              <motion.div
                key="team_select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                <BarberSelector onSelect={handleBarberSelect} onClose={close} />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
              >
                <BookingForm
                  form={form}
                  onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  busySlots={busySlots}
                  onBack={handleBack}
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                  barberName={selectedBarber?.name}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Sheet>
      )}
    </AnimatePresence>
  );
}
