import { useState, useRef } from "react";
import { APP_ORIGIN, APP_HOST } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Plus, Copy, Check, Share2, Trash2, Camera, X, Scissors, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";

// ── Types ──────────────────────────────────────────────────────────────────────

type Daraja = "oddiy" | "top" | "senior";
type BarberStatus = "active" | "pending";

interface Barber {
  id: string;
  name: string;
  slug: string;
  speciality: string[];
  bio: string;
  phone: string;
  daraja: Daraja;
  status: BarberStatus;
  imageUrl?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSlug(name: string, existing: string[]): string {
  const base = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.startsWith("998")) {
    const d = digits.slice(3);
    if (d.length === 0) return "+998 ";
    if (d.length <= 2) return `+998 (${d}`;
    if (d.length <= 5) return `+998 (${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 7) return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5)}`;
    return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`;
  }
  if (digits.length === 0) return "";
  return `+998 `;
}

function barberLink(slug: string): string {
  return `${APP_ORIGIN}/${slug}`;
}

// ── Daraja badge ───────────────────────────────────────────────────────────────

const DARAJA_LABEL: Record<Daraja, string> = {
  oddiy: "Oddiy barber",
  top: "🔥 Top barber",
  senior: "💎 Senior",
};

const DARAJA_CLASS: Record<Daraja, string> = {
  oddiy: "bg-white/8 text-muted-foreground border-white/10",
  top: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  senior: "bg-red-500/15 text-red-400 border-red-500/25",
};

function DarajaBadge({ daraja }: { daraja: Daraja }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DARAJA_CLASS[daraja]}`}>
      {DARAJA_LABEL[daraja]}
    </span>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BarberStatus }) {
  if (status === "active") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Aktiv
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/12 text-yellow-400 border border-yellow-400/20 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
      Kutilmoqda
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "from-primary/30 to-primary/10 text-primary border-primary/20",
  "from-amber-500/30 to-amber-500/10 text-amber-400 border-amber-500/20",
  "from-emerald-500/30 to-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "from-blue-500/30 to-blue-500/10 text-blue-400 border-blue-500/20",
  "from-purple-500/30 to-purple-500/10 text-purple-400 border-purple-500/20",
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function Avatar({ barber, size = "md" }: { barber: Barber; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-10 h-10 text-base" : size === "lg" ? "w-16 h-16 text-2xl" : "w-12 h-12 text-xl";
  if (barber.imageUrl) {
    return (
      <img
        src={barber.imageUrl}
        alt={barber.name}
        className={`${sz} rounded-2xl object-cover border border-white/10 shrink-0`}
      />
    );
  }
  return (
    <div className={`${sz} rounded-2xl bg-gradient-to-br border flex items-center justify-center font-display font-bold uppercase shrink-0 ${getAvatarColor(barber.name)}`}>
      {barber.name.charAt(0)}
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Nusxalash" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handle}
      className={`flex-1 h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
        copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-primary text-black hover:bg-primary/90"
      }`}
    >
      {copied ? <><Check className="w-4 h-4" /> Nusxalandi!</> : <><Copy className="w-4 h-4" /> {label}</>}
    </button>
  );
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const INITIAL_BARBERS: Barber[] = [
  {
    id: "1",
    name: "Sardor",
    slug: "sardor",
    speciality: ["Fade", "Soqol"],
    bio: "Zamonaviy barber. 5 yillik tajriba. Har bir mijozga individual yondashuv.",
    phone: "+998 (90) 123-45-67",
    daraja: "top",
    status: "active",
  },
  {
    id: "2",
    name: "Jamshid",
    slug: "jamshid",
    speciality: ["Haircut"],
    bio: "",
    phone: "",
    daraja: "oddiy",
    status: "pending",
  },
];

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  specialityRaw: string;
  bio: string;
  phone: string;
  daraja: Daraja;
  imageUrl: string;
}

const EMPTY_FORM: FormState = {
  name: "", specialityRaw: "", bio: "", phone: "", daraja: "oddiy", imageUrl: "",
};

function barberToForm(b: Barber): FormState {
  return {
    name: b.name,
    specialityRaw: b.speciality.join(", "),
    bio: b.bio,
    phone: b.phone,
    daraja: b.daraja,
    imageUrl: b.imageUrl ?? "",
  };
}

// ── Screens ────────────────────────────────────────────────────────────────────
// view: "list" | "add" | "success"
// linkSheet: barber shown in bottom sheet
// deleteTarget: barber pending delete confirm
// editingId: if set, form is in edit mode for this barber

// ── Link bottom sheet ─────────────────────────────────────────────────────────

function LinkBottomSheet({
  barber,
  onClose,
  onDelete,
}: {
  barber: Barber;
  onClose: () => void;
  onDelete: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const fullLink = barberLink(barber.slug);
  const displayLink = `${APP_HOST}/${barber.slug}`;

  function handleShare() {
    const text = `Menga yozilish uchun:\n${fullLink}`;
    if (navigator.share) {
      navigator.share({ title: `${barber.name} — Barber`, text, url: fullLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  function handleDownload() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = 500; canvas.height = 500;
      if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 500, 500); ctx.drawImage(img, 25, 25, 450, 450); }
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `barber-qr-${barber.slug}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar barber={barber} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-foreground text-sm">{barber.name}</div>
            <div className="text-xs text-muted-foreground">{displayLink}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Link box */}
        <div className="bg-background/60 border border-white/8 rounded-2xl px-3 py-2.5 mb-4">
          <p className="text-xs text-muted-foreground font-mono break-all">{displayLink}</p>
        </div>

        {/* Link actions: Copy + Share */}
        <div className="flex gap-2 mb-5">
          <CopyBtn text={fullLink} />
          <button
            onClick={handleShare}
            className="flex-1 h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-white/8 border border-white/10 hover:bg-white/12 transition-all text-foreground"
          >
            <Share2 className="w-4 h-4" /> Ulashish
          </button>
        </div>

        {/* QR code block */}
        <div className="bg-background/40 border border-white/6 rounded-2xl p-4 flex flex-col items-center mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">QR kod</p>
          <div ref={qrRef} className="bg-white p-3 rounded-xl shadow-lg shadow-black/30 mb-3">
            <QRCode value={fullLink} size={140} fgColor="#000000" bgColor="#ffffff" level="M" />
          </div>
          <p className="text-xs text-muted-foreground mb-3">📷 Mijozlar skaner qilib bron qilishi mumkin</p>
          <button
            onClick={handleDownload}
            className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/8 bg-white/5 text-muted-foreground hover:text-foreground transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Yuklab olish
          </button>
        </div>

        {/* Divider + Delete */}
        <div className="h-px bg-white/6 mb-3" />
        <button
          onClick={onDelete}
          className="w-full h-10 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="w-4 h-4" /> O'chirish
        </button>
        <p className="text-xs text-muted-foreground/50 text-center mt-2">Bu amalni qaytarib bo'lmaydi</p>
      </motion.div>
    </div>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────────

function DeleteModal({
  barber,
  onCancel,
  onConfirm,
}: {
  barber: Barber;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-destructive/15 mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground text-center mb-1.5">Ustani o'chirmoqchimisiz?</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          <span className="font-semibold text-foreground">{barber.name}</span> tizimdan butunlay o'chiriladi.<br />Bu amalni qaytarib bo'lmaydi.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm hover:bg-white/10 transition-all"
          >
            Yo'q
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-destructive text-white font-semibold text-sm hover:bg-destructive/85 transition-all"
          >
            Ha, o'chirish
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Barber card ────────────────────────────────────────────────────────────────

function BarberCard({ barber, onLinkClick, onEdit, index }: {
  barber: Barber;
  onLinkClick: () => void;
  onEdit: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05 }}
    >
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={onEdit}
        className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3 cursor-pointer"
      >
        <Avatar barber={barber} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm text-foreground">{barber.name}</span>
            <StatusBadge status={barber.status} />
            {barber.daraja !== "oddiy" && <DarajaBadge daraja={barber.daraja} />}
          </div>
          {barber.speciality.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {barber.speciality.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-muted-foreground border border-white/8">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onLinkClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            🔗 Link olish
          </button>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      </motion.div>
    </motion.div>
  );
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

function BarberForm({
  initial,
  isEdit,
  onBack,
  onSubmit,
}: {
  initial: FormState;
  isEdit: boolean;
  onBack: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<{ name?: string; speciality?: string; bio?: string }>({});
  const [loading, setLoading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handlePhoneChange(raw: string) {
    if (raw === "" || raw === "+998 " || raw.replace(/\D/g, "").length <= 3) {
      set("phone", "");
      return;
    }
    const clean = raw.replace(/\D/g, "");
    const withPrefix = clean.startsWith("998") ? clean : "998" + clean.replace(/^0+/, "");
    set("phone", formatPhone(withPrefix));
  }

  function handlePhoneFocus() {
    if (!form.phone) set("phone", "+998 ");
  }

  function handlePhoneBlur() {
    if (form.phone === "+998 ") set("phone", "");
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("imageUrl", ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Ism majburiy";
    const tags = form.specialityRaw.split(",").map(s => s.trim()).filter(Boolean);
    if (tags.length > 3) errs.speciality = "Maksimal 3 ta mutaxassislik";
    if (form.bio.length > 140) errs.bio = "Maksimal 140 belgi";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSubmit(form);
    }, 800);
  }

  const bioLen = form.bio.length;
  const specialityCount = form.specialityRaw.split(",").map(s => s.trim()).filter(Boolean).length;

  return (
    <motion.div
      key="form"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 h-10 px-3 rounded-2xl bg-card border border-white/8 hover:bg-white/5 transition-colors text-sm font-semibold"
        >
          <ChevronLeft className="w-4 h-4" /> Orqaga
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">
          {isEdit ? "Ustani tahrirlash" : "Usta qo'shish"}
        </h1>
      </div>

      {/* Info banner */}
      <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5">
        <p className="text-xs text-amber-400/90 leading-relaxed">
          ⚠️ Bu ma'lumotlar Barbershop sahifasida bron qilish jarayonida mijozlarga ko'rinadi
        </p>
      </div>

      <div className="space-y-5">
        {/* Avatar + upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="preview" className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
            ) : (
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br border flex items-center justify-center font-display font-bold text-3xl uppercase ${form.name ? getAvatarColor(form.name) : "from-white/10 to-white/5 text-muted-foreground border-white/10"}`}>
                {form.name ? form.name.charAt(0) : "?"}
              </div>
            )}
            <button
              onClick={() => imgRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-primary flex items-center justify-center shadow-lg"
            >
              <Camera className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <div className="flex gap-2">
            <button
              onClick={() => imgRef.current?.click()}
              className="text-xs text-primary font-semibold hover:underline"
            >
              📷 Rasm yuklash
            </button>
            {form.imageUrl && (
              <button onClick={() => set("imageUrl", "")} className="text-xs text-muted-foreground hover:text-destructive">
                O'chirish
              </button>
            )}
          </div>
        </div>

        {/* Ism */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Ism <span className="text-destructive">*</span></label>
          <input
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="Masalan: Sardor Barber"
            className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Mutaxassislik */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Mutaxassislik <span className="text-muted-foreground font-normal">(ixtiyoriy)</span>
          </label>
          <input
            value={form.specialityRaw}
            onChange={e => set("specialityRaw", e.target.value)}
            placeholder="Mutaxassisligingizni yozing (masalan: Fade, Soqol, Klassik soch turmagi)"
            className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <p className="text-xs text-muted-foreground">Vergul bilan ajrating · Maksimal 3 ta · {specialityCount}/3</p>
          {errors.speciality && <p className="text-xs text-destructive">{errors.speciality}</p>}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Ma'lumot (Bio) <span className="text-muted-foreground font-normal">(ixtiyoriy)</span>
          </label>
          <textarea
            value={form.bio}
            onChange={e => set("bio", e.target.value)}
            rows={3}
            placeholder="Bu yerga o'zingiz haqingizdagi qisqa tavsifni yozing. Masalan: tajribangiz, mutaxassisligingiz yoki mijozlaringizga nima taklif qilayotganingiz."
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Qisqa yozing (1–2 gap)</p>
            <p className={`text-xs font-mono ${bioLen > 130 ? "text-destructive" : "text-muted-foreground"}`}>
              {bioLen} / 140
            </p>
          </div>
          {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
        </div>

        {/* Telefon */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Telefon raqam <span className="text-muted-foreground font-normal">(ixtiyoriy)</span>
          </label>
          <input
            value={form.phone}
            onFocus={handlePhoneFocus}
            onBlur={handlePhoneBlur}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder="+998 (90) 123-45-67"
            inputMode="tel"
            className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <p className="text-xs text-muted-foreground">Telefon raqam aloqa uchun faqat adminga ko'rinadi, mijozlarga ko'rinmaydi</p>
        </div>

        {/* Daraja */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Daraja <span className="text-muted-foreground font-normal">(ixtiyoriy)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["oddiy", "top", "senior"] as Daraja[]).map(d => (
              <button
                key={d}
                onClick={() => set("daraja", d)}
                className={`py-2.5 px-2 rounded-2xl text-xs font-semibold border transition-all text-center ${
                  form.daraja === d
                    ? d === "oddiy"
                      ? "bg-white/12 border-white/25 text-foreground"
                      : d === "top"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-white/4 border-white/8 text-muted-foreground hover:bg-white/8"
                }`}
              >
                {DARAJA_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-13 py-3.5 rounded-2xl bg-primary text-black font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saqlanmoqda...</>
          ) : (
            isEdit ? "Saqlash" : "Davom etish"
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ barber, onDone }: { barber: Barber; onDone: () => void }) {
  const fullLink = barberLink(barber.slug);
  const displayLink = `${APP_HOST}/${barber.slug}`;

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: `${barber.name} — Barber`, url: fullLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(fullLink);
    }
  }

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center text-center py-8"
    >
      <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-4xl mb-5">
        ✅
      </div>
      <h2 className="text-2xl font-display font-bold text-foreground mb-1">Usta qo'shildi!</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Quyidagi linkni ustaga yuboring — u orqali akkauntini faollashtiradi
      </p>

      <div className="w-full bg-card border border-white/8 rounded-2xl px-4 py-3 mb-5 text-left">
        <p className="text-xs text-muted-foreground mb-1">Usta linki</p>
        <p className="text-sm font-mono font-semibold text-primary break-all">{displayLink}</p>
      </div>

      <div className="flex gap-3 w-full mb-8">
        <CopyBtn text={fullLink} />
        <button
          onClick={handleShare}
          className="flex-1 h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-white/8 border border-white/10 hover:bg-white/12 transition-all"
        >
          <Share2 className="w-4 h-4" /> Ulashish
        </button>
      </div>

      <button
        onClick={onDone}
        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Ro'yxatga qaytish
      </button>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = "list" | "add" | "success";

export default function BarbersPage() {
  useAuth();

  const [barbers, setBarbers] = useState<Barber[]>(INITIAL_BARBERS);
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBarber, setNewBarber] = useState<Barber | null>(null);
  const [linkSheetBarber, setLinkSheetBarber] = useState<Barber | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Barber | null>(null);

  const activeCount = barbers.filter(b => b.status === "active").length;
  const existingSlugs = barbers.map(b => b.slug);

  // ── Handlers ──

  function handleAddSubmit(form: FormState) {
    const slug = makeSlug(form.name.trim(), existingSlugs);
    const speciality = form.specialityRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
    const b: Barber = {
      id: Date.now().toString(),
      name: form.name.trim(),
      slug,
      speciality,
      bio: form.bio,
      phone: form.phone,
      daraja: form.daraja,
      status: "pending",
      imageUrl: form.imageUrl || undefined,
    };
    setBarbers(prev => [...prev, b]);
    setNewBarber(b);
    setView("success");
  }

  function handleEditSubmit(form: FormState) {
    setBarbers(prev => prev.map(b => {
      if (b.id !== editingId) return b;
      const speciality = form.specialityRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
      return {
        ...b,
        name: form.name.trim(),
        speciality,
        bio: form.bio,
        phone: form.phone,
        daraja: form.daraja,
        imageUrl: form.imageUrl || undefined,
        // slug NEVER changes
      };
    }));
    setEditingId(null);
    setView("list");
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBarbers(prev => prev.filter(b => b.id !== deleteTarget.id));
    setDeleteTarget(null);
    setLinkSheetBarber(null);
  }

  function openEdit(barber: Barber) {
    setEditingId(barber.id);
    setLinkSheetBarber(null);
    setView("add");
  }

  function openDelete(barber: Barber) {
    setLinkSheetBarber(null);
    setDeleteTarget(barber);
  }

  // ── Render form ──

  if (view === "add") {
    const editing = editingId ? barbers.find(b => b.id === editingId) : null;
    return (
      <Layout>
        <BarberForm
          initial={editing ? barberToForm(editing) : EMPTY_FORM}
          isEdit={!!editing}
          onBack={() => { setView("list"); setEditingId(null); }}
          onSubmit={editing ? handleEditSubmit : handleAddSubmit}
        />
      </Layout>
    );
  }

  if (view === "success" && newBarber) {
    return (
      <Layout>
        <SuccessScreen barber={newBarber} onDone={() => { setNewBarber(null); setView("list"); }} />
      </Layout>
    );
  }

  // ── List view ──

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-display font-bold text-foreground">👷 Ustalar boshqaruvi</h1>
        </div>
        <AnimatePresence>
          {!linkSheetBarber && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={() => { setEditingId(null); setView("add"); }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-2xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Usta qo'shish
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-3 mb-5"
      >
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <div className="text-2xl font-display font-bold text-primary">{barbers.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Jami ustalar</div>
        </div>
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <div className="text-2xl font-display font-bold text-emerald-400">{activeCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Aktiv</div>
        </div>
      </motion.div>

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence>
          {barbers.map((b, i) => (
            <BarberCard
              key={b.id}
              barber={b}
              index={i}
              onLinkClick={() => setLinkSheetBarber(b)}
              onEdit={() => openEdit(b)}
            />
          ))}
        </AnimatePresence>

        {barbers.length === 0 && (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
            <Scissors className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Hali usta qo'shilmagan</p>
            <button
              onClick={() => setView("add")}
              className="mt-3 text-sm text-primary font-semibold hover:underline"
            >
              + Usta qo'shish
            </button>
          </div>
        )}
      </div>

      {/* Link bottom sheet */}
      <AnimatePresence>
        {linkSheetBarber && (
          <LinkBottomSheet
            barber={linkSheetBarber}
            onClose={() => setLinkSheetBarber(null)}
            onDelete={() => openDelete(linkSheetBarber)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            barber={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
