import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Copy, Check, Download, Share2, Eye,
  QrCode, Plus, X, Pencil, Trash2, Clock, MapPin,
  Instagram, Camera, CheckCircle2, ArrowLeft, ExternalLink,
  Send, Tag,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type Tab = "asosiy" | "xizmatlar" | "qr";
type ServiceCategory = "soch" | "soqol" | "bolalar" | "vip";

interface ProfileData {
  name: string;
  bio: string;
  speciality: string[];
  phone: string;
  address: string;
  mapLink: string;
  workDays: string;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  telegram: string;
  instagram: string;
  profileImage: string;
  coverImage: string;
}

interface ServiceItem {
  id: string;
  category: ServiceCategory;
  name: string;
  duration: number;
  price: number;
  description: string;
  imageUrl?: string;
  comboIds?: string[];
  comboPrice?: number;
}

interface BarberSlot {
  id: string;
  name: string;
  daraja: "oddiy" | "top" | "senior";
  speciality: string[];
  busy: { start: string; duration: number }[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Demo data
// ──────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { id: ServiceCategory | "all"; label: string }[] = [
  { id: "all", label: "Hammasi" },
  { id: "soch", label: "✂️ Soch" },
  { id: "soqol", label: "🪒 Soqol" },
  { id: "bolalar", label: "👦 Bolalar" },
  { id: "vip", label: "💎 VIP" },
];

const DEMO_PROFILE: ProfileData = {
  name: "Sardor Barber",
  bio: "Zamonaviy va klassik uslublarni uyg'unlashtiruvchi tajribali barber. 7 yillik tajriba.",
  speciality: ["Fade", "Soqol", "Klassik"],
  phone: "+998 90 123 45 67",
  address: "Toshkent, Chilonzor, 14-uy",
  mapLink: "https://maps.google.com",
  workDays: "Dush — Shan",
  workStart: "09:00",
  workEnd: "20:00",
  lunchStart: "13:00",
  lunchEnd: "14:00",
  telegram: "@sardor_barber",
  instagram: "@sardor.barber",
  profileImage: "",
  coverImage: "",
};

const DEMO_SERVICES: ServiceItem[] = [
  { id: "fade", category: "soch", name: "Fade", duration: 45, price: 80000, description: "Zamonaviy fade soch kesim — pastdan yuqoriga silliq gradient o'tish bilan." },
  { id: "klassik", category: "soch", name: "Klassik soch", duration: 30, price: 60000, description: "Klassik soch kesim, har qanday shaklga moslashadi." },
  { id: "soqol", category: "soqol", name: "Soqol olish", duration: 20, price: 40000, description: "Professional soqol shakllantirish va parfum bilan parvarishlash." },
  {
    id: "kompleks", category: "soch", name: "Soch + Soqol", duration: 60,
    price: 100000, description: "Combo: Fade + Soqol. Tejaladi: 20,000 so'm.",
    comboIds: ["fade", "soqol"], comboPrice: 100000,
  },
  { id: "bolalar", category: "bolalar", name: "Bolalar kesim", duration: 25, price: 50000, description: "8 yoshgacha bolalar uchun yumshoq va tez kesim." },
  { id: "vip", category: "vip", name: "VIP paketi", duration: 90, price: 200000, description: "Premium xizmat: soch + soqol + qosh + yuz parvarishi." },
];

const TEAM_BARBERS: BarberSlot[] = [
  {
    id: "sardor", name: "Sardor", daraja: "top", speciality: ["Fade", "Soqol"],
    busy: [{ start: "09:00", duration: 45 }, { start: "11:00", duration: 60 }, { start: "14:00", duration: 45 }],
  },
  {
    id: "jamshid", name: "Jamshid", daraja: "oddiy", speciality: ["Haircut"],
    busy: [{ start: "10:00", duration: 30 }, { start: "13:00", duration: 60 }],
  },
];

const SOLO_BUSY = [
  { start: "09:30", duration: 45 },
  { start: "11:00", duration: 30 },
  { start: "14:00", duration: 60 },
  { start: "17:30", duration: 45 },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtTime(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
function formatDur(n: number) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  return m > 0 ? `${h}s ${m}m` : `${h} soat`;
}
function formatPrice(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(0) + "k" : String(n);
}

function generateSlots(duration: number, busy: { start: string; duration: number }[]) {
  const START = 9 * 60, END = 20 * 60;
  const slots: string[] = [];
  for (let t = START; t + duration <= END; t += 30) {
    const end = t + duration;
    if (!busy.some(b => { const bs = toMins(b.start), be = bs + b.duration; return t < be && end > bs; })) {
      slots.push(fmtTime(t));
    }
  }
  return slots;
}

const DARAJA_LABEL: Record<string, string> = { oddiy: "Barber", top: "🔥 Top", senior: "💎 Senior" };
const DARAJA_CLS: Record<string, string> = {
  oddiy: "bg-white/8 text-muted-foreground",
  top: "bg-amber-500/15 text-amber-400",
  senior: "bg-red-500/15 text-red-400",
};

function BarbAvatar({ barber }: { barber: BarberSlot }) {
  const COLORS = ["from-primary/30 to-primary/10 text-primary", "from-amber-500/30 to-amber-500/10 text-amber-400", "from-emerald-500/30 to-emerald-500/10 text-emerald-400"];
  const c = COLORS[barber.name.charCodeAt(0) % COLORS.length];
  return (
    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br border border-white/10 flex items-center justify-center font-bold text-base uppercase shrink-0 ${c}`}>
      {barber.name.charAt(0)}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab bar
// ──────────────────────────────────────────────────────────────────────────────

function TabBar({ tab, onChange, isTeam }: { tab: Tab; onChange: (t: Tab) => void; isTeam: boolean }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "asosiy", label: "Asosiy" },
    { id: "xizmatlar", label: "Xizmatlar" },
    ...(isTeam ? [{ id: "qr" as Tab, label: "QR & Link" }] : [{ id: "qr" as Tab, label: "QR & Link" }]),
  ];
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-2xl mb-5">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ASOSIY TAB — edit mode
// ──────────────────────────────────────────────────────────────────────────────

function AsosiyTab({ profile, onChange }: { profile: ProfileData; onChange: (p: ProfileData) => void }) {
  const imgRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [newTag, setNewTag] = useState("");

  function set(k: keyof ProfileData, v: string) {
    onChange({ ...profile, [k]: v });
  }

  function handleImage(key: "profileImage" | "coverImage", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set(key, ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function addTag() {
    const tag = newTag.trim();
    if (!tag || profile.speciality.length >= 5) return;
    onChange({ ...profile, speciality: [...profile.speciality, tag] });
    setNewTag("");
  }

  function removeTag(i: number) {
    onChange({ ...profile, speciality: profile.speciality.filter((_, idx) => idx !== i) });
  }

  const field = (label: string, key: keyof ProfileData, placeholder?: string, hint?: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        value={profile[key] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
      />
      {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Images */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rasmlar</label>
        <div className="relative">
          {/* Cover */}
          <div
            className="w-full h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-white/8 flex items-center justify-center cursor-pointer hover:from-primary/30 transition-all relative overflow-hidden"
            onClick={() => coverRef.current?.click()}
          >
            {profile.coverImage
              ? <img src={profile.coverImage} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-1 text-muted-foreground/50"><Camera className="w-5 h-5" /><span className="text-xs">Muqova rasmi</span></div>
            }
          </div>
          {/* Avatar overlay */}
          <div
            className="absolute -bottom-5 left-4 w-14 h-14 rounded-2xl border-2 border-background cursor-pointer"
            onClick={() => imgRef.current?.click()}
          >
            {profile.profileImage
              ? <img src={profile.profileImage} className="w-full h-full rounded-2xl object-cover" />
              : <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-white/10 flex items-center justify-center font-bold text-xl text-primary uppercase">{profile.name.charAt(0) || "?"}</div>
            }
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Camera className="w-2.5 h-2.5 text-black" /></div>
          </div>
        </div>
        <div className="mt-6 text-xs text-muted-foreground/50 text-center">Profil va muqova rasmlarini yuklash uchun bosing</div>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage("profileImage", e)} />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage("coverImage", e)} />
      </div>

      {/* Name */}
      {field("Ism / Nom *", "name", "Sardor Barber")}

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tavsif (Bio)</label>
        <textarea
          value={profile.bio}
          onChange={e => set("bio", e.target.value)}
          rows={3}
          placeholder="O'zingiz yoki salonIngiz haqida qisqa tavsif..."
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <p className="text-xs text-muted-foreground/50 text-right">{profile.bio.length} / 200</p>
      </div>

      {/* Speciality tags */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mutaxassislik (tegler)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {profile.speciality.map((s, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              {s}
              <button onClick={() => removeTag(i)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTag()}
            placeholder="+ Yangi teg qo'shish"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
          <button onClick={addTag} className="h-10 px-3 rounded-xl bg-white/8 border border-white/10 text-muted-foreground hover:text-foreground transition-colors"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Phone */}
      {field("Telefon (faqat admin ko'radi)", "phone", "+998 (90) 123-45-67")}

      {/* Address + Map */}
      <div className="space-y-2">
        {field("Manzil", "address", "Toshkent, Chilonzor, 14-uy")}
        <div className="flex gap-2">
          <input
            value={profile.mapLink}
            onChange={e => set("mapLink", e.target.value)}
            placeholder="Google Maps havolasi (ixtiyoriy)"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-xs focus:outline-none focus:border-primary/50 text-muted-foreground"
          />
          {profile.mapLink && (
            <a href={profile.mapLink} target="_blank" rel="noopener noreferrer"
              className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center text-xs font-semibold gap-1.5 hover:bg-primary/20 transition-colors">
              <MapPin className="w-3.5 h-3.5" /> Ko'rish
            </a>
          )}
        </div>
      </div>

      {/* Work schedule */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ish vaqti</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ish kunlari</p>
            <input value={profile.workDays} onChange={e => set("workDays", e.target.value)} placeholder="Dush — Shan"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ish vaqti</p>
            <div className="flex items-center gap-1">
              <input value={profile.workStart} onChange={e => set("workStart", e.target.value)} placeholder="09:00"
                className="w-full h-10 px-2 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
              <span className="text-muted-foreground text-xs">—</span>
              <input value={profile.workEnd} onChange={e => set("workEnd", e.target.value)} placeholder="20:00"
                className="w-full h-10 px-2 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Tushlik (ixtiyoriy)</p>
          <div className="flex items-center gap-2">
            <input value={profile.lunchStart} onChange={e => set("lunchStart", e.target.value)} placeholder="13:00"
              className="w-28 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
            <span className="text-muted-foreground text-xs">—</span>
            <input value={profile.lunchEnd} onChange={e => set("lunchEnd", e.target.value)} placeholder="14:00"
              className="w-28 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
          </div>
        </div>
      </div>

      {/* Social */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ijtimoiy tarmoqlar</label>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center shrink-0">
            <Send className="w-3.5 h-3.5 text-[#2AABEE]" />
          </div>
          <input value={profile.telegram} onChange={e => set("telegram", e.target.value)} placeholder="@username"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
          </div>
          <input value={profile.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@username"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SERVICE FORM — add/edit
// ──────────────────────────────────────────────────────────────────────────────

function ServiceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ServiceItem;
  onSave: (s: ServiceItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ServiceCategory>(initial?.category ?? "soch");
  const [duration, setDuration] = useState(String(initial?.duration ?? 30));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");

  function handleSave() {
    if (!name.trim() || !price) return;
    onSave({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(),
      category,
      duration: parseInt(duration) || 30,
      price: parseInt(price) || 0,
      description,
      imageUrl: initial?.imageUrl,
      comboIds: initial?.comboIds,
      comboPrice: initial?.comboPrice,
    });
  }

  const cats: ServiceCategory[] = ["soch", "soqol", "bolalar", "vip"];
  const catLabels: Record<ServiceCategory, string> = { soch: "Soch", soqol: "Soqol", bolalar: "Bolalar", vip: "VIP" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onCancel} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="font-bold text-foreground">{initial ? "Xizmatni tahrirlash" : "Yangi xizmat"}</h3>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Nomi *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Fade, Klassik, Soqol..."
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Kategoriya</label>
        <div className="grid grid-cols-4 gap-2">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all ${category === c ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
              {catLabels[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Davomiyligi (min)</label>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="30"
            className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Narxi (so'm) *</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="80000"
            className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Tavsif (ixtiyoriy)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Qisqa tavsif..."
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50 resize-none" />
      </div>
      <button onClick={handleSave} disabled={!name.trim() || !price}
        className="w-full h-12 rounded-2xl bg-primary text-black font-bold text-sm disabled:opacity-40">
        {initial ? "Saqlash" : "Qo'shish"}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// XIZMATLAR TAB — edit mode
// ──────────────────────────────────────────────────────────────────────────────

function XizmatlarTab({ services, onChange }: { services: ServiceItem[]; onChange: (s: ServiceItem[]) => void }) {
  const [activeCat, setActiveCat] = useState<ServiceCategory | "all">("all");
  const [addingOrEditing, setAddingOrEditing] = useState<"new" | string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);
  const detail = detailId ? services.find(s => s.id === detailId) : null;

  function handleSave(item: ServiceItem) {
    const exists = services.find(s => s.id === item.id);
    onChange(exists ? services.map(s => s.id === item.id ? item : s) : [...services, item]);
    setAddingOrEditing(null);
  }

  function handleDelete(id: string) {
    onChange(services.filter(s => s.id !== id));
    setDetailId(null);
  }

  if (addingOrEditing !== null) {
    const editing = addingOrEditing !== "new" ? services.find(s => s.id === addingOrEditing) : undefined;
    return <ServiceForm initial={editing} onSave={handleSave} onCancel={() => setAddingOrEditing(null)} />;
  }

  return (
    <div className="pb-8">
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id as ServiceCategory | "all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeCat === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="space-y-3 mb-4">
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ delay: i * 0.04 }}>
              <div className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xl shrink-0">
                  {s.category === "soch" ? "✂️" : s.category === "soqol" ? "🪒" : s.category === "bolalar" ? "👦" : "💎"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                    {s.comboIds && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">COMBO</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDur(s.duration)} · {formatPrice(s.price)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setAddingOrEditing(s.id)}
                    className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s.id)}
                    className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
            <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Bu kategoriyada xizmat yo'q</p>
          </div>
        )}
      </div>

      <button onClick={() => setAddingOrEditing("new")}
        className="w-full h-12 rounded-2xl border border-dashed border-white/15 text-muted-foreground hover:text-foreground hover:border-white/25 transition-all flex items-center justify-center gap-2 text-sm font-semibold">
        <Plus className="w-4 h-4" /> Xizmat qo'shish
      </button>

      {/* Service detail sheet */}
      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailId(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-2xl">
                  {detail.category === "soch" ? "✂️" : detail.category === "soqol" ? "🪒" : detail.category === "bolalar" ? "👦" : "💎"}
                </div>
                <div className="flex-1"><p className="font-bold text-foreground">{detail.name}</p><p className="text-xs text-muted-foreground">{formatDur(detail.duration)} · {formatPrice(detail.price)}</p></div>
                <button onClick={() => setDetailId(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
              {detail.description && <p className="text-sm text-muted-foreground mb-4">{detail.description}</p>}
              {detail.comboIds && <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2 mb-4"><p className="text-xs text-emerald-400">🎉 Combo narxi: {formatPrice(detail.price)} (oddiy: {formatPrice((detail.comboPrice ?? detail.price) + 20000)})</p></div>}
              <p className="text-xs text-muted-foreground/60 text-center mb-4">Iltimos, 5 daqiqa oldin keling</p>
              <div className="flex gap-2">
                <button onClick={() => { setDetailId(null); setAddingOrEditing(detail.id); }}
                  className="flex-1 h-10 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold flex items-center justify-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Tahrirlash</button>
                <button onClick={() => handleDelete(detail.id)}
                  className="flex-1 h-10 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm font-semibold text-destructive flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> O'chirish</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// QR & LINK TAB
// ──────────────────────────────────────────────────────────────────────────────

function QRLinkTab({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState(username);
  const [editingSlug, setEditingSlug] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const pageUrl = `https://barber.uz/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(pageUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function handleShare() {
    if (navigator.share) { navigator.share({ title: slug, url: pageUrl }).catch(() => {}); } else { handleCopy(); }
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
      const a = document.createElement("a"); a.download = `${slug}-qr.png`; a.href = canvas.toDataURL("image/png"); a.click();
    };
    img.src = url;
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Link */}
      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sahifa manzili</p>
        <div className="flex items-center gap-2 bg-background/60 border border-white/8 rounded-xl px-3 py-2 mb-3">
          <span className="text-xs text-muted-foreground">barber.uz/</span>
          {editingSlug
            ? <input autoFocus value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                onBlur={() => setEditingSlug(false)} onKeyDown={e => e.key === "Enter" && setEditingSlug(false)}
                className="flex-1 bg-transparent text-sm text-primary font-mono outline-none" />
            : <span className="flex-1 text-sm text-primary font-mono">{slug}</span>
          }
          <button onClick={() => setEditingSlug(true)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleCopy}
            className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${copied ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" : "bg-white/5 border-white/8 text-muted-foreground hover:text-foreground"}`}>
            {copied ? <><Check className="w-3.5 h-3.5" /> Nusxalandi</> : <><Copy className="w-3.5 h-3.5" /> Nusxalash</>}
          </button>
          <button onClick={handleDownload}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/5 border border-white/8 text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-3.5 h-3.5" /> Yuklab olish
          </button>
          <button onClick={handleShare}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/5 border border-white/8 text-muted-foreground hover:text-foreground transition-all">
            <Share2 className="w-3.5 h-3.5" /> Ulashish
          </button>
        </div>
      </div>

      {/* QR */}
      <div className="bg-card border border-white/6 rounded-2xl p-5 flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">QR kod</p>
        <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-lg shadow-black/20 mb-4">
          <QRCode value={pageUrl} size={180} fgColor="#000000" bgColor="#ffffff" level="M" />
        </div>
        <a href={pageUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> {pageUrl}
        </a>
      </div>

      {/* Simple analytics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold font-display text-primary">24</p>
          <p className="text-xs text-muted-foreground mt-0.5">QR skanerlashlar</p>
        </div>
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold font-display text-emerald-400">8</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bronlar (bu oy)</p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// BOOKING MODAL — used inside customer preview
// ──────────────────────────────────────────────────────────────────────────────

type BookingStep = "time" | "info" | "done";
type DateOpt = "today" | "tomorrow" | "custom";

function BookingModal({
  selectedServices,
  totalDuration,
  isTeam,
  onClose,
}: {
  selectedServices: ServiceItem[];
  totalDuration: number;
  isTeam: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<BookingStep>("time");
  const [dateOpt, setDateOpt] = useState<DateOpt>("today");
  const [selectedBarber, setSelectedBarber] = useState<string | null>(isTeam ? null : "solo");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+998 ");

  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);

  function getBusy(barberId: string) {
    if (!isTeam) return SOLO_BUSY;
    return TEAM_BARBERS.find(b => b.id === barberId)?.busy ?? [];
  }

  const barberSlots = isTeam
    ? TEAM_BARBERS.map(b => ({ barber: b, slots: generateSlots(totalDuration, b.busy) }))
    : [{ barber: null, slots: generateSlots(totalDuration, SOLO_BUSY) }];

  const anyBarberSlots = isTeam ? generateSlots(totalDuration, []) : [];

  function handleConfirm() {
    if (!clientName.trim()) return;
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {/* Header */}
          <div className="flex items-center gap-3 py-4">
            {step !== "time" && step !== "done" && (
              <button onClick={() => setStep("time")} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
            )}
            {step === "done" ? null : <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>}
          </div>

          {/* Selected services summary */}
          {step !== "done" && (
            <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 mb-5">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedServices.map(s => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{s.name}</span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDur(totalDuration)}</span>
                <span className="text-sm font-bold text-primary">{formatPrice(totalPrice)}</span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP: TIME */}
            {step === "time" && (
              <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-bold mb-4">Vaqt tanlash</h2>

                {/* Date switcher */}
                <div className="flex gap-2 mb-5">
                  {(["today", "tomorrow"] as DateOpt[]).map(d => (
                    <button key={d} onClick={() => setDateOpt(d)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${dateOpt === d ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                      {d === "today" ? "Bugun" : "Ertaga"}
                    </button>
                  ))}
                  <button onClick={() => setDateOpt("custom")}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${dateOpt === "custom" ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                    📅 Sana
                  </button>
                </div>

                {isTeam ? (
                  <div className="space-y-4">
                    {/* Any barber */}
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-base">👥</div>
                        <div><p className="text-sm font-semibold text-foreground">Istalgan barber</p><p className="text-xs text-muted-foreground">Birinchi bo'sh usta</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generateSlots(totalDuration, SOLO_BUSY.slice(0, 2)).map(slot => (
                          <button key={slot} onClick={() => { setSelectedBarber("any"); setSelectedTime(slot); }}
                            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${selectedBarber === "any" && selectedTime === slot ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Individual barbers */}
                    {barberSlots.map(({ barber, slots }) => barber && (
                      <div key={barber.id} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BarbAvatar barber={barber} />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold">{barber.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${DARAJA_CLS[barber.daraja]}`}>{DARAJA_LABEL[barber.daraja]}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{barber.speciality.join(" · ")}</p>
                          </div>
                        </div>
                        {slots.length === 0
                          ? <p className="text-xs text-muted-foreground/60">Bo'sh vaqt yo'q</p>
                          : <div className="flex flex-wrap gap-2">
                              {slots.slice(0, 6).map(slot => (
                                <button key={slot} onClick={() => { setSelectedBarber(barber.id); setSelectedTime(slot); }}
                                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${selectedBarber === barber.id && selectedTime === slot ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"}`}>
                                  {slot}
                                </button>
                              ))}
                            </div>
                        }
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Solo mode: just time slots */
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3">Bugun bo'sh vaqtlar:</p>
                    {barberSlots[0].slots.length === 0
                      ? <div className="text-center py-8 text-muted-foreground text-sm">Bo'sh vaqt yo'q 😔</div>
                      : <div className="flex flex-wrap gap-2">
                          {barberSlots[0].slots.map(slot => (
                            <button key={slot} onClick={() => { setSelectedTime(slot); }}
                              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedTime === slot ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 bg-background/40 text-muted-foreground hover:bg-white/5"}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                    }
                  </div>
                )}

                <button
                  onClick={() => selectedTime && setStep("info")}
                  disabled={!selectedTime}
                  className="w-full h-13 py-3.5 rounded-2xl bg-primary text-black font-bold mt-6 disabled:opacity-40">
                  Davom etish →
                </button>
              </motion.div>
            )}

            {/* STEP: INFO */}
            {step === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-bold mb-1">Ma'lumotlaringiz</h2>
                <p className="text-sm text-muted-foreground mb-5">Ma'lumotlarni telegram bot orqali tasdiqlaymiz</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-muted-foreground">Ism *</label>
                    <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Sardor"
                      className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-muted-foreground">Telefon (+998)</label>
                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} inputMode="tel"
                      className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                  <div className="bg-[#2AABEE]/8 border border-[#2AABEE]/20 rounded-2xl px-4 py-3">
                    <p className="text-xs text-[#2AABEE]/80">Telegram bot bron ma'lumotlarini tasdiqlaydi va eslatma yuboradi</p>
                  </div>
                  <button onClick={handleConfirm} disabled={!clientName.trim()}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                    <Send className="w-4 h-4" /> Botni ochish
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP: DONE */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
                <h2 className="text-xl font-bold mb-2">Bron tasdiqlandi!</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedTime && <><span className="text-foreground font-semibold">{dateOpt === "today" ? "Bugun" : "Ertaga"}, soat {selectedTime}</span><br /></>}
                  {isTeam && selectedBarber && selectedBarber !== "any" && <><span className="text-foreground font-semibold">{TEAM_BARBERS.find(b => b.id === selectedBarber)?.name}</span> bilan<br /></>}
                </p>
                <p className="text-sm text-muted-foreground mb-6">Telegram bot orqali tasdiqlash kuting</p>
                <button onClick={onClose} className="w-full h-12 rounded-2xl bg-primary text-black font-bold">Yopish</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOMER VIEW — preview mode
// ──────────────────────────────────────────────────────────────────────────────

function CustomerView({
  profile,
  services,
  isTeam,
}: {
  profile: ProfileData;
  services: ServiceItem[];
  isTeam: boolean;
}) {
  const [activeCat, setActiveCat] = useState<ServiceCategory | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailSvc, setDetailSvc] = useState<ServiceItem | null>(null);

  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);
  const selectedServices = services.filter(s => selectedIds.includes(s.id));

  function calcTotal() {
    let dur = 0, price = 0;
    selectedServices.forEach(s => { dur += s.duration; price += s.price; });
    // Check for combo discount
    services.filter(s => s.comboIds).forEach(combo => {
      if (combo.comboIds!.every(id => selectedIds.includes(id)) && combo.comboPrice) {
        const origPrice = combo.comboIds!.reduce((acc, id) => acc + (services.find(s => s.id === id)?.price ?? 0), 0);
        price -= (origPrice - combo.comboPrice);
      }
    });
    return { dur, price };
  }

  const { dur: totalDur, price: totalPrice } = calcTotal();

  function toggleService(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const COVER_COLORS = ["from-primary/30 via-primary/10 to-background", "from-amber-500/25 via-amber-500/8 to-background", "from-emerald-500/25 via-emerald-500/8 to-background"];

  return (
    <div className="pb-32">
      {/* Cover + header */}
      <div className="relative">
        <div className={`w-full h-36 bg-gradient-to-b ${profile.coverImage ? "" : COVER_COLORS[profile.name.charCodeAt(0) % COVER_COLORS.length]} overflow-hidden`}>
          {profile.coverImage && <img src={profile.coverImage} className="w-full h-full object-cover" />}
        </div>
        <div className="px-4 -mt-8">
          <div className="w-16 h-16 rounded-2xl border-2 border-background overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center font-bold text-2xl text-primary uppercase mb-3">
            {profile.profileImage ? <img src={profile.profileImage} className="w-full h-full object-cover" /> : profile.name.charAt(0)}
          </div>
          <h1 className="text-xl font-display font-bold text-foreground mb-1">{profile.name}</h1>
          {profile.bio && <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{profile.bio}</p>}
          {profile.speciality.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {profile.speciality.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">{s}</span>
              ))}
            </div>
          )}
          {/* Info pills */}
          <div className="flex flex-wrap gap-2 mb-2">
            {profile.address && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {profile.address}
              </div>
            )}
            {profile.workDays && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {profile.workDays}, {profile.workStart}–{profile.workEnd}
              </div>
            )}
          </div>
          {/* Social */}
          <div className="flex gap-2">
            {profile.telegram && (
              <a href={`https://t.me/${profile.telegram.replace("@", "")}`} className="flex items-center gap-1 text-xs text-[#2AABEE] hover:underline">
                <Send className="w-3 h-3" /> {profile.telegram}
              </a>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace("@", "")}`} className="flex items-center gap-1 text-xs text-pink-400 hover:underline">
                <Instagram className="w-3 h-3" /> {profile.instagram}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Team barbers */}
      {isTeam && (
        <div className="px-4 mt-5">
          <p className="text-sm font-semibold text-foreground mb-3">👷 Ustalar</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {TEAM_BARBERS.map(b => (
              <div key={b.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <BarbAvatar barber={b} />
                <p className="text-xs font-medium text-foreground">{b.name}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${DARAJA_CLS[b.daraja]}`}>{DARAJA_LABEL[b.daraja]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      <div className="px-4 mt-5">
        <p className="text-sm font-semibold text-foreground mb-3">💈 Xizmatlar</p>
        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.filter(c => c.id === "all" || services.some(s => s.category === c.id)).map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id as ServiceCategory | "all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeCat === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(s => {
            const isSelected = selectedIds.includes(s.id);
            return (
              <motion.div key={s.id} whileTap={{ scale: 0.99 }}>
                <div className={`bg-card border rounded-2xl p-4 flex items-center gap-3 transition-all cursor-pointer ${isSelected ? "border-primary/30 bg-primary/5" : "border-white/6"}`}
                  onClick={() => setDetailSvc(s)}>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-2xl shrink-0">
                    {s.category === "soch" ? "✂️" : s.category === "soqol" ? "🪒" : s.category === "bolalar" ? "👦" : "💎"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm text-foreground">{s.name}</p>
                      {s.comboIds && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">COMBO</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDur(s.duration)} · <span className="text-foreground font-medium">{formatPrice(s.price)}</span></p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    <button
                      onClick={e => { e.stopPropagation(); toggleService(s.id); }}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${isSelected ? "bg-primary text-black border-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-primary/40"}`}>
                      {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Sticky footer */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-white/8 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground">{selectedIds.length} ta xizmat · {formatDur(totalDur)}</p>
                <p className="text-base font-bold text-foreground">{formatPrice(totalPrice)}</p>
              </div>
              <button onClick={() => setBookingOpen(true)}
                className="h-11 px-6 rounded-2xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all">
                Bron qilish
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service detail sheet */}
      <AnimatePresence>
        {detailSvc && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailSvc(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="relative w-full max-w-md bg-card rounded-t-3xl z-10" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-5 pb-8 pt-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-3xl">{detailSvc.category === "soch" ? "✂️" : detailSvc.category === "soqol" ? "🪒" : detailSvc.category === "bolalar" ? "👦" : "💎"}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-foreground">{detailSvc.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatDur(detailSvc.duration)} · {formatPrice(detailSvc.price)}</p>
                  </div>
                  <button onClick={() => setDetailSvc(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                {detailSvc.description && <p className="text-sm text-muted-foreground mb-4">{detailSvc.description}</p>}
                {detailSvc.comboIds && <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2 mb-4"><p className="text-xs text-emerald-400">🎉 Combo narxi: tejashingiz {formatPrice(20000)}</p></div>}
                <p className="text-xs text-muted-foreground/60 text-center mb-4">ℹ️ Iltimos, 5 daqiqa oldin keling</p>
                <button
                  onClick={() => { toggleService(detailSvc.id); setDetailSvc(null); }}
                  className={`w-full h-12 rounded-2xl font-bold text-sm transition-all ${selectedIds.includes(detailSvc.id) ? "bg-white/8 border border-white/12 text-muted-foreground" : "bg-primary text-black hover:bg-primary/90"}`}>
                  {selectedIds.includes(detailSvc.id) ? "✓ Tanlangan" : "Ushbu xizmatni tanlash"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking modal */}
      <AnimatePresence>
        {bookingOpen && (
          <BookingModal
            selectedServices={selectedServices}
            totalDuration={totalDur}
            isTeam={isTeam}
            onClose={() => setBookingOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function PersonalPage() {
  const { user } = useAuth();
  const isTeam = user?.mode === "team";
  const username = user?.username || "barber";

  const [tab, setTab] = useState<Tab>("asosiy");
  const [preview, setPreview] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(DEMO_PROFILE);
  const [services, setServices] = useState<ServiceItem[]>(DEMO_SERVICES);

  const pageTitle = isTeam ? "🌐 Barbershop sahifasi" : "🌐 Mening sahifam";

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-lg font-display font-bold text-foreground flex-1 truncate">{pageTitle}</h1>
        <button
          onClick={() => setPreview(p => !p)}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-2xl text-xs font-semibold border transition-all shrink-0 ${preview ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/8 text-muted-foreground hover:text-foreground"}`}
        >
          <Eye className="w-3.5 h-3.5" /> Ko'rish
        </button>
      </div>

      {/* Preview banner */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
            <p className="text-xs text-amber-400 font-medium">👁 Ko'rish rejimi — mijoz qanday ko'radi</p>
            <button onClick={() => setPreview(false)} className="text-xs text-amber-400/70 hover:text-amber-400 font-semibold underline">
              Tahrirlashga qaytish
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {preview ? (
        /* PREVIEW MODE */
        <CustomerView profile={profile} services={services} isTeam={isTeam} />
      ) : (
        /* EDIT MODE */
        <>
          <TabBar tab={tab} onChange={setTab} isTeam={isTeam} />
          <AnimatePresence mode="wait">
            {tab === "asosiy" && (
              <motion.div key="asosiy" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <AsosiyTab profile={profile} onChange={setProfile} />
              </motion.div>
            )}
            {tab === "xizmatlar" && (
              <motion.div key="xizmatlar" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <XizmatlarTab services={services} onChange={setServices} />
              </motion.div>
            )}
            {tab === "qr" && (
              <motion.div key="qr" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <QRLinkTab username={username} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Layout>
  );
}
