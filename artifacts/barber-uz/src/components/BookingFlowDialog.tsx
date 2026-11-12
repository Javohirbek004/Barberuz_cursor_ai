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
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  X,
  CheckCircle2,
  Loader2,
  Clock,
  Plus,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n/LanguageContext";
import { moneyLabel, monthNames, pick } from "@/i18n/pick";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListServices,
  useCreateService,
  useCreateBooking,
  useListBookings,
  useListClients,
  useGetProfile,
  getGetDashboardStatsQueryKey,
  getListServicesQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { Service } from "@workspace/api-client-react";
import { ServiceForm } from "@/components/ServiceForm";
import type { ServiceFormData } from "@/components/ServiceForm";
import { SlotPeriodTabs } from "@/components/SlotPeriodTabs";
import { ShopTimeHint } from "@/components/ShopTimeHint";
import {
  TODAY_PASSED_MESSAGE,
  todaySlotsExhausted,
  addDaysISO,
  bookingsToIntervals,
  filterSlotsByPeriod,
  generateSmartSlots,
  lunchInterval,
  normalizeBuffer,
  resolveDaySchedule,
  tashkentNowMinutes,
  type ScheduleSource,
  type SlotPeriod,
} from "@/lib/schedule";

type ProfileSchedule = ScheduleSource & {
  lunchBreakEnabled?: boolean | null;
  lunchBreakStart?: string | null;
  lunchBreakEnd?: string | null;
  bufferTime?: number | null;
};
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
  if (d.length <= 5) return result;
  result += "-" + d.slice(5, Math.min(7, d.length));
  if (d.length <= 7) return result;
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
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

const UZ_MONTHS_DIALOG = ["Yanv","Fevr","Mart","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
function fmtDateUzShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}-${UZ_MONTHS_DIALOG[d.getMonth()]}`;
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
type FieldErrors = Partial<Record<"name" | "phone" | "service" | "date" | "time", string>>;

const FIELD_ERROR_TEXT: Record<"name" | "phone" | "service" | "date" | "time", string> = {
  name: "Ismni kiriting",
  phone: "To'liq telefon raqamini kiriting",
  service: "Xizmat turini tanlang",
  date: "Sanani tanlang",
  time: "Vaqtni tanlang",
};

const FIELD_ORDER: (keyof typeof FIELD_ERROR_TEXT)[] = [
  "name",
  "phone",
  "service",
  "date",
  "time",
];

function localPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return (digits.startsWith("998") ? digits.slice(3) : digits).slice(0, 9);
}

function completeLocalPhone(phone: string): string | null {
  const local = localPhoneDigits(phone);
  return local.length === 9 ? local : null;
}

type PhoneLookupView = "idle" | "searching" | "found" | "new";

function phoneLookupView(input: {
  lookupReady: boolean;
  busy: boolean;
  foundName: string;
  currentName: string;
  nameJustFilled: boolean;
}): PhoneLookupView {
  if (!input.lookupReady) return "idle";
  if (input.busy) return "searching";
  if (input.nameJustFilled) return "idle";
  if (input.foundName && input.currentName.trim() !== input.foundName) return "found";
  if (!input.foundName) return "new";
  return "idle";
}

function phoneEndsWithLocal(phone: string | null | undefined, local: string): boolean {
  return (phone ?? "").replace(/\D/g, "").endsWith(local);
}

function collectFieldErrors(form: FormState, lang = "uz"): FieldErrors {
  const errors: FieldErrors = {};
  const text = {
    name: pick(lang, FIELD_ERROR_TEXT.name, "Введите имя"),
    phone: pick(lang, FIELD_ERROR_TEXT.phone, "Введите полный номер телефона"),
    service: pick(lang, FIELD_ERROR_TEXT.service, "Выберите услугу"),
    date: pick(lang, FIELD_ERROR_TEXT.date, "Выберите дату"),
    time: pick(lang, FIELD_ERROR_TEXT.time, "Выберите время"),
  };
  if (!form.name.trim()) errors.name = text.name;
  const digits = form.phone.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length > 0 && local.length < 9) errors.phone = text.phone;
  if (!form.serviceId) errors.service = text.service;
  if (!form.date) errors.date = text.date;
  if (!form.time) errors.time = text.time;
  return errors;
}

function firstErrorField(errors: FieldErrors): keyof typeof FIELD_ERROR_TEXT | undefined {
  return FIELD_ORDER.find((key) => Boolean(errors[key]));
}

function scrollToDataField(attr: string, field: string) {
  document
    .querySelector(`[${attr}="${field}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const INPUT_BASE =
  "w-full h-12 px-4 rounded-2xl bg-background/60 border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-all text-sm";
const INPUT_OK = "border-white/10 focus:border-primary/50 focus:ring-primary/30";
const INPUT_ERR = "border-red-500/70 focus:border-red-500 focus:ring-red-500/30";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-400 mt-1.5">{message}</p>;
}

function Sheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Hide bottom nav while sheet is open so taps cannot fall through to Settings.
  useEffect(() => {
    const nav = document.getElementById("bottom-nav-root");
    if (nav) {
      nav.style.visibility = "hidden";
      nav.style.pointerEvents = "none";
    }
    return () => {
      window.setTimeout(() => {
        if (!nav) return;
        nav.style.visibility = "";
        nav.style.pointerEvents = "";
      }, 450);
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
      className="fixed inset-0 z-[80] flex items-end justify-center"
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
  const { lang } = useTranslation();
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
            {pick(lang, "Ish vaqtidan tashqari", "Вне рабочего времени")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {pick(lang, "Siz ish vaqtidan tashqari vaqtga bron qo'shmoqdasiz. Baribir davom ettirasizmi?", "Вы добавляете запись вне рабочего времени. Всё равно продолжить?")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
          >
            {pick(lang, "Bekor qilish", "Отмена")}
          </button>
          <button
            onClick={onConfirm}
            className="py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-all"
          >
            {pick(lang, "Ha, davom etish", "Да, продолжить")}
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
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  const { lang } = useTranslation();
  return (
    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
      {children}
      {required && (
        <span className="text-xs font-normal text-primary ml-1">{pick(lang, "(majburiy)", "(обязательно)")}</span>
      )}
      {optional && (
        <span className="text-xs font-normal text-muted-foreground/55 ml-1">{pick(lang, "(ixtiyoriy)", "(необязательно)")}</span>
      )}
    </label>
  );
}

// ── Amount formatter ──────────────────────────────────────────────────────────
function fmtAmountDisplay(raw: string): string {
  if (!raw) return "";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return "";
  // toLocaleString with "ru-RU" gives space-separated thousands: 50 000
  return n.toLocaleString("ru-RU");
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
  const { lang } = useTranslation();
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
        <p className="text-sm text-muted-foreground">{pick(lang, "Hali xizmatlar qo'shilmagan", "Услуги ещё не добавлены")}</p>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          {pick(lang, "Yangi xizmat qo'shish", "Добавить услугу")}
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
          {pick(lang, "Hammasi", "Все")}
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
              placeholder={pick(lang, "Yangi kategoriya", "Новая категория")}
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
          {pick(lang, "Bu kategoriyada xizmat yo'q", "В этой категории нет услуг")}
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
                  {s.duration} {pick(lang, "daqiqa", "мин")} • {moneyLabel(lang, s.price)}
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
              <span className="text-xs font-medium">{pick(lang, "Qo'shish", "Добавить")}</span>
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
  todayPassed,
  value,
  onChange,
  workEndStr,
}: {
  standardSlots: string[];
  afterSlots: string[];
  showAfterHours: boolean;
  onToggleAfterHours: () => void;
  todayPassed: boolean;
  value: string;
  onChange: (t: string) => void;
  workEndStr: string;
}) {
  const { lang } = useTranslation();
  const [period, setPeriod] = useState<SlotPeriod>("all");
  const allStandard = standardSlots;
  const allAfter = afterSlots;
  const filteredStandard = filterSlotsByPeriod(allStandard, period);
  const filteredAfter = filterSlotsByPeriod(allAfter, period);
  const hasStandard = filteredStandard.length > 0;
  const hasAfter = filteredAfter.length > 0;
  const hasAnySlots = allStandard.length > 0 || (showAfterHours && allAfter.length > 0);

  return (
    <div>
      <ShopTimeHint />
      {hasAnySlots && <SlotPeriodTabs value={period} onChange={setPeriod} lang={lang} />}

      {todayPassed && !hasStandard && (
        <p
          data-testid="today-passed-notice"
          className="text-sm text-muted-foreground py-2 text-center"
        >
          {pick(lang, TODAY_PASSED_MESSAGE, "На сегодня рабочее время закончилось. Выберите завтра.")}
        </p>
      )}

      {!todayPassed && !hasStandard && !showAfterHours && (
        <p className="text-sm text-muted-foreground py-2 text-center">
          {allStandard.length > 0 ? pick(lang, "Bu vaqt oralig'ida bo'sh joy yo'q", "В этом промежутке нет свободного времени") : pick(lang, "Ish vaqtida bo'sh joy qolmadi", "В рабочее время мест не осталось")}
        </p>
      )}

      {hasStandard && (
        <div className="flex flex-wrap gap-2" data-testid="admin-slot-grid">
          {filteredStandard.map((s) => (
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
            filteredAfter.map((s) => (
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
              {allAfter.length > 0
                ? pick(lang, "Bu vaqt oralig'ida bo'sh joy yo'q", "В этом промежутке нет свободного времени")
                : pick(lang, `${workEndStr} dan keyin bo'sh joy yo'q`, `После ${workEndStr} свободного времени нет`)}
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
          ? pick(lang, "Ish vaqtidan tashqarini yashirish", "Скрыть время вне работы")
          : pick(lang, "Ish vaqtidan tashqari xizmat", "Услуга вне рабочего времени")}
      </button>
    </div>
  );
}

function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null);
  for (let day = 1; day <= count; day++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

const MASTER_WEEKDAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const MASTER_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

// ── Date Picker (tabs + calendar) ─────────────────────────────────────────────
function DatePicker({ form, onPick, hasError, isClosed }: {
  form: FormState;
  onPick: (date: string) => void;
  hasError?: boolean;
  isClosed: (iso: string) => boolean;
}) {
  const { lang } = useTranslation();
  const todayVal = todayStr();
  const tomorrowVal = tomorrowStr();
  const isCustom = Boolean(form.date) && form.date !== todayVal && form.date !== tomorrowVal;
  const [open, setOpen] = useState(false);
  const latest = addDaysISO(todayVal, 365);
  const [view, setView] = useState(() => {
    const [year = 1970, month = 1] = todayVal.split("-").map(Number);
    return { year, month };
  });
  const min = todayVal.split("-").map(Number);
  const max = latest.split("-").map(Number);
  const atStart = view.year < min[0] || (view.year === min[0] && view.month <= min[1]);
  const atEnd = view.year > max[0] || (view.year === max[0] && view.month >= max[1]);

  useEffect(() => {
    if (form.date) setOpen(false);
  }, [form.date]);

  function shift(delta: number) {
    const next = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        {[todayVal, tomorrowVal].map((d, i) => {
          const closed = isClosed(d);
          const selected = form.date === d;
          return (
            <button key={d} type="button"
              data-testid={i === 0 ? "master-day-today" : "master-day-tomorrow"}
              data-closed={closed ? "1" : "0"}
              onClick={() => onPick(d)}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold border transition-all ${
                selected
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : closed
                    ? "bg-white/4 border-white/8 text-muted-foreground/40"
                    : hasError
                      ? "bg-background/60 border-red-500/70 text-muted-foreground hover:bg-white/5"
                      : "bg-background/60 border-white/10 text-muted-foreground hover:bg-white/5"
              }`}>
              {i === 0 ? pick(lang, "Bugun", "Сегодня") : pick(lang, "Ertaga", "Завтра")}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center">
        <button type="button" data-testid="master-other-date" onClick={() => setOpen((value) => !value)}
          className="text-sm flex items-center gap-1.5 py-1 transition-colors"
          style={{ color: isCustom ? "#FACC15" : "rgba(250,204,21,0.65)" }}>
          📅 {isCustom ? pick(lang, `${fmtDateUzShort(form.date)} tanlandi`, `${fmtDateUzShort(form.date)} выбрано`) : pick(lang, "Boshqa sana ➔", "Другая дата ➔")}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid="master-date-grid">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" disabled={atStart} onClick={() => shift(-1)} aria-label={pick(lang, "Oldingi oy", "Предыдущий месяц")} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">{monthNames(lang)[view.month - 1]} {view.year}</p>
            <button type="button" disabled={atEnd} onClick={() => shift(1)} aria-label={pick(lang, "Keyingi oy", "Следующий месяц")} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-muted-foreground/60">
            {(lang === "ru" ? ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] : MASTER_WEEKDAYS).map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells(view.year, view.month).map((iso, index) => {
              if (!iso) return <span key={`empty-${index}`} />;
              const past = iso < todayVal || iso > latest;
              const closed = !past && isClosed(iso);
              const selected = form.date === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={past}
                  data-testid={`master-date-${iso}`}
                  data-closed={closed ? "1" : "0"}
                  onClick={() => { if (!past) onPick(iso); }}
                  className={`h-9 rounded-xl text-sm font-semibold ${
                    past || (closed && !selected)
                      ? "bg-white/[0.03] text-muted-foreground/30"
                      : selected
                        ? "bg-primary/20 text-primary"
                        : "text-foreground hover:bg-white/8"
                  }`}
                >
                  {Number(iso.slice(-2))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OffDayWarning({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { lang } = useTranslation();
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="off-day-warning"
    >
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        className="relative w-full max-w-sm bg-[#18181d] rounded-3xl border border-white/8 p-6 z-10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="font-bold text-foreground text-base leading-snug">{pick(lang, "Diqqat!", "Внимание!")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {pick(lang, "Bu kun dam olish kuni deb belgilangan. Baribir bron qo'shmoqchimisiz?", "Этот день отмечен как выходной. Всё равно добавить запись?")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" data-testid="off-day-cancel" onClick={onCancel}
            className="py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold text-foreground">
            {pick(lang, "Bekor qilish", "Отмена")}
          </button>
          <button type="button" data-testid="off-day-confirm" onClick={onConfirm}
            className="py-3 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold">
            {pick(lang, "Baribir qo'shish", "Всё равно добавить")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Expense Form ──────────────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATS = ["✂️ Ish qurollari", "🏢 Ijara va Kommunal", "🍔 Shaxsiy", "📦 Boshqa"];

const EXPENSE_CAT_PLACEHOLDERS: Record<string, string> = {
  "✂️ Ish qurollari":      "Masalan: Mashinka, taroq...",
  "🏢 Ijara va Kommunal":  "Masalan: Salon ijarasi, svet, suv...",
  "🍔 Shaxsiy":            "Masalan: Tushlik, kofe...",
  "📦 Boshqa":             "Masalan: Kutilmagan xarajat...",
};
function getExpensePlaceholder(cat: string, lang = "uz"): string {
  const ru: Record<string, string> = {
    "✂️ Ish qurollari": "Например: машинка, расчёска...",
    "🏢 Ijara va Kommunal": "Например: аренда, свет, вода...",
    "🍔 Shaxsiy": "Например: обед, кофе...",
    "📦 Boshqa": "Например: непредвиденный расход...",
  };
  if (lang === "ru") return ru[cat] ?? "Введите название расхода...";
  return EXPENSE_CAT_PLACEHOLDERS[cat] ?? "Xarajat nomini kiriting...";
}

function expenseCatLabel(lang: string, cat: string): string {
  if (lang !== "ru") return cat;
  if (cat.includes("Ish qurollari")) return "✂️ Инструменты";
  if (cat.includes("Ijara")) return "🏢 Аренда и коммуналка";
  if (cat.includes("Shaxsiy")) return "🍔 Личное";
  if (cat.includes("Boshqa")) return "📦 Другое";
  return cat;
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

// onClose kept in signature for future use; X button lives in the shared tab row
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExpenseForm({ onSaved }: { onClose?: () => void; onSaved: () => void }) {
  const { lang } = useTranslation();
  const [title, setTitle]           = useState("");
  const [amountRaw, setAmountRaw]   = useState(""); // raw digits only
  const [category, setCategory]     = useState("✂️ Ish qurollari");
  const [notes, setNotes]           = useState("");
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; amount?: string }>({});
  const [scrollKey, setScrollKey]   = useState(0);
  const calRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/expenses/categories", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => {
        const custom = (data.categories ?? []).filter((c: string) => !DEFAULT_EXPENSE_CATS.includes(c));
        setCustomCats(custom);
      })
      .catch(() => {});
  }, []);

  const allCats = [...DEFAULT_EXPENSE_CATS, ...customCats];

  const amountNum = amountRaw ? parseInt(amountRaw, 10) : 0;
  const amountDisplay = fmtAmountDisplay(amountRaw);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setAmountRaw(digits);
  }

  function getExpenseDate() {
    if (useCustomDate && customDate) return customDate;
    return todayStr();
  }

  async function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) return;
    try {
      await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name }),
      });
      setCustomCats(prev => [...prev, name]);
      setCategory(name);
      setNewCatName(""); setShowNewCat(false);
    } catch {}
  }

  useEffect(() => {
    if (!scrollKey) return;
    const first = fieldErrors.title ? "title" : fieldErrors.amount ? "amount" : null;
    if (!first) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToDataField("data-expense-field", first);
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  async function handleSave() {
    if (saving || saved) return;
    const errors: { title?: string; amount?: string } = {};
    if (!title.trim()) errors.title = pick(lang, "Nomini kiriting", "Введите название");
    if (amountNum <= 0) errors.amount = pick(lang, "Miqdorni kiriting", "Введите сумму");
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setScrollKey((n) => n + 1);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ title: title.trim(), amount: amountNum, category, date: getExpenseDate() }),
      });
      if (!res.ok) throw new Error("save_error");
      setSaved(true);
      toast({ title: pick(lang, "Xarajat saqlandi ✓", "Расход сохранён ✓"), description: `${title.trim()} — ${moneyLabel(lang, amountNum)}` });
      setTimeout(() => onSaved(), 700);
    } catch {
      setSaving(false);
      toast({ title: pick(lang, "Xatolik", "Ошибка"), description: pick(lang, "Xarajat saqlanmadi", "Расход не сохранился"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Saved banner */}
      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-400 text-lg">{pick(lang, "Saqlandi!", "Сохранено!")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div data-expense-field="title">
        <FieldLabel required>{pick(lang, "Nomi", "Название")}</FieldLabel>
        <input
          value={title}
          onChange={e => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder={getExpensePlaceholder(category, lang)}
          className={`${INPUT_BASE} ${fieldErrors.title ? INPUT_ERR : INPUT_OK}`}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      {/* Amount — formatted display with thousands separator */}
      <div data-expense-field="amount">
        <FieldLabel required>{pick(lang, "Miqdor (so'm)", "Сумма (сум)")}</FieldLabel>
        <input
          inputMode="numeric"
          value={amountDisplay}
          onChange={(e) => {
            handleAmountChange(e);
            const digits = e.target.value.replace(/\D/g, "");
            if (digits && parseInt(digits, 10) > 0) {
              setFieldErrors((prev) => ({ ...prev, amount: undefined }));
            }
          }}
          placeholder="50 000"
          className={`${INPUT_BASE} ${fieldErrors.amount ? INPUT_ERR : INPUT_OK} tabular-nums`}
        />
        <FieldError message={fieldErrors.amount} />
      </div>

      {/* Category chips — 2-row flex wrap, max 2 columns feel */}
      <div>
        <FieldLabel>{pick(lang, "Kategoriya", "Категория")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {allCats.map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                category === c
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-white/4 border-white/8 text-muted-foreground hover:bg-white/8 hover:text-foreground"
              }`}>
              {expenseCatLabel(lang, c)}
            </button>
          ))}
          {showNewCat ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCategory()} placeholder={pick(lang, "Yangi", "Новая")}
                className="h-8 w-24 px-2 rounded-xl text-xs bg-white/5 border border-white/15 focus:outline-none focus:border-primary/40" />
              <button type="button" onClick={handleAddCategory}
                className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
                <Check className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowNewCat(true)}
              className="h-8 px-2.5 rounded-xl text-xs border border-dashed border-white/15 text-muted-foreground/60 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-1">
              <Plus className="w-3 h-3" /> {pick(lang, "Yangi", "Новая")}
            </button>
          )}
        </div>
      </div>

      {/* Date — Bugun + Boshqa sana calendar trigger only */}
      <div>
        <FieldLabel>{pick(lang, "Sana", "Дата")}</FieldLabel>
        <div className="flex gap-2 items-center">
          <button type="button"
            onClick={() => { setUseCustomDate(false); setCustomDate(""); }}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
              !useCustomDate
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-background/60 border-white/10 text-muted-foreground hover:bg-white/5"
            }`}>
            {pick(lang, "Bugun", "Сегодня")}
          </button>
          <button type="button"
            onClick={() => calRef.current?.showPicker()}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
              useCustomDate
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "bg-background/60 border-white/10 text-muted-foreground hover:bg-white/5"
            }`}>
            {useCustomDate && customDate ? `📅 ${fmtDateUzShort(customDate)}` : pick(lang, "📅 Boshqa sana", "📅 Другая дата")}
          </button>
          <input ref={calRef} type="date" aria-hidden="true" className="sr-only"
            value={customDate}
            onChange={e => {
              if (e.target.value) { setCustomDate(e.target.value); setUseCustomDate(true); }
            }} />
        </div>
      </div>

      <div>
        <FieldLabel optional>{pick(lang, "Izoh", "Комментарий")}</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={pick(lang, "Qo'shimcha ma'lumotlar...", "Дополнительно...")}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm resize-none"
        />
      </div>

      <p className="text-xs text-muted-foreground/80 text-center leading-relaxed px-1">
        {pick(lang, "⚠️ Iltimos, barcha majburiy maydonlarni to'ldiring.", "⚠️ Заполните все обязательные поля.")}
      </p>
      <button
        type="button"
        onClick={handleSave}
        className={`w-full h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
          saving || saved
            ? "bg-amber-500/80 text-black"
            : "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 hover:-translate-y-0.5"
        }`}
      >
        {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> {pick(lang, "Saqlanmoqda...", "Сохраняется...")}</>
          : saved ? <><CheckCircle2 className="w-5 h-5" /> {pick(lang, "Saqlandi!", "Сохранено!")}</>
          : pick(lang, "Xarajatni saqlash", "Сохранить расход")}
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
  todayPassed,
  workEndStr,
  fieldErrors,
  scrollKey,
  saving,
  saved,
  onSave,
  onClose,
  onAddService,
  isClosed,
  onPickDate,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  isClosed: (iso: string) => boolean;
  onPickDate: (date: string) => void;
  services: Service[];
  svcLoading: boolean;
  selectedSvc: Service | undefined;
  standardSlots: string[];
  afterSlots: string[];
  showAfterHours: boolean;
  onToggleAfterHours: () => void;
  todayPassed: boolean;
  workEndStr: string;
  fieldErrors: FieldErrors;
  scrollKey: number;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onAddService: () => void;
  isClosed: (iso: string) => boolean;
  onPickDate: (date: string) => void;
}) {
  const { lang } = useTranslation();
  const readyForSlots = Boolean(form.serviceId && form.date);
  const lookupKey = completeLocalPhone(form.phone);
  const [nameFilledNote, setNameFilledNote] = useState(false);
  const { data: knownClients, isFetching, isLoading } = useListClients(
    { search: lookupKey ?? "", limit: 20 },
    { query: { enabled: lookupKey !== null } },
  );
  const foundClient = (knownClients?.clients ?? []).find(
    (client: { name?: string | null; phone?: string | null }) =>
      lookupKey !== null && phoneEndsWithLocal(client.phone, lookupKey) && Boolean(client.name?.trim()),
  );
  const foundName = foundClient?.name?.trim() ?? "";
  const lookupView = phoneLookupView({
    lookupReady: lookupKey !== null,
    busy: lookupKey !== null && (isFetching || isLoading),
    foundName,
    currentName: form.name,
    nameJustFilled: nameFilledNote,
  });
  const showFound = lookupView === "found";

  useEffect(() => {
    if (!nameFilledNote) return;
    const timer = window.setTimeout(() => setNameFilledNote(false), 1000);
    return () => window.clearTimeout(timer);
  }, [nameFilledNote]);

  function fillFoundName() {
    if (!foundName) return;
    onChange({ name: foundName });
    setNameFilledNote(true);
  }

  useEffect(() => {
    if (!scrollKey) return;
    const first = firstErrorField(fieldErrors);
    if (!first) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToDataField("data-booking-field", first);
    });
    return () => window.cancelAnimationFrame(frame);
    // Only on a failed save, not when individual errors clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  return (
    <div className="space-y-4 pt-2">
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
            <span className="font-bold text-green-400 text-lg">{pick(lang, "Saqlandi!", "Сохранено!")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Ism */}
      <div data-booking-field="name">
        <FieldLabel required>{pick(lang, "Ism", "Имя")}</FieldLabel>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={pick(lang, "Aziz", "Азиз")}
          className={`${INPUT_BASE} ${
            fieldErrors.name
              ? INPUT_ERR
              : showFound
                ? "border-primary focus:border-primary focus:ring-primary/40 shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
                : INPUT_OK
          }`}
        />
        <FieldError message={fieldErrors.name} />
        {showFound && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-foreground/90 leading-snug">
              {pick(lang, `💡 Bu raqam bilan “${foundName}” ismli mijoz topildi`, `💡 По этому номеру найден клиент «${foundName}»`)}
            </p>
            <button
              type="button"
              onClick={fillFoundName}
              className="shrink-0 h-8 px-3 rounded-xl text-xs font-semibold border border-primary/40 bg-primary/15 text-primary"
            >
              {pick(lang, "🔄 Ismni toʻldirish", "🔄 Подставить имя")}
            </button>
          </div>
        )}
        {nameFilledNote && (
          <p className="text-xs text-green-400 mt-2">{pick(lang, "✅ Mijoz ismi avtomatik kiritildi", "✅ Имя клиента подставлено")}</p>
        )}
        {lookupView === "new" && (
          <p className="mt-2 inline-flex text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
            {pick(lang, "✨ Bu yangi mijoz. Bron qilingach bazaga qoʻshiladi.", "✨ Это новый клиент. После записи он добавится в базу.")}
          </p>
        )}
      </div>

      {/* 2. Telefon */}
      <div data-booking-field="phone">
        <FieldLabel optional>{pick(lang, "Telefon raqam", "Номер телефона")}</FieldLabel>
        <input
          value={form.phone}
          onChange={(e) => onChange({ phone: applyPhoneMask(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key !== "Backspace") return;
            const current = form.phone;
            if (!/[)\s-]$/.test(current)) return;
            e.preventDefault();
            const digits = current.replace(/\D/g, "");
            const local = (digits.startsWith("998") ? digits.slice(3) : digits).slice(0, -1);
            onChange({ phone: applyPhoneMask(local) });
          }}
          placeholder="+998 (__) ___-__-__"
          type="tel"
          inputMode="numeric"
          className={`${INPUT_BASE} ${fieldErrors.phone ? INPUT_ERR : INPUT_OK}`}
        />
        <FieldError message={fieldErrors.phone} />
        {lookupView === "searching" && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {pick(lang, "Mijoz bazadan qidirilmoqda...", "Ищем клиента в базе...")}
          </p>
        )}
      </div>

      {/* 3. Xizmat turi */}
      <div data-booking-field="service">
        <FieldLabel required>{pick(lang, "Xizmat turi", "Услуга")}</FieldLabel>
        <div className={fieldErrors.service ? "rounded-2xl ring-1 ring-red-500/70 p-1" : ""}>
          <ServicePicker
            services={services}
            loading={svcLoading}
            value={form.serviceId}
            onChange={(id) => onChange({ serviceId: id, time: "" })}
            onAddNew={onAddService}
          />
        </div>
        <FieldError message={fieldErrors.service} />
      </div>

      {/* 4. Sana */}
      <div data-booking-field="date">
        <FieldLabel required>{pick(lang, "Sana", "Дата")}</FieldLabel>
        <DatePicker form={form} onPick={onPickDate} hasError={Boolean(fieldErrors.date)} isClosed={isClosed} />
        <FieldError message={fieldErrors.date} />
      </div>

      {/* 5. Vaqt */}
      <div data-booking-field="time">
        <FieldLabel required>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {pick(lang, "Vaqt", "Время")}
            {selectedSvc && (
              <span className="text-xs text-primary ml-1">
                ({selectedSvc.duration} {pick(lang, "daqiqa", "мин")})
              </span>
            )}
          </span>
        </FieldLabel>
        {!readyForSlots ? (
          <p
            className={`text-sm text-muted-foreground py-3 text-center rounded-2xl border border-dashed ${
              fieldErrors.time ? "border-red-500/70" : "border-white/10"
            }`}
          >
            {pick(lang, "Oldin xizmat va sanani tanlang", "Сначала выберите услугу и дату")}
          </p>
        ) : (
          <div className={fieldErrors.time ? "rounded-2xl ring-1 ring-red-500/70 p-2" : ""}>
            <TimePicker
              standardSlots={standardSlots}
              afterSlots={afterSlots}
              showAfterHours={showAfterHours}
              onToggleAfterHours={onToggleAfterHours}
              todayPassed={todayPassed}
              value={form.time}
              onChange={(t) => onChange({ time: t })}
              workEndStr={workEndStr}
            />
          </div>
        )}
        <FieldError message={fieldErrors.time} />
      </div>

      {/* 6. Izoh */}
      <div>
        <FieldLabel optional>{pick(lang, "Izoh", "Комментарий")}</FieldLabel>
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={pick(lang, "Qo'shimcha ma'lumotlar...", "Дополнительно...")}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm resize-none"
        />
      </div>

      {/* Save */}
      <p className="text-xs text-muted-foreground/80 text-center leading-relaxed px-1">
        {pick(lang, "⚠️ Iltimos, barcha majburiy maydonlarni to'ldiring.", "⚠️ Заполните все обязательные поля.")}
      </p>
      <button
        type="button"
        onClick={onSave}
        className={`w-full h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
          saving || saved
            ? "bg-green-500/80 text-white"
            : "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25 hover:-translate-y-0.5"
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {pick(lang, "Saqlanmoqda...", "Сохраняется...")}
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            {pick(lang, "Saqlandi!", "Сохранено!")}
          </>
        ) : (
          pick(lang, "Saqlash", "Сохранить")
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

type ActiveTab = "bron" | "xarajat";

// ── Main dialog export ────────────────────────────────────────────────────────
export function BookingFlowDialog({ open, onOpenChange }: Props) {
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bron");

  const { toast } = useToast();

  // ── Profile (working hours, lunch, buffer) ────────────────────────────────
  const { data: profile } = useGetProfile();
  const sched = (profile ?? {}) as ProfileSchedule;

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [scrollKey, setScrollKey] = useState(0);
  const [allowedOffDate, setAllowedOffDate] = useState<string | null>(null);
  const [pendingOffDate, setPendingOffDate] = useState<string | null>(null);

  // ── Existing bookings (conflict detection) ────────────────────────────────
  const { data: bookingsData } = useListBookings({ date: form.date || todayStr() });
  const bookedIntervals = bookingsToIntervals(
    (bookingsData?.bookings ?? []).filter((b) => b.status !== "cancelled" && (b.status as string) !== "auto_cancelled" && (b.status as string) !== "no_show"),
  );

  // Hours for the chosen weekday (Monday and Friday can differ).
  const dayHours = resolveDaySchedule(sched, form.date || todayStr());
  const isOffDay = !dayHours.enabled;
  const offOverride = isOffDay && allowedOffDate === form.date && form.date !== "";
  const treatAsClosed = isOffDay && !offOverride;
  const globalStart = sched.workingHoursStart || "09:00";
  const workStartStr = treatAsClosed ? globalStart : dayHours.start;
  const workEndStr = treatAsClosed ? globalStart : dayHours.end;
  const workStart = toMins(workStartStr);
  const workEnd = toMins(workEndStr);
  const bufferMins = normalizeBuffer(sched.bufferTime);

  // ── Create booking ────────────────────────────────────────────────────────
  const createBookingMut = useCreateBooking();

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, date: todayStr() });
      setShowAddService(false);
      setShowAfterHours(false);
      setPendingAfterHours(false);
      setSaving(false);
      setSaved(false);
      setFieldErrors({});
      setScrollKey(0);
      setActiveTab("bron");
      setAllowedOffDate(null);
      setPendingOffDate(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !profile) return;
    setForm((current) => {
      if (!current.date || current.date === allowedOffDate) return current;
      if (resolveDaySchedule(sched, current.date).enabled) return current;
      return { ...current, date: "", time: "" };
    });
  }, [open, profile, allowedOffDate, sched]);

  const selectedSvc = services.find((s) => s.id === form.serviceId);
  const duration = selectedSvc?.duration ?? 0;

  // Filter past/current time slots when booking for today (Tashkent clock)
  const nowMins = form.date === todayStr() ? tashkentNowMinutes() : null;

  // Slot End = Start + Duration + Buffer; first slot after a booking is anchored to its end.
  const standardInput = {
    duration,
    buffer: bufferMins,
    rangeStart: workStart,
    rangeEnd: workEnd,
    bookings: bookedIntervals,
    fixedBreaks: lunchInterval(sched),
  };
  const standardSlots =
    !treatAsClosed && duration > 0 ? generateSmartSlots({ ...standardInput, nowMins }) : [];
  // "Bugun" with every working hour already behind us.
  const todayPassed =
    duration > 0 &&
    todaySlotsExhausted({
      isToday: form.date === todayStr(),
      dayOpen: !treatAsClosed,
      slotsNow: standardSlots.length,
      slotsIgnoringNow: !treatAsClosed ? generateSmartSlots({ ...standardInput, nowMins: null }).length : 0,
      nowMins,
      dayEnd: workEnd,
    });
  // "+ Ish vaqtidan tashqari xizmat": everything after closing (the whole day on a day off).
  const afterSlots =
    duration > 0
      ? generateSmartSlots({
          duration,
          buffer: bufferMins,
          rangeStart: workEnd,
          rangeEnd: 23 * 60 + 30,
          bookings: bookedIntervals,
          nowMins,
        })
      : [];

  const isAfterHoursTime =
    form.time !== "" && (treatAsClosed || toMins(form.time) >= workEnd);

  function dayIsClosed(iso: string) {
    return !resolveDaySchedule(sched, iso).enabled;
  }

  function pickDate(date: string) {
    if (dayIsClosed(date) && allowedOffDate !== date) {
      setPendingOffDate(date);
      return;
    }
    patchForm({ date, time: "" });
  }

  function confirmOffDay() {
    if (!pendingOffDate) return;
    const date = pendingOffDate;
    setAllowedOffDate(date);
    setPendingOffDate(null);
    patchForm({ date, time: "" });
  }

  function patchForm(patch: Partial<FormState>) {
    const nextForm = { ...form, ...patch };
    setForm(nextForm);
    setFieldErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const stillInvalid = collectFieldErrors(nextForm, lang);
      const next: FieldErrors = {};
      for (const key of FIELD_ORDER) {
        if (prev[key] && stillInvalid[key]) next[key] = prev[key];
      }
      return next;
    });
  }

  function handleSave() {
    if (saving || saved) return;
    const errors = collectFieldErrors(form, lang);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setScrollKey((n) => n + 1);
      return;
    }
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

    const phoneDigitsForApi = form.phone.replace(/\D/g, "");
    const clientPhoneForApi = phoneDigitsForApi.length >= 12 ? form.phone.trim() : undefined;

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(clientPhoneForApi ? { clientPhone: clientPhoneForApi } : {}),
        } as any,
      },
      {
        onSuccess: () => {
          setSaving(false);
          setSaved(true);
          // Invalidate bookings (Calendar + Dashboard) and clients list
          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardStatsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListClientsQueryKey(),
          });
          setTimeout(() => {
            onOpenChange(false);
            setLocation("/dashboard");
          }, 700);
        },
        onError: (err) => {
          setSaving(false);
          if ((err as { status?: number } | null)?.status === 409) {
            toast({
              title: pick(lang, "Bu vaqt band", "Это время занято"),
              description: pick(lang, "Boshqa vaqtni tanlang — tanaffus vaqti ham hisobga olinadi.", "Выберите другое время — перерыв тоже учитывается."),
              variant: "destructive",
            });
          }
        },
      }
    );
  }

  async function handleAddService(data: ServiceFormData) {
    setSvcSaving(true);
    createSvcMut.mutate(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          name: data.name,
          duration: data.duration,
          price: data.price,
          ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        } as any,
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
            {/* Tab row with X close — only shown when not in add-service flow */}
            {!showAddService && (
              <div className="flex items-center gap-2 pt-2 mb-1">
                {(["bron", "xarajat"] as ActiveTab[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                      activeTab === key
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-background/40 border-white/8 text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    {key === "bron" ? pick(lang, "📅 Bron", "📅 Запись") : pick(lang, "💸 Xarajat", "💸 Расход")}
                  </button>
                ))}
                {/* Close button lives here, inline with tabs */}
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

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
              ) : activeTab === "xarajat" ? (
                <motion.div
                  key="expense-form"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.18 }}
                >
                  <ExpenseForm
                    onClose={close}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
                      onOpenChange(false);
                      setLocation("/dashboard");
                    }}
                  />
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
                    onChange={patchForm}
                    services={services}
                    svcLoading={svcLoading}
                    selectedSvc={selectedSvc}
                    standardSlots={standardSlots}
                    afterSlots={afterSlots}
                    showAfterHours={showAfterHours}
                    onToggleAfterHours={() => setShowAfterHours((v) => !v)}
                    todayPassed={todayPassed}
                    workEndStr={workEndStr}
                    fieldErrors={fieldErrors}
                    scrollKey={scrollKey}
                    saving={saving}
                    saved={saved}
                    onSave={handleSave}
                    onClose={close}
                    onAddService={() => setShowAddService(true)}
                    isClosed={dayIsClosed}
                    onPickDate={pickDate}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingOffDate && open && (
          <OffDayWarning
            onConfirm={confirmOffDay}
            onCancel={() => setPendingOffDate(null)}
          />
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
