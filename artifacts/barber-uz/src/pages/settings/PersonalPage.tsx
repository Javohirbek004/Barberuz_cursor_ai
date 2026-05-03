import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Copy, Check, Download, Share2, Eye,
  Plus, X, Pencil, Trash2, Clock, MapPin,
  Instagram, Camera, ArrowLeft, ExternalLink, Send, Tag,
  Navigation,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type Tab = "asosiy" | "xizmatlar" | "qr";
type ServiceCategory = string;

export interface ProfileData {
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

export interface ServiceItem {
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

const DEFAULT_CATS: { id: string; label: string }[] = [
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
    price: 100000, description: "Combo: Fade + Soqol. Tejaladi: 20 000 so'm.",
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
    id: "jamshid", name: "Jamshid", daraja: "oddiy", speciality: ["Klassik", "Bolalar"],
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
  return n.toLocaleString("uz-UZ") + " so'm";
}
function formatPriceShort(n: number) {
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
  top: "bg-amber-500/20 text-amber-400",
  senior: "bg-red-500/15 text-red-400",
};

const BARBER_COLORS = [
  "from-primary/40 to-primary/15 text-primary",
  "from-amber-500/40 to-amber-500/15 text-amber-400",
  "from-emerald-500/40 to-emerald-500/15 text-emerald-400",
  "from-violet-500/40 to-violet-500/15 text-violet-400",
];

function BarbAvatar({ barber, size = "md" }: { barber: BarberSlot; size?: "sm" | "md" | "lg" }) {
  const c = BARBER_COLORS[barber.name.charCodeAt(0) % BARBER_COLORS.length];
  const sz = size === "sm" ? "w-10 h-10 text-base" : size === "lg" ? "w-16 h-16 text-2xl" : "w-12 h-12 text-lg";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br border-2 border-white/15 flex items-center justify-center font-bold uppercase shrink-0 ${c}`}>
      {barber.name.charAt(0)}
    </div>
  );
}

function catEmoji(cat: string) {
  if (cat === "soch") return "✂️";
  if (cat === "soqol") return "🪒";
  if (cat === "bolalar") return "👦";
  if (cat === "vip") return "💎";
  return "💈";
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
    if (!tag || profile.speciality.length >= 6) return;
    onChange({ ...profile, speciality: [...profile.speciality, tag] });
    setNewTag("");
  }

  function removeTag(i: number) {
    onChange({ ...profile, speciality: profile.speciality.filter((_, idx) => idx !== i) });
  }

  const field = (label: string, key: keyof ProfileData, placeholder?: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        value={profile[key] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Cover + Avatar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rasmlar</label>
        <div className="relative">
          <div
            className="w-full h-28 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-white/8 flex items-center justify-center cursor-pointer hover:from-primary/35 transition-all relative overflow-hidden"
            onClick={() => coverRef.current?.click()}
          >
            {profile.coverImage
              ? <img src={profile.coverImage} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-1 text-muted-foreground/40"><Camera className="w-5 h-5" /><span className="text-xs">Muqova rasmi</span></div>
            }
          </div>
          <div
            className="absolute -bottom-6 left-4 w-16 h-16 rounded-full border-[3px] border-background cursor-pointer shadow-lg"
            onClick={() => imgRef.current?.click()}
          >
            {profile.profileImage
              ? <img src={profile.profileImage} className="w-full h-full rounded-full object-cover" />
              : <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/40 to-primary/15 border border-white/10 flex items-center justify-center font-bold text-2xl text-primary uppercase">{profile.name.charAt(0) || "?"}</div>
            }
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md"><Camera className="w-2.5 h-2.5 text-black" /></div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/40 text-center pt-7">Profil va muqova rasmlarini yuklash uchun bosing</p>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage("profileImage", e)} />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage("coverImage", e)} />
      </div>

      {field("Ism / Nom *", "name", "Sardor Barber")}

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tavsif (Bio)</label>
        <textarea
          value={profile.bio}
          onChange={e => set("bio", e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="O'zingiz yoki saloningiz haqida qisqa tavsif..."
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <p className="text-xs text-muted-foreground/40 text-right">{profile.bio.length} / 200</p>
      </div>

      {/* Speciality tags */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mutaxassislik teglari</label>
        <div className="flex flex-wrap gap-2">
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
            placeholder="+ Yangi teg"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
          <button onClick={addTag} className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {field("Telefon (faqat admin ko'radi)", "phone", "+998 90 123 45 67")}

      {/* Address */}
      <div className="space-y-2">
        {field("Manzil", "address", "Toshkent, Chilonzor, 14-uy")}
        <div className="flex gap-2">
          <input
            value={profile.mapLink}
            onChange={e => set("mapLink", e.target.value)}
            placeholder="Google Maps havolasi"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-xs focus:outline-none focus:border-primary/50 text-muted-foreground"
          />
          {profile.mapLink && (
            <a href={profile.mapLink} target="_blank" rel="noopener noreferrer"
              className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center text-xs font-semibold gap-1.5 hover:bg-primary/20 transition-colors shrink-0">
              <Navigation className="w-3.5 h-3.5" /> Ko'rish
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
            <p className="text-xs text-muted-foreground">Soat</p>
            <div className="flex items-center gap-1">
              <input value={profile.workStart} onChange={e => set("workStart", e.target.value)} placeholder="09:00"
                className="w-full h-10 px-2 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
              <span className="text-muted-foreground text-xs shrink-0">—</span>
              <input value={profile.workEnd} onChange={e => set("workEnd", e.target.value)} placeholder="20:00"
                className="w-full h-10 px-2 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Tushlik vaqti (ixtiyoriy)</p>
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
          <div className="w-9 h-9 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-[#2AABEE]" />
          </div>
          <input value={profile.telegram} onChange={e => set("telegram", e.target.value)} placeholder="@username"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/20 flex items-center justify-center shrink-0">
            <Instagram className="w-4 h-4 text-pink-400" />
          </div>
          <input value={profile.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@username"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SERVICE FORM
// ──────────────────────────────────────────────────────────────────────────────

function ServiceForm({
  initial,
  customCats,
  onSave,
  onCancel,
}: {
  initial?: ServiceItem;
  customCats: string[];
  onSave: (s: ServiceItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "soch");
  const [duration, setDuration] = useState(String(initial?.duration ?? 30));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");

  const allCats = ["soch", "soqol", "bolalar", "vip", ...customCats];
  const catLabels: Record<string, string> = { soch: "Soch", soqol: "Soqol", bolalar: "Bolalar", vip: "VIP" };

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

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="font-bold text-foreground">{initial ? "Xizmatni tahrirlash" : "Yangi xizmat"}</h3>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Nomi *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Fade, Klassik, Soqol..."
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Kategoriya</label>
        <div className="flex flex-wrap gap-2">
          {allCats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${category === c ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
              {catLabels[c] ?? c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Davomiylik (min)</label>
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

function XizmatlarTab({
  services,
  customCats,
  onChange,
  onAddCat,
}: {
  services: ServiceItem[];
  customCats: string[];
  onChange: (s: ServiceItem[]) => void;
  onAddCat: (c: string) => void;
}) {
  const [activeCat, setActiveCat] = useState<string>("all");
  const [addingOrEditing, setAddingOrEditing] = useState<"new" | string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const allCats = [
    ...DEFAULT_CATS,
    ...customCats.map(c => ({ id: c, label: c })),
  ];

  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);

  function handleSave(item: ServiceItem) {
    const exists = services.find(s => s.id === item.id);
    onChange(exists ? services.map(s => s.id === item.id ? item : s) : [...services, item]);
    setAddingOrEditing(null);
  }

  function handleDelete(id: string) {
    onChange(services.filter(s => s.id !== id));
  }

  function handleAddCat() {
    const cat = newCat.trim();
    if (!cat || customCats.includes(cat)) { setShowNewCat(false); setNewCat(""); return; }
    onAddCat(cat);
    setShowNewCat(false);
    setNewCat("");
  }

  if (addingOrEditing !== null) {
    const editing = addingOrEditing !== "new" ? services.find(s => s.id === addingOrEditing) : undefined;
    return <ServiceForm customCats={customCats} initial={editing} onSave={handleSave} onCancel={() => setAddingOrEditing(null)} />;
  }

  return (
    <div className="pb-10">
      {/* Category filter with "+ Yangi" */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {allCats.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeCat === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
            {c.label}
          </button>
        ))}
        {showNewCat ? (
          <div className="flex items-center gap-1 shrink-0">
            <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCat()}
              placeholder="Kategoriya nomi" className="h-8 px-2 w-28 rounded-full text-xs bg-white/5 border border-white/15 focus:outline-none focus:border-primary/50" />
            <button onClick={handleAddCat} className="h-8 w-8 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setShowNewCat(false); setNewCat(""); }} className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setShowNewCat(true)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30 transition-all flex items-center gap-1">
            <Plus className="w-3 h-3" /> Yangi
          </button>
        )}
      </div>

      {/* Service list */}
      <div className="space-y-2.5 mb-4">
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ delay: i * 0.03 }}>
              <div className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3 hover:border-white/10 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xl shrink-0">
                  {catEmoji(s.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                    {s.comboIds && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">COMBO</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDur(s.duration)} · <span className="text-foreground/70">{formatPriceShort(s.price)} so'm</span></p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setAddingOrEditing(s.id)}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s.id)}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 border border-dashed border-white/8 rounded-2xl">
            <Tag className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Bu kategoriyada xizmat yo'q</p>
          </div>
        )}
      </div>

      <button onClick={() => setAddingOrEditing("new")}
        className="w-full h-12 rounded-2xl border border-dashed border-white/15 text-muted-foreground hover:text-foreground hover:border-white/25 hover:bg-white/3 transition-all flex items-center justify-center gap-2 text-sm font-semibold">
        <Plus className="w-4 h-4" /> Xizmat qo'shish
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// QR & LINK TAB
// ──────────────────────────────────────────────────────────────────────────────

type SlugModalStep = "edit" | "confirm";

function SlugEditModal({
  currentSlug,
  onClose,
  onSaved,
}: {
  currentSlug: string;
  onClose: () => void;
  onSaved: (newSlug: string) => void;
}) {
  const [step, setStep] = useState<SlugModalStep>("edit");
  const [draft, setDraft] = useState(currentSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function cleanSlug(raw: string) {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleInputChange(val: string) {
    setDraft(cleanSlug(val));
    setError("");
  }

  function validate() {
    if (draft.length < 3 || draft.length > 30) {
      setError("Uzunlik: 3 dan 30 ta belgigacha");
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(draft)) {
      setError("Faqat kichik harf, raqam va '-' ishlatish mumkin");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("barber_token");
      const res = await fetch("/api/settings/slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ slug: draft }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError("Linkni hozir o'zgartira olmaysiz. Keyinroq urinib ko'ring.");
        setStep("edit");
      } else if (res.status === 409) {
        setError("Bu slug allaqachon band. Boshqa nom tanlang.");
        setStep("edit");
      } else if (!res.ok) {
        setError(data?.message || "Xatolik yuz berdi");
        setStep("edit");
      } else {
        const newSlug = data.username ?? draft;
        // Patch localStorage so same-session navigation shows the updated slug
        // without waiting for the next /api/auth/me refetch
        try {
          const raw = localStorage.getItem("barber_user");
          if (raw) {
            const cached = JSON.parse(raw);
            cached.username = newSlug;
            localStorage.setItem("barber_user", JSON.stringify(cached));
          }
        } catch { /* non-critical */ }
        onSaved(newSlug);
      }
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
      setStep("edit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>

        {step === "edit" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-display font-bold text-foreground">Sahifa linkini tahrirlash</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-2">barber.uz/</p>
            <input
              autoFocus
              value={draft}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="slug"
              className="w-full bg-background/60 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-primary/50 transition-colors mb-1"
            />
            <p className="text-xs text-muted-foreground mb-3">Faqat kichik harf, raqam va '-' ishlatish mumkin</p>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 mb-3">{error}</p>
            )}

            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5">
              <p className="text-xs text-amber-400 font-semibold mb-1">⚠️ Diqqat:</p>
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Linkni o'zgartirsangiz, eski QR kodlar eski manzilga olib boradi, lekin tizim avtomatik yangi sahifaga yo'naltiradi. Tez-tez o'zgartirish tavsiya etilmaydi.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-white/6 border border-white/10 text-muted-foreground hover:text-foreground transition-all">
                Bekor qilish
              </button>
              <button
                onClick={() => { if (validate()) setStep("confirm"); }}
                disabled={draft === currentSlug || draft.length < 3}
                className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Saqlash
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <h2 className="text-base font-display font-bold text-foreground mb-2">Tasdiqlash</h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Linkni o'zgartirmoqchimisiz? Bu mijozlar uchun havolani o'zgartiradi.
            </p>
            <div className="bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-5 font-mono text-sm text-primary">
              barber.uz/{draft}
            </div>
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 mb-3">{error}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep("edit")} className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-white/6 border border-white/10 text-muted-foreground hover:text-foreground transition-all">
                Bekor qilish
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saqlanmoqda</>
                  : "Ha, o'zgartirish"
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QRLinkTab({ username }: { username: string }) {
  const [slug, setSlug] = useState(username);
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const pageUrl = `https://barber.uz/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShare() {
    const text = `Menga yozilish uchun:\n${pageUrl}`;
    if (navigator.share) {
      navigator.share({ title: slug, text, url: pageUrl }).catch(() => {});
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
      a.download = `barber-qr-${slug}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ── Link block ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sahifa manzili</p>
        <div className="flex items-center gap-2 bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-3">
          <span className="text-xs text-muted-foreground shrink-0">barber.uz/</span>
          <span className="flex-1 text-sm text-primary font-mono truncate">{slug}</span>
          <button
            onClick={() => setModalOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Linkni tahrirlash"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${copied ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" : "bg-white/5 border-white/8 text-muted-foreground hover:text-foreground"}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <button
            onClick={handleShare}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/8 bg-white/5 text-muted-foreground hover:text-foreground transition-all"
          >
            <Share2 className="w-3.5 h-3.5" /> Ulashish
          </button>
        </div>
      </div>

      {/* ── QR block ───────────────────────────────────────────────────────── */}
      <div className="bg-card border border-white/6 rounded-2xl p-5 flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">QR kod</p>
        <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-xl shadow-black/30 mb-3">
          <QRCode value={pageUrl} size={180} fgColor="#000000" bgColor="#ffffff" level="M" />
        </div>
        <p className="text-xs text-muted-foreground mb-4">📷 Mijozlar skaner qilib bron qilishi mumkin</p>
        <button
          onClick={handleDownload}
          className="h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/8 bg-white/5 text-muted-foreground hover:text-foreground transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Yuklab olish
        </button>
      </div>

      {/* ── Stats (placeholder) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold font-display text-primary mb-1">24</p>
          <p className="text-xs text-muted-foreground">QR skanerlashlar</p>
        </div>
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold font-display text-emerald-400 mb-1">8</p>
          <p className="text-xs text-muted-foreground">Bronlar (bu oy)</p>
        </div>
      </div>

      {/* ── Slug edit modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <SlugEditModal
            currentSlug={slug}
            onClose={() => setModalOpen(false)}
            onSaved={newSlug => { setSlug(newSlug); setModalOpen(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// BOOKING MODAL
// ──────────────────────────────────────────────────────────────────────────────

type BookingStep = "time" | "info" | "verifying" | "done";
type DateOpt = "today" | "tomorrow" | "custom";

interface TgCustomer { tgId: string; name: string; username: string | null }

function loadTgCustomer(): TgCustomer | null {
  try { return JSON.parse(localStorage.getItem("tg_customer") || "null"); } catch { return null; }
}
function saveTgCustomer(c: TgCustomer) {
  localStorage.setItem("tg_customer", JSON.stringify(c));
}

const API_BASE = "";

async function createBookingSession(payload: {
  barberId: string; barberName: string; barberAddress: string;
  mapLink: string; barberPageLink: string; isTeam: boolean;
  teamBarberName: string | null; services: { name: string; price: number; duration: number }[];
  totalPrice: number; totalDuration: number; date: string; time: string;
  tgCustomer?: TgCustomer;
}): Promise<{ sessionId: string; deepLink: string | null; status: string }> {
  const res = await fetch(`${API_BASE}/api/public/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Session creation failed");
  return res.json();
}

async function pollSession(sessionId: string): Promise<{ status: string; clientName?: string; clientTelegramId?: string; clientTelegramUsername?: string }> {
  const res = await fetch(`${API_BASE}/api/public/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Poll failed");
  return res.json();
}

function BookingModal({
  selectedServices,
  totalDuration,
  isTeam,
  barberId,
  profile,
  onClose,
}: {
  selectedServices: ServiceItem[];
  totalDuration: number;
  isTeam: boolean;
  barberId: string;
  profile: ProfileData;
  onClose: () => void;
}) {
  const [step, setStep] = useState<BookingStep>("time");
  const [dateOpt, setDateOpt] = useState<DateOpt>("today");
  const [selectedBarber, setSelectedBarber] = useState<string | null>(isTeam ? null : "solo");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+998 ");
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function getDateStr() {
    return dateOpt;
  }

  function getTeamBarberName() {
    if (!isTeam || !selectedBarber || selectedBarber === "any" || selectedBarber === "solo") return null;
    return TEAM_BARBERS.find(b => b.id === selectedBarber)?.name || null;
  }

  function getBarberPageLink() {
    const base = window.location.origin;
    return `${base}/barber-uz`;
  }

  async function handleBookingSubmit() {
    if (!clientName.trim() || !selectedTime || submitting) return;
    setSubmitting(true);

    try {
      const tgCustomer = loadTgCustomer();
      const services = selectedServices.map(s => ({ name: s.name, price: s.price, duration: s.duration }));
      const totalPrice = selectedServices.reduce((a, s) => a + s.price, 0);

      const payload = {
        barberId: barberId || "demo",
        barberName: profile.name,
        barberAddress: profile.address,
        mapLink: profile.mapLink,
        barberPageLink: getBarberPageLink(),
        isTeam,
        teamBarberName: getTeamBarberName(),
        services,
        totalPrice,
        totalDuration,
        date: getDateStr(),
        time: selectedTime,
        tgCustomer: tgCustomer || undefined,
      };

      const result = await createBookingSession(payload);

      if (result.status === "confirmed") {
        setStep("done");
        setSubmitting(false);
        return;
      }

      setSessionId(result.sessionId);

      if (result.deepLink) {
        window.open(result.deepLink, "_blank");
      }

      setStep("verifying");
      setSubmitting(false);

      pollingRef.current = setInterval(async () => {
        try {
          const poll = await pollSession(result.sessionId);
          if (poll.status === "confirmed") {
            stopPolling();
            if (poll.clientTelegramId) {
              saveTgCustomer({
                tgId: poll.clientTelegramId,
                name: poll.clientName || clientName,
                username: poll.clientTelegramUsername || null,
              });
            }
            setStep("done");
          } else if (poll.status === "expired") {
            stopPolling();
            setStep("info");
          }
        } catch {
        }
      }, 3000);
    } catch {
      setSubmitting(false);
    }
  }

  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const barberSlots = isTeam
    ? TEAM_BARBERS.map(b => ({ barber: b, slots: generateSlots(totalDuration, b.busy) }))
    : [{ barber: null, slots: generateSlots(totalDuration, SOLO_BUSY) }];

  const canProceed = selectedTime !== null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== "done" ? onClose : undefined} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0 border-b border-white/6">
          {step === "info" && (
            <button onClick={() => setStep("time")} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><ArrowLeft className="w-4 h-4" /></button>
          )}
          <div className="flex-1">
            {step === "time" && <h2 className="font-bold text-base">Vaqt tanlash</h2>}
            {step === "info" && <h2 className="font-bold text-base">Bronni tasdiqlash</h2>}
            {step === "verifying" && <h2 className="font-bold text-base text-[#2AABEE]">Telegram tasdiq...</h2>}
            {step === "done" && <h2 className="font-bold text-base text-emerald-400">Bron tasdiqlandi!</h2>}
          </div>
          {step !== "done" && (
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {/* Service summary */}
          {step !== "done" && (
            <div className="bg-primary/6 border border-primary/12 rounded-2xl px-4 py-3 mt-4 mb-5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {selectedServices.map(s => (
                  <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{s.name}</span>
                ))}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {formatDur(totalDuration)}</p>
                <p className="text-sm font-bold text-primary">{formatPriceShort(totalPrice)}k</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP: TIME */}
            {step === "time" && (
              <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Date */}
                <div className="flex gap-2 mb-5">
                  {(["today", "tomorrow"] as DateOpt[]).map(d => (
                    <button key={d} onClick={() => setDateOpt(d)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${dateOpt === d ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                      {d === "today" ? "📅 Bugun" : "📅 Ertaga"}
                    </button>
                  ))}
                  <button onClick={() => setDateOpt("custom")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${dateOpt === "custom" ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                    Boshqa
                  </button>
                </div>

                {isTeam ? (
                  <div className="space-y-4">
                    {/* Any barber option */}
                    <div className={`rounded-2xl border p-4 transition-all ${selectedBarber === "any" ? "border-primary/30 bg-primary/6" : "border-white/8 bg-white/3"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-xl shrink-0">👥</div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">Istalgan barber</p>
                          <p className="text-xs text-muted-foreground">Birinchi bo'sh usta qabul qiladi</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generateSlots(totalDuration, SOLO_BUSY.slice(0, 2)).map(slot => (
                          <button key={slot}
                            onClick={() => { setSelectedBarber("any"); setSelectedTime(slot); }}
                            className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${selectedBarber === "any" && selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8 hover:text-foreground"}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individual barbers */}
                    {barberSlots.map(({ barber, slots }) => barber && (
                      <div key={barber.id} className={`rounded-2xl border p-4 transition-all ${selectedBarber === barber.id ? "border-primary/30 bg-primary/6" : "border-white/8 bg-white/3"}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <BarbAvatar barber={barber} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold text-sm">{barber.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${DARAJA_CLS[barber.daraja]}`}>{DARAJA_LABEL[barber.daraja]}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{barber.speciality.join(" · ")}</p>
                          </div>
                        </div>
                        {slots.length === 0
                          ? <p className="text-xs text-muted-foreground/50 py-1">Bo'sh vaqt yo'q</p>
                          : <div className="flex flex-wrap gap-2">
                              {slots.slice(0, 8).map(slot => (
                                <button key={slot}
                                  onClick={() => { setSelectedBarber(barber.id); setSelectedTime(slot); }}
                                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${selectedBarber === barber.id && selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8 hover:text-foreground"}`}>
                                  {slot}
                                </button>
                              ))}
                            </div>
                        }
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3">Bo'sh vaqtlar:</p>
                    {barberSlots[0].slots.length === 0
                      ? <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl text-muted-foreground text-sm">Bu kun bo'sh vaqt yo'q 😔</div>
                      : <div className="flex flex-wrap gap-2">
                          {barberSlots[0].slots.map(slot => (
                            <button key={slot}
                              onClick={() => setSelectedTime(slot)}
                              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8 hover:text-foreground"}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                    }
                  </div>
                )}

                <button
                  onClick={() => canProceed && setStep("info")}
                  disabled={!canProceed}
                  className="w-full h-13 py-3.5 rounded-2xl bg-primary text-black font-bold text-base mt-6 disabled:opacity-30 transition-opacity shadow-lg shadow-primary/20">
                  Davom etish →
                </button>
              </motion.div>
            )}

            {/* STEP: INFO */}
            {step === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-5">Telegram bot bron ma'lumotlarini tasdiqlaydi</p>

                {/* Selected time reminder */}
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tanlangan vaqt</p>
                    <p className="text-sm font-bold text-foreground">{dateOpt === "today" ? "Bugun" : "Ertaga"}, soat {selectedTime}</p>
                    {isTeam && selectedBarber && selectedBarber !== "any" && (
                      <p className="text-xs text-primary">{TEAM_BARBERS.find(b => b.id === selectedBarber)?.name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-muted-foreground">Ismingiz *</label>
                    <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Sardor"
                      className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-muted-foreground">Telefon</label>
                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} inputMode="tel"
                      className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                  <div className="bg-[#2AABEE]/8 border border-[#2AABEE]/20 rounded-2xl px-4 py-3">
                    <p className="text-xs text-[#2AABEE]/80 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 shrink-0" /> Telegram bot bron tasdiqlaydi va eslatma yuboradi</p>
                  </div>
                  <button onClick={handleBookingSubmit} disabled={!clientName.trim() || submitting}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-30 text-sm">
                    {submitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Yuklanmoqda...</>
                      : <><Send className="w-4 h-4" /> Telegram orqali tasdiqlash</>
                    }
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP: VERIFYING */}
            {step === "verifying" && (
              <motion.div key="verifying" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <div className="w-20 h-20 rounded-3xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center text-4xl mx-auto mb-5">💬</div>
                <h2 className="text-lg font-bold mb-1">Telegram bot kutilmoqda</h2>
                <p className="text-sm text-muted-foreground mb-6">Telegram botda <b>✅ Tasdiqlash</b> tugmasini bosing</p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:0.4s]" />
                  <span className="ml-1">Tasdiq kutilmoqda</span>
                </div>
                {sessionId && (
                  <button
                    onClick={() => {
                      const botName = "Barberuz_yordamchi_bot";
                      window.open(`https://t.me/${botName}?start=booking_${sessionId}`, "_blank");
                    }}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 text-[#2AABEE] font-semibold text-sm flex items-center justify-center gap-2 mb-3">
                    <Send className="w-4 h-4" /> Telegram botni qayta ochish
                  </button>
                )}
                <button onClick={() => { stopPolling(); setStep("info"); }} className="text-xs text-muted-foreground underline">Bekor qilish</button>
              </motion.div>
            )}

            {/* STEP: DONE */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-24 h-24 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-5xl mx-auto mb-5">✅</div>
                <h2 className="text-xl font-bold mb-1">Bron qabul qilindi!</h2>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 my-5 text-left">
                  <p className="text-xs text-muted-foreground mb-1">Bron ma'lumotlari</p>
                  <p className="text-sm font-semibold text-foreground">{dateOpt === "today" ? "Bugun" : "Ertaga"}, soat {selectedTime}</p>
                  {isTeam && selectedBarber && selectedBarber !== "any" && (
                    <p className="text-xs text-primary mt-0.5">{TEAM_BARBERS.find(b => b.id === selectedBarber)?.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{selectedServices.map(s => s.name).join(", ")}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Telegram bot orqali tasdiqlash kuting</p>
                <button onClick={onClose} className="w-full h-12 rounded-2xl bg-primary text-black font-bold shadow-lg shadow-primary/20">Yopish</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOMER VIEW — full premium preview mode
// ──────────────────────────────────────────────────────────────────────────────

export function CustomerView({
  profile,
  services,
  isTeam,
  barberId,
}: {
  profile: ProfileData;
  services: ServiceItem[];
  isTeam: boolean;
  barberId: string;
}) {
  const [previewTab, setPreviewTab] = useState<"asosiy" | "xizmatlar">("asosiy");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailSvc, setDetailSvc] = useState<ServiceItem | null>(null);

  const visibleCats = ["all", ...Array.from(new Set(services.map(s => s.category)))];
  const catChips = DEFAULT_CATS.filter(c => visibleCats.includes(c.id));

  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);
  const selectedServices = services.filter(s => selectedIds.includes(s.id));

  function calcTotal() {
    let dur = 0, price = 0;
    selectedServices.forEach(s => { dur += s.duration; price += s.price; });
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

  const COVER_GRAD = [
    "from-primary/50 via-primary/20 to-transparent",
    "from-amber-600/50 via-amber-600/20 to-transparent",
    "from-emerald-600/50 via-emerald-600/20 to-transparent",
    "from-violet-600/50 via-violet-600/20 to-transparent",
  ];
  const gradIdx = profile.name.charCodeAt(0) % COVER_GRAD.length;

  return (
    <div className="pb-28 -mx-4">
      {/* ── Hero section ─────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="w-full h-52 relative overflow-hidden">
          {profile.coverImage
            ? <img src={profile.coverImage} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, #ffffff08 0, #ffffff08 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />
                <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRAD[gradIdx]}`} />
              </div>
          }
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="absolute bottom-0 left-4 translate-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-gradient-to-br from-primary/40 to-primary/15 flex items-center justify-center shadow-2xl shadow-black/40">
            {profile.profileImage
              ? <img src={profile.profileImage} className="w-full h-full object-cover" />
              : <span className="text-3xl font-bold text-primary uppercase">{profile.name.charAt(0)}</span>
            }
          </div>
        </div>
      </div>

      {/* ── Name + bio (always visible) ──────────────────────────────────── */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{profile.name}</h1>
        {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="px-4 mb-1">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          {(["asosiy", "xizmatlar"] as const).map(t => (
            <motion.button
              key={t}
              onClick={() => setPreviewTab(t)}
              whileTap={{ scale: 0.97 }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                previewTab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {previewTab === "asosiy" && (
          <motion.div
            key="asosiy"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-4 pt-4">
              {/* Speciality tags */}
              {profile.speciality.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.speciality.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-primary/12 border border-primary/20 text-xs text-primary font-medium">{s}</span>
                  ))}
                </div>
              )}

              {/* Work hours pill */}
              {profile.workDays && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 bg-white/5 border border-white/8 w-fit px-3 py-2 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                  <span>{profile.workDays} · {profile.workStart}–{profile.workEnd}</span>
                </div>
              )}

              {/* Map card */}
              {profile.address && (
                <a
                  href={profile.mapLink || "#"}
                  target={profile.mapLink ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  className="block bg-card border border-white/8 rounded-2xl overflow-hidden mb-4 hover:border-white/15 transition-colors"
                >
                  <div className="h-20 bg-zinc-900 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(#4af 1px, transparent 1px), linear-gradient(90deg, #4af 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-primary shadow-lg shadow-primary/50 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1">{profile.address}</span>
                    {profile.mapLink && <span className="text-xs text-primary font-semibold">Ko'rish →</span>}
                  </div>
                </a>
              )}

              {/* Social links */}
              {(profile.telegram || profile.instagram) && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground mb-2.5">Bizni ijtimoiy tarmoqlarda kuzating</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.telegram && (
                      <a href={`https://t.me/${profile.telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2AABEE]/10 border border-[#2AABEE]/25 text-[#2AABEE] text-sm font-medium hover:bg-[#2AABEE]/20 transition-colors">
                        <Send className="w-3.5 h-3.5" /> {profile.telegram}
                      </a>
                    )}
                    {profile.instagram && (
                      <a href={`https://instagram.com/${profile.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 text-pink-400 text-sm font-medium hover:from-pink-500/20 hover:to-violet-500/20 transition-colors">
                        <Instagram className="w-3.5 h-3.5" /> {profile.instagram}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Team barbers */}
            {isTeam && (
              <div className="px-4 mb-5">
                <p className="text-sm font-bold text-foreground mb-3">👷 Ustalar</p>
                <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                  {TEAM_BARBERS.map(b => (
                    <div key={b.id} className="flex flex-col items-center gap-2 shrink-0">
                      <BarbAvatar barber={b} size="lg" />
                      <p className="text-sm font-semibold text-foreground text-center">{b.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${DARAJA_CLS[b.daraja]}`}>{DARAJA_LABEL[b.daraja]}</span>
                      <p className="text-[10px] text-muted-foreground text-center max-w-16 leading-snug">{b.speciality[0]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {previewTab === "xizmatlar" && (
          <motion.div
            key="xizmatlar"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-4 pt-4">
              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                {catChips.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${activeCat === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"}`}>
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filtered.map(s => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <motion.div key={s.id} whileTap={{ scale: 0.985 }}>
                      <div
                        className={`bg-card border rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all ${isSelected ? "border-primary/40 bg-primary/6 shadow-sm shadow-primary/10" : "border-white/6 hover:border-white/12"}`}
                        onClick={() => setDetailSvc(s)}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${isSelected ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/8"}`}>
                          {catEmoji(s.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="font-semibold text-sm text-foreground">{s.name}</p>
                            {s.comboIds && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">COMBO</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span>{formatDur(s.duration)}</span>
                            <span className="mx-1">·</span>
                            <span className="text-foreground/80 font-medium">{formatPriceShort(s.price)} so'm</span>
                          </p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); toggleService(s.id); }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 ${isSelected ? "bg-primary text-black border-primary shadow-md shadow-primary/30" : "bg-white/5 border-white/12 text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
                          {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed bottom CTA (always visible) ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-md mx-auto px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-white/8">
          <AnimatePresence mode="wait">
            {selectedIds.length > 0 ? (
              <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{selectedIds.length} xizmat · {formatDur(totalDur)}</p>
                  <p className="text-base font-bold text-foreground">{formatPrice(totalPrice)}</p>
                </div>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-6 rounded-2xl bg-primary text-black font-bold text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all shrink-0">
                  Bron qilish →
                </button>
              </motion.div>
            ) : (
              <motion.div key="inactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => setPreviewTab("xizmatlar")}
                  className="w-full h-12 rounded-2xl bg-white/6 border border-white/8 text-muted-foreground font-semibold text-sm hover:bg-white/10 hover:text-foreground transition-all">
                  💈 Xizmat tanlash
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Service detail sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detailSvc && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailSvc(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="relative w-full max-w-md bg-card rounded-t-3xl z-10 border-t border-white/8" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-5 pb-10 pt-3">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-3xl shrink-0">{catEmoji(detailSvc.category)}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-foreground mb-0.5">{detailSvc.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatDur(detailSvc.duration)} · {formatPrice(detailSvc.price)}</p>
                    {detailSvc.comboIds && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 inline-block mt-1.5">COMBO CHEGIRMA</span>}
                  </div>
                  <button onClick={() => setDetailSvc(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                </div>
                {detailSvc.description && <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{detailSvc.description}</p>}
                {detailSvc.comboIds && (
                  <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl px-4 py-3 mb-4">
                    <p className="text-sm text-emerald-400 font-semibold">🎉 Combo narxi — {formatPriceShort(20000)} so'm tejaysiz!</p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">Fade + Soqolni birga tanlasangiz avtomatik chegirma qo'llanadi</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50 text-center mb-4">ℹ️ Iltimos, belgilangan vaqtdan 5 daqiqa oldin keling</p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { toggleService(detailSvc.id); setDetailSvc(null); }}
                  className={`w-full h-13 py-3.5 rounded-2xl font-bold text-base transition-all ${selectedIds.includes(detailSvc.id) ? "bg-white/6 border border-white/10 text-muted-foreground" : "bg-primary text-black shadow-xl shadow-primary/25 hover:bg-primary/90"}`}>
                  {selectedIds.includes(detailSvc.id) ? "✓ Tanlangan (bekor qilish)" : "Tanlash →"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Booking modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {bookingOpen && (
          <BookingModal
            selectedServices={selectedServices}
            totalDuration={totalDur}
            isTeam={isTeam}
            barberId={barberId}
            profile={profile}
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
  const [customCats, setCustomCats] = useState<string[]>([]);

  const pageTitle = isTeam ? "🌐 Barbershop sahifasi" : "🌐 Mening sahifam";

  const TABS: { id: Tab; label: string }[] = [
    { id: "asosiy", label: "Asosiy" },
    { id: "xizmatlar", label: "Xizmatlar" },
    { id: "qr", label: "QR & Link" },
  ];

  return (
    <Layout hideBottomNav>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
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
          <Eye className="w-3.5 h-3.5" />
          {preview ? "Tahrirlash" : "Ko'rish"}
        </button>
      </div>

      {preview ? (
        /* ── PREVIEW MODE ─────────────────────────────────────────────── */
        <>
          {/* Sticky preview banner */}
          <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 mb-0 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md flex items-center justify-between">
            <p className="text-xs text-amber-400 font-semibold">👁 Ko'rish rejimi — mijoz qanday ko'radi</p>
            <button onClick={() => setPreview(false)} className="text-xs text-amber-300 font-bold underline underline-offset-2">
              ← Tahrirlash
            </button>
          </div>
          <CustomerView profile={profile} services={services} isTeam={isTeam} barberId={user?.id || ""} />
        </>
      ) : (
        /* ── EDIT MODE ────────────────────────────────────────────────── */
        <>
          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 mb-4 bg-background/95 backdrop-blur-md border-b border-white/6">
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {tab === "asosiy" && (
              <motion.div key="asosiy" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <AsosiyTab profile={profile} onChange={setProfile} />
              </motion.div>
            )}
            {tab === "xizmatlar" && (
              <motion.div key="xizmatlar" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <XizmatlarTab
                  services={services}
                  customCats={customCats}
                  onChange={setServices}
                  onAddCat={c => setCustomCats(prev => [...prev, c])}
                />
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
