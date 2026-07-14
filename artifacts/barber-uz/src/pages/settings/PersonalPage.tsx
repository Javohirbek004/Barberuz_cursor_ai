import "leaflet/dist/leaflet.css";
import { useState, useRef, useEffect, useCallback } from "react";
import { APP_ORIGIN, APP_DISPLAY_HOST } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Copy, Check, Download, Share2, Eye,
  Plus, X, Pencil, Trash2, Clock, MapPin,
  Instagram, Camera, ArrowLeft, ExternalLink, Send, Tag,
  Navigation, Save, Phone,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type Tab = "asosiy" | "xizmatlar" | "qr";

export interface ProfileData {
  name: string;
  brandName: string;
  bio: string;
  speciality: string[];
  phone: string;        // read-only (from registration)
  phoneVisible: boolean;
  address: string;
  mapLink: string;
  latitude: string;
  longitude: string;
  workDays: string[];   // ["mon","tue",...] — stored in scheduleJson
  workStart: string;
  workEnd: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  telegram: string;     // read-only (from Telegram verification)
  instagram: string;
  avatarUrl: string;
  galleryImages: string[];
}

export interface ServiceItem {
  id: string;
  category: string;
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
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const DAYS = [
  { key: "mon", label: "Du" },
  { key: "tue", label: "Se" },
  { key: "wed", label: "Ch" },
  { key: "thu", label: "Pa" },
  { key: "fri", label: "Ju" },
  { key: "sat", label: "Sh" },
  { key: "sun", label: "Ya" },
];

const DEFAULT_CATS: { id: string; label: string }[] = [
  { id: "all", label: "Hammasi" },
  { id: "soch", label: "✂️ Soch" },
  { id: "soqol", label: "🪒 Soqol" },
  { id: "bolalar", label: "👦 Bolalar" },
  { id: "vip", label: "💎 VIP" },
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
  { start: "09:30", duration: 45 }, { start: "11:00", duration: 30 },
  { start: "14:00", duration: 60 }, { start: "17:30", duration: 45 },
];

const EMPTY_PROFILE: ProfileData = {
  name: "", brandName: "", bio: "", speciality: [],
  phone: "", phoneVisible: true, address: "", mapLink: "", latitude: "", longitude: "",
  workDays: [], workStart: "09:00", workEnd: "20:00",
  lunchEnabled: false, lunchStart: "13:00", lunchEnd: "14:00",
  telegram: "", instagram: "", avatarUrl: "", galleryImages: [],
};

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
function formatPrice(n: number) { return n.toLocaleString("uz-UZ") + " so'm"; }
function formatPriceShort(n: number) { return n >= 1000 ? (n / 1000).toFixed(0) + "k" : String(n); }

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

function getToken() { return localStorage.getItem("barber_token") || ""; }

async function apiGet(path: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}
async function apiPut(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}
async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}
async function apiDelete(path: string) {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

function apiToProfile(api: Record<string, unknown>): ProfileData {
  let galleryImages: string[] = [];
  try { galleryImages = JSON.parse((api.galleryImages as string) || "[]"); } catch {}
  let speciality: string[] = [];
  try { speciality = ((api.specializations as string) || "").split(",").map((s: string) => s.trim()).filter(Boolean); } catch {}
  let workDays: string[] = [];
  try { workDays = JSON.parse((api.scheduleJson as string) || "{}").workDays || []; } catch {}
  return {
    name: (api.name as string) || "",
    brandName: (api.brandName as string) || "",
    bio: (api.bio as string) || "",
    speciality,
    phone: (api.phone as string) || "",
    phoneVisible: api.phoneVisible !== false,
    address: (api.address as string) || "",
    mapLink: (api.mapLink as string) || "",
    latitude: (api.latitude as string) || "",
    longitude: (api.longitude as string) || "",
    workDays,
    workStart: (api.workingHoursStart as string) || "09:00",
    workEnd: (api.workingHoursEnd as string) || "20:00",
    lunchEnabled: !!(api.lunchBreakEnabled),
    lunchStart: (api.lunchBreakStart as string) || "13:00",
    lunchEnd: (api.lunchBreakEnd as string) || "14:00",
    telegram: (api.telegramUsername as string) || "",
    instagram: (api.instagram as string) || "",
    avatarUrl: (api.avatarUrl as string) || "",
    galleryImages,
  };
}

function safeUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function profileToApi(p: ProfileData) {
  return {
    name: p.name,
    brandName: p.brandName || null,
    bio: p.bio,
    specializations: p.speciality.join(", "),
    workingHoursStart: p.workStart,
    workingHoursEnd: p.workEnd,
    lunchBreakEnabled: p.lunchEnabled,
    lunchBreakStart: p.lunchStart,
    lunchBreakEnd: p.lunchEnd,
    scheduleJson: JSON.stringify({ workDays: p.workDays }),
    address: p.address,
    mapLink: safeUrl(p.mapLink) ?? "",
    latitude: p.latitude || null,
    longitude: p.longitude || null,
    phoneVisible: p.phoneVisible,
    instagram: p.instagram.replace(/^@+/, ""),
    avatarUrl: p.avatarUrl,
    galleryImages: JSON.stringify(p.galleryImages),
  };
}

function apiToService(s: Record<string, unknown>): ServiceItem {
  return {
    id: s.id as string,
    name: s.name as string,
    category: (s.nameRu as string) || "soch",
    duration: s.duration as number,
    price: Number(s.price),
    description: "",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GALLERY STRIP EDIT — page-level, always visible above tabs
// ──────────────────────────────────────────────────────────────────────────────

function GalleryStripEdit({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || images.length >= 5) return;
    const reader = new FileReader();
    reader.onload = ev => onChange([...images, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between px-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Galereya (1–5 rasm)
        </span>
        <span className="text-xs text-muted-foreground/50">{images.length}/5</span>
      </div>

      {images.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-28 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-white/30 hover:text-foreground transition-all"
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs">Rasm qo'shish</span>
          <span className="text-[10px] text-muted-foreground/40">Birinchi rasm muqova bo'ladi</span>
        </button>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2.5 pb-1">
            {images.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <div className="w-36 h-28 rounded-2xl overflow-hidden border border-white/12">
                  <img src={src} className="w-full h-full object-cover" alt="" />
                </div>
                <button
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                {i === 0 && (
                  <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-primary/80 text-black text-[9px] font-bold rounded-full">
                    Muqova
                  </div>
                )}
              </div>
            ))}
            {images.length < 5 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="shrink-0 w-28 h-28 rounded-2xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-white/40 hover:text-foreground transition-all"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[10px]">+ Rasm</span>
              </button>
            )}
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAdd} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPLETION BAR — page-level
// ──────────────────────────────────────────────────────────────────────────────

function completionChecks(profile: ProfileData) {
  return [
    { label: "Ism",          done: !!profile.name },
    { label: "Bio (10+)",    done: profile.bio.length >= 10 },
    { label: "Mutaxassislik",done: profile.speciality.length >= 1 },
    { label: "Galereya",     done: profile.galleryImages.length >= 1 },
    { label: "Manzil",       done: !!profile.address },
    { label: "Ish vaqti",    done: profile.workDays.length > 0 && !!profile.workStart },
    { label: "Ijtimoiy",     done: !!(profile.telegram || profile.instagram) },
  ];
}

function CompletionBar({ profile }: { profile: ProfileData }) {
  const checks = completionChecks(profile);
  const done = checks.filter(c => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  if (pct === 100) return null;

  return (
    <div className="bg-card border border-white/6 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-foreground">Profil to'ldirilishi</p>
        <p className="text-xs font-bold text-primary">{pct}%</p>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {checks.map((c, i) => (
          <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border ${c.done ? "bg-emerald-500/12 border-emerald-500/20 text-emerald-400" : "bg-white/4 border-white/8 text-muted-foreground/60"}`}>
            {c.done ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAP PICKER MODAL
// ──────────────────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "Accept-Language": "uz,ru,en" } },
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function MapPickerModal({
  initialLat,
  initialLng,
  onSave,
  onClose,
}: {
  initialLat: number;
  initialLng: number;
  onSave: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    import("leaflet").then((Lmod) => {
      const L = Lmod.default ?? Lmod;
      if (destroyed || !mapRef.current) return;

      const iconBase = "https://unpkg.com/leaflet@1.9.4/dist/images/";
      // @ts-expect-error leaflet private
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: iconBase + "marker-icon-2x.png",
        iconUrl: iconBase + "marker-icon.png",
        shadowUrl: iconBase + "marker-shadow.png",
      });

      const map = (L as typeof import("leaflet")).map(mapRef.current!, {
        center: [initialLat, initialLng],
        zoom: 15,
      });
      (L as typeof import("leaflet")).tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap" },
      ).addTo(map as import("leaflet").Map);

      const marker = (L as typeof import("leaflet")).marker(
        [initialLat, initialLng],
        { draggable: true },
      ).addTo(map as import("leaflet").Map);

      mapInstanceRef.current = map;
      markerRef.current = marker;

      async function handlePos(lat: number, lng: number) {
        if (destroyed) return;
        setGeocoding(true);
        const addr = await reverseGeocode(lat, lng);
        if (!destroyed) { setAddress(addr); setGeocoding(false); }
      }

      handlePos(initialLat, initialLng);

      (marker as import("leaflet").Marker).on("dragend", () => {
        const pos = (marker as import("leaflet").Marker).getLatLng();
        handlePos(pos.lat, pos.lng);
      });

      (map as import("leaflet").Map).on("click", (e: import("leaflet").LeafletMouseEvent) => {
        (marker as import("leaflet").Marker).setLatLng(e.latlng);
        handlePos(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as import("leaflet").Map).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  function handleSave() {
    const marker = markerRef.current as import("leaflet").Marker | null;
    if (!marker) return;
    const pos = marker.getLatLng();
    onSave(pos.lat, pos.lng, address);
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0 bg-background/95 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Manzilni xaritadan tanlang</p>
          <p className={`text-xs truncate mt-0.5 ${geocoding ? "text-primary/60 animate-pulse" : "text-muted-foreground"}`}>
            {geocoding ? "Manzil aniqlanmoqda..." : (address || "Xaritaga bosing yoki pin-ni sudrang")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={geocoding}
          className="h-9 px-4 rounded-xl bg-primary text-black text-xs font-bold disabled:opacity-50 shrink-0"
        >
          Saqlash
        </button>
      </div>
      <div ref={mapRef} className="flex-1" style={{ minHeight: 0 }} />
    </div>
  );
}

function osmPreviewUrl(lat: string, lng: string): string {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lo - d},${la - d},${lo + d},${la + d}&layer=mapnik&marker=${la},${lo}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// ASOSIY TAB — edit mode (no gallery/completion, those are page-level)
// ──────────────────────────────────────────────────────────────────────────────

function AsosiyTab({
  profile,
  onChange,
  onSave,
  saving,
}: {
  profile: ProfileData;
  onChange: (p: ProfileData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const [newTag, setNewTag] = useState("");
  const [showMapModal, setShowMapModal] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  function set<K extends keyof ProfileData>(k: K, v: ProfileData[K]) {
    onChange({ ...profile, [k]: v });
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      setGpsError("Brauzer joylashuvni qo'llab-quvvatlamaydi");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = await reverseGeocode(lat, lng);
        onChange({ ...profile, latitude: String(lat), longitude: String(lng), address: addr });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Joylashuvga ruxsat berilmadi");
        else setGpsError("Joylashuvni aniqlab bo'lmadi");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("avatarUrl", ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function toggleDay(key: string) {
    const next = profile.workDays.includes(key)
      ? profile.workDays.filter(d => d !== key)
      : [...profile.workDays, key];
    set("workDays", next);
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

  const warn = (label: string) => (
    <p className="text-[11px] text-amber-500/80 flex items-center gap-1 mt-1">
      <span>⚠️</span> {label}
    </p>
  );

  return (
    <div className="space-y-6 pb-28">
      {/* Avatar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avatar (profil rasmi)</label>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl border border-white/12 bg-white/5 overflow-hidden cursor-pointer shrink-0 relative hover:border-white/25 transition-colors"
            onClick={() => imgRef.current?.click()}
          >
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Camera className="w-5 h-5" /></div>
            }
            <div className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-2.5 h-2.5 text-black" />
            </div>
          </div>
          <div>
            <button onClick={() => imgRef.current?.click()} className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors">
              Rasm yuklash
            </button>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Kvadrat rasm tavsiya etiladi</p>
            {profile.avatarUrl && (
              <button onClick={() => set("avatarUrl", "")} className="text-xs text-destructive/70 hover:text-destructive transition-colors mt-0.5 block">
                O'chirish
              </button>
            )}
          </div>
        </div>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ism / Nom *</label>
        <input
          value={profile.name}
          onChange={e => set("name", e.target.value)}
          placeholder="Sardor Barber"
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
        />
        {!profile.name && warn("To'ldirilmagan")}
      </div>

      {/* Brand name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brend nomi (ixtiyoriy)</label>
        <input
          value={profile.brandName}
          onChange={e => set("brandName", e.target.value)}
          placeholder="Sardor Barbershop"
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

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
        {profile.bio.length < 10 && warn("Kamida 10 ta belgi kiriting")}
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
            placeholder="+ Yangi teg (Fade, Soqol...)"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
          <button onClick={addTag} disabled={!newTag.trim() || profile.speciality.length >= 6}
            className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {profile.speciality.length === 0 && warn("Hech bo'lmaganda bitta teg qo'shing")}
      </div>

      {/* Phone — read-only + visibility toggle */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefon raqam</label>
        <div className="flex items-center gap-3 bg-white/3 border border-white/6 rounded-2xl px-4 py-3">
          <Phone className="w-4 h-4 text-primary/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${profile.phone ? "text-foreground" : "text-muted-foreground/60"}`}>
              {profile.phone || "Kiritilmagan"}
            </p>
            {profile.phone && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Telegram orqali tasdiqlangan</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Mijozlarga ko'rsatish</span>
          <button
            onClick={() => set("phoneVisible", !profile.phoneVisible)}
            className={`relative w-10 h-5.5 rounded-full transition-all ${profile.phoneVisible ? "bg-primary" : "bg-white/10"}`}
            style={{ height: 22, width: 40 }}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${profile.phoneVisible ? "translate-x-[18px]" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Address / Map */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manzil</label>

        {profile.latitude && profile.longitude ? (
          <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ height: 160 }}>
            <iframe
              src={osmPreviewUrl(profile.latitude, profile.longitude)}
              className="w-full h-full"
              style={{ border: 0, pointerEvents: "none" }}
              scrolling="no"
              loading="lazy"
              title="Joylashuv"
            />
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <button
                onClick={handleGPS}
                disabled={gpsLoading}
                title="Joriy joylashuvni aniqlash"
                className="h-8 px-3 rounded-xl bg-black/70 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {gpsLoading
                  ? <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                  : <Navigation className="w-3 h-3" />
                }
              </button>
              <button
                onClick={() => setShowMapModal(true)}
                className="h-8 px-3 rounded-xl bg-black/70 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3" /> O'zgartirish
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowMapModal(true)}
              className="flex-1 h-24 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/30 hover:text-primary/80 transition-all"
            >
              <MapPin className="w-4 h-4" />
              <span className="text-xs">Xaritadan tanlash</span>
            </button>
            <button
              onClick={handleGPS}
              disabled={gpsLoading}
              className="flex-1 h-24 rounded-2xl border border-dashed border-emerald-500/25 flex flex-col items-center justify-center gap-1.5 text-emerald-400/70 hover:border-emerald-500/50 hover:text-emerald-400 transition-all disabled:opacity-50"
            >
              {gpsLoading
                ? <span className="w-4 h-4 border border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                : <Navigation className="w-4 h-4" />
              }
              <span className="text-xs">{gpsLoading ? "Aniqlanmoqda..." : "Joylashuvimni aniqlash"}</span>
            </button>
          </div>
        )}
        {gpsError && (
          <p className="text-xs text-destructive/80 px-1">{gpsError}</p>
        )}

        <input
          value={profile.address}
          onChange={e => set("address", e.target.value)}
          placeholder="Manzilni qo'lda yozish"
          className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
        />

        <div className="flex gap-2">
          <input
            value={profile.mapLink}
            onChange={e => set("mapLink", e.target.value)}
            placeholder="Google Maps / Yandex Maps havolasi"
            className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-xs text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          {safeUrl(profile.mapLink) && (
            <a
              href={safeUrl(profile.mapLink)!}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center text-xs font-semibold gap-1.5 hover:bg-primary/20 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {showMapModal && (
        <MapPickerModal
          initialLat={profile.latitude ? parseFloat(profile.latitude) : 41.2995}
          initialLng={profile.longitude ? parseFloat(profile.longitude) : 69.2401}
          onSave={(lat, lng, address) => {
            onChange({
              ...profile,
              latitude: String(lat),
              longitude: String(lng),
              address: address,
            });
            setShowMapModal(false);
          }}
          onClose={() => setShowMapModal(false)}
        />
      )}

      {/* Work schedule */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ish vaqti</label>

        {/* 7-day checkboxes */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Ish kunlari</p>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(d => {
              const active = profile.workDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => toggleDay(d.key)}
                  className={`w-10 h-10 rounded-xl text-xs font-bold border transition-all ${active ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/8 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {profile.workDays.length === 0 && warn("Hech bo'lmaganda bitta kun tanlang")}
        </div>

        {/* Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ish boshlanishi</p>
            <input value={profile.workStart} onChange={e => set("workStart", e.target.value)} placeholder="09:00"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ish tugashi</p>
            <input value={profile.workEnd} onChange={e => set("workEnd", e.target.value)} placeholder="20:00"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
          </div>
        </div>

        {/* Lunch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Tushlik vaqtini qo'shish</p>
            <button
              onClick={() => set("lunchEnabled", !profile.lunchEnabled)}
              className={`relative rounded-full transition-all shrink-0`}
              style={{ height: 22, width: 40 }}
            >
              <span className={`absolute inset-0 rounded-full transition-colors ${profile.lunchEnabled ? "bg-primary" : "bg-white/10"}`} />
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${profile.lunchEnabled ? "translate-x-[18px]" : "translate-x-0"}`} />
            </button>
          </div>
          {profile.lunchEnabled && (
            <div className="flex items-center gap-2">
              <input value={profile.lunchStart} onChange={e => set("lunchStart", e.target.value)} placeholder="13:00"
                className="w-28 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
              <span className="text-muted-foreground text-xs">—</span>
              <input value={profile.lunchEnd} onChange={e => set("lunchEnd", e.target.value)} placeholder="14:00"
                className="w-28 h-10 px-3 rounded-xl bg-white/5 border border-white/8 text-sm text-center focus:outline-none focus:border-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Social */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ijtimoiy tarmoqlar</label>

        {/* Telegram — read-only, clickable if username set */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-[#2AABEE]" />
          </div>
          {profile.telegram ? (
            <div className="flex-1 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center overflow-hidden">
              <span className="pl-3 pr-1 text-sm text-muted-foreground/60 select-none shrink-0">@</span>
              <a
                href={`https://t.me/${profile.telegram.replace(/^@+/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-full flex items-center text-sm text-[#2AABEE] hover:underline pr-3"
              >
                {profile.telegram.replace(/^@+/, "")}
              </a>
            </div>
          ) : (
            <div className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/4 flex items-center text-sm text-muted-foreground/50 cursor-default">
              Telegram orqali kirish orqali qo'shiladi
            </div>
          )}
        </div>

        {/* Instagram — username only, @ auto-prepended */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/20 flex items-center justify-center shrink-0">
            <Instagram className="w-4 h-4 text-pink-400" />
          </div>
          <div className="flex-1 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center overflow-hidden focus-within:border-primary/50 transition-colors">
            <span className="pl-3 pr-1 text-sm text-muted-foreground/60 select-none shrink-0">@</span>
            <input
              value={profile.instagram.replace(/^@+/, "")}
              onChange={e => set("instagram", e.target.value.replace(/^@+/, ""))}
              placeholder="username"
              className="flex-1 h-full bg-transparent text-sm focus:outline-none pr-3"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={saving || !profile.name.trim()}
        className="w-full h-12 rounded-2xl bg-primary text-black font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-primary/90"
      >
        {saving
          ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saqlanmoqda...</>
          : <><Save className="w-4 h-4" /> Saqlash</>
        }
      </button>
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
  saving,
}: {
  initial?: ServiceItem;
  customCats: string[];
  onSave: (s: Omit<ServiceItem, "id"> & { id?: string }) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "soch");
  const [duration, setDuration] = useState(String(initial?.duration ?? 30));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");

  const allCats = ["soch", "soqol", "bolalar", "vip", ...customCats];
  const catLabels: Record<string, string> = { soch: "Soch", soqol: "Soqol", bolalar: "Bolalar", vip: "VIP" };

  function handleSave() {
    if (!name.trim() || !price) return;
    onSave({
      id: initial?.id,
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
      <button onClick={handleSave} disabled={!name.trim() || !price || saving}
        className="w-full h-12 rounded-2xl bg-primary text-black font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {saving
          ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saqlanmoqda...</>
          : (initial ? "Saqlash" : "Qo'shish")
        }
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// XIZMATLAR TAB — real API CRUD
// ──────────────────────────────────────────────────────────────────────────────

function XizmatlarTab({
  services,
  customCats,
  onReload,
  onAddCat,
}: {
  services: ServiceItem[];
  customCats: string[];
  onReload: () => void;
  onAddCat: (c: string) => void;
}) {
  const [activeCat, setActiveCat] = useState("all");
  const [addingOrEditing, setAddingOrEditing] = useState<"new" | string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allCats = [...DEFAULT_CATS, ...customCats.map(c => ({ id: c, label: c }))];
  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);

  async function handleSave(item: Omit<ServiceItem, "id"> & { id?: string }) {
    setSaving(true); setError("");
    try {
      const body = { name: item.name, nameRu: item.category, duration: item.duration, price: item.price };
      if (item.id) { await apiPut(`/api/services/${item.id}`, body); }
      else { await apiPost("/api/services", body); }
      setAddingOrEditing(null);
      onReload();
    } catch { setError("Xatolik yuz berdi. Qayta urinib ko'ring."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try { await apiDelete(`/api/services/${id}`); onReload(); }
    catch { setError("O'chirishda xatolik yuz berdi."); }
  }

  function handleAddCat() {
    const cat = newCat.trim();
    if (!cat || customCats.includes(cat)) { setShowNewCat(false); setNewCat(""); return; }
    onAddCat(cat); setShowNewCat(false); setNewCat("");
  }

  if (addingOrEditing !== null) {
    const editing = addingOrEditing !== "new" ? services.find(s => s.id === addingOrEditing) : undefined;
    return (
      <>
        {error && <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <ServiceForm customCats={customCats} initial={editing} onSave={handleSave} onCancel={() => setAddingOrEditing(null)} saving={saving} />
      </>
    );
  }

  return (
    <div className="pb-10">
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2 mb-3">{error}</p>}

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

      <div className="space-y-2.5 mb-4">
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ delay: i * 0.03 }}>
              <div className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3 hover:border-white/10 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xl shrink-0">{catEmoji(s.category)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDur(s.duration)} · <span className="text-foreground/70">{formatPriceShort(s.price)} so'm</span></p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setAddingOrEditing(s.id)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
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

function SlugEditModal({ currentSlug, onClose, onSaved }: { currentSlug: string; onClose: () => void; onSaved: (s: string) => void; }) {
  const [step, setStep] = useState<SlugModalStep>("edit");
  const [draft, setDraft] = useState(currentSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function cleanSlug(raw: string) {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  }

  function validate() {
    if (draft.length < 3 || draft.length > 30) { setError("Uzunlik: 3 dan 30 ta belgigacha"); return false; }
    if (!/^[a-z0-9-]+$/.test(draft)) { setError("Faqat kichik harf, raqam va '-' ishlatish mumkin"); return false; }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/settings/slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ slug: draft }),
      });
      const data = await res.json();
      if (res.status === 429) { setError("Linkni hozir o'zgartira olmaysiz. Keyinroq urinib ko'ring."); setStep("edit"); }
      else if (res.status === 409) { setError("Bu slug allaqachon band. Boshqa nom tanlang."); setStep("edit"); }
      else if (!res.ok) { setError(data?.message || "Xatolik yuz berdi"); setStep("edit"); }
      else {
        const newSlug = data.username ?? draft;
        try { const raw = localStorage.getItem("barber_user"); if (raw) { const c = JSON.parse(raw); c.username = newSlug; localStorage.setItem("barber_user", JSON.stringify(c)); } } catch {}
        onSaved(newSlug);
      }
    } catch { setError("Tarmoq xatosi. Qayta urinib ko'ring."); setStep("edit"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        {step === "edit" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-display font-bold text-foreground">Sahifa linkini tahrirlash</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{APP_DISPLAY_HOST}/</p>
            <input autoFocus value={draft} onChange={e => { setDraft(cleanSlug(e.target.value)); setError(""); }} placeholder="slug"
              className="w-full bg-background/60 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-primary/50 mb-1" />
            <p className="text-xs text-muted-foreground mb-3">Faqat kichik harf, raqam va '-' ishlatish mumkin</p>
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5">
              <p className="text-xs text-amber-400 font-semibold mb-1">⚠️ Diqqat:</p>
              <p className="text-xs text-amber-400/80 leading-relaxed">Linkni o'zgartirsangiz, eski QR kodlar eski manzilga olib boradi, lekin tizim avtomatik yangi sahifaga yo'naltiradi.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-white/6 border border-white/10 text-muted-foreground hover:text-foreground transition-all">Bekor qilish</button>
              <button onClick={() => { if (validate()) setStep("confirm"); }} disabled={draft === currentSlug || draft.length < 3}
                className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Saqlash
              </button>
            </div>
          </>
        )}
        {step === "confirm" && (
          <>
            <h2 className="text-base font-display font-bold text-foreground mb-2">Tasdiqlash</h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">Linkni o'zgartirmoqchimisiz? Bu mijozlar uchun havolani o'zgartiradi.</p>
            <div className="bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-5 font-mono text-sm text-primary">{APP_DISPLAY_HOST}/{draft}</div>
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep("edit")} className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-white/6 border border-white/10 text-muted-foreground hover:text-foreground">Bekor qilish</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 h-11 rounded-2xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saqlanmoqda</> : "Ha, o'zgartirish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QRLinkTab({ userSlug, onEditSlug }: { userSlug: string; onEditSlug: () => void }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const pageUrl = `${APP_ORIGIN}/${userSlug}`;

  function handleCopy() {
    navigator.clipboard.writeText(pageUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  function handleShare() {
    const text = `Menga yozilish uchun:\n${pageUrl}`;
    if (navigator.share) { navigator.share({ title: "Barber sahifasi", text, url: pageUrl }).catch(() => {}); }
    else { navigator.clipboard.writeText(text); }
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
      a.download = `barber-qr-${userSlug}.png`; a.href = canvas.toDataURL("image/png"); a.click();
    };
    img.src = url;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sahifa manzili</p>
          <button onClick={onEditSlug}
            className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary/80 transition-colors">
            <Pencil className="w-3 h-3" /> Tahrirlash
          </button>
        </div>
        <div className="flex items-center gap-2 bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-3">
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-1 min-w-0 hover:opacity-80 transition-opacity">
            <span className="text-xs text-muted-foreground shrink-0">{APP_DISPLAY_HOST}/</span>
            <span className="text-sm text-primary font-mono truncate">{userSlug}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleCopy}
            className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${copied ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" : "bg-white/5 border-white/8 text-muted-foreground hover:text-foreground"}`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <button onClick={handleShare}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/8 bg-white/5 text-muted-foreground hover:text-foreground transition-all">
            <Share2 className="w-3.5 h-3.5" /> Ulashish
          </button>
        </div>
      </div>

      <div className="bg-card border border-white/6 rounded-2xl p-5 flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">QR kod</p>
        <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-xl shadow-black/30 mb-3">
          <QRCode value={pageUrl} size={180} fgColor="#000000" bgColor="#ffffff" level="M" />
        </div>
        <p className="text-xs text-muted-foreground mb-4">📷 Mijozlar skaner qilib bron qilishi mumkin</p>
        <button onClick={handleDownload}
          className="h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/8 bg-white/5 text-muted-foreground hover:text-foreground transition-all">
          <Download className="w-3.5 h-3.5" /> Yuklab olish
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold font-display text-primary mb-1">—</p>
          <p className="text-xs text-muted-foreground">QR skanerlashlar</p>
        </div>
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold font-display text-emerald-400 mb-1">—</p>
          <p className="text-xs text-muted-foreground">Bronlar (bu oy)</p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// BOOKING MODAL (unchanged logic, demo slots)
// ──────────────────────────────────────────────────────────────────────────────

type BookingStep = "time" | "info" | "verifying" | "done";
type DateOpt = "today" | "tomorrow" | "custom";
interface TgCustomer { tgId: string; name: string; username: string | null }

function loadTgCustomer(): TgCustomer | null {
  try { return JSON.parse(localStorage.getItem("tg_customer") || "null"); } catch { return null; }
}
function saveTgCustomer(c: TgCustomer) { localStorage.setItem("tg_customer", JSON.stringify(c)); }

async function createBookingSession(payload: {
  barberId: string; barberName: string; barberAddress: string;
  mapLink: string; barberPageLink: string; isTeam: boolean;
  teamBarberName: string | null; services: { name: string; price: number; duration: number }[];
  totalPrice: number; totalDuration: number; date: string; time: string;
  tgCustomer?: TgCustomer; clientPhone?: string;
}): Promise<{ sessionId: string; deepLink: string | null; status: string }> {
  const res = await fetch("/api/public/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Session creation failed");
  return res.json();
}
async function pollSession(sessionId: string): Promise<{ status: string; clientName?: string; clientTelegramId?: string; clientTelegramUsername?: string }> {
  const res = await fetch(`/api/public/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Poll failed");
  return res.json();
}

function BookingModal({ selectedServices, totalDuration, isTeam, barberId, profile, onClose }: {
  selectedServices: ServiceItem[]; totalDuration: number; isTeam: boolean; barberId: string; profile: ProfileData; onClose: () => void;
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

  const stopPolling = useCallback(() => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  function getTeamBarberName() {
    if (!isTeam || !selectedBarber || selectedBarber === "any" || selectedBarber === "solo") return null;
    return TEAM_BARBERS.find(b => b.id === selectedBarber)?.name || null;
  }

  async function handleBookingSubmit() {
    if (!clientName.trim() || !selectedTime || submitting) return;
    setSubmitting(true);
    try {
      const tgCustomer = loadTgCustomer();
      const services = selectedServices.map(s => ({ name: s.name, price: s.price, duration: s.duration }));
      const totalPrice = selectedServices.reduce((a, s) => a + s.price, 0);

      const trimmedPhone = clientPhone.trim();
      const result = await createBookingSession({
        barberId: barberId || "demo", barberName: profile.name,
        barberAddress: profile.address, mapLink: profile.mapLink,
        barberPageLink: `${APP_ORIGIN}/barber-uz`, isTeam, teamBarberName: getTeamBarberName(),
        services, totalPrice, totalDuration, date: dateOpt, time: selectedTime,
        tgCustomer: tgCustomer || undefined,
        clientPhone: trimmedPhone.length > 5 ? trimmedPhone : undefined,
      });
      if (result.status === "confirmed") { setStep("done"); setSubmitting(false); return; }

      setSessionId(result.sessionId);
      if (result.deepLink) window.open(result.deepLink, "_blank");
      setStep("verifying"); setSubmitting(false);
      pollingRef.current = setInterval(async () => {
        try {
          const poll = await pollSession(result.sessionId);
          if (poll.status === "confirmed") {
            stopPolling();
            if (poll.clientTelegramId) saveTgCustomer({ tgId: poll.clientTelegramId, name: poll.clientName || clientName, username: poll.clientTelegramUsername || null });
            setStep("done");
          } else if (poll.status === "expired") { stopPolling(); setStep("info"); }
        } catch {}
      }, 3000);
    } catch { setSubmitting(false); }
  }

  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const barberSlots = isTeam
    ? TEAM_BARBERS.map(b => ({ barber: b, slots: generateSlots(totalDuration, b.busy) }))
    : [{ barber: null, slots: generateSlots(totalDuration, SOLO_BUSY) }];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== "done" ? onClose : undefined} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />
        <div className="flex items-center gap-3 px-5 py-4 shrink-0 border-b border-white/6">
          {step === "info" && <button onClick={() => setStep("time")} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><ArrowLeft className="w-4 h-4" /></button>}
          <div className="flex-1">
            {step === "time" && <h2 className="font-bold text-base">Vaqt tanlash</h2>}
            {step === "info" && <h2 className="font-bold text-base">Bronni tasdiqlash</h2>}
            {step === "verifying" && <h2 className="font-bold text-base text-[#2AABEE]">Telegram tasdiq...</h2>}
            {step === "done" && <h2 className="font-bold text-base text-emerald-400">Bron tasdiqlandi!</h2>}
          </div>
          {step !== "done" && <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>}
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {step !== "done" && (
            <div className="bg-primary/6 border border-primary/12 rounded-2xl px-4 py-3 mt-4 mb-5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {selectedServices.map(s => <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{s.name}</span>)}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {formatDur(totalDuration)}</p>
                <p className="text-sm font-bold text-primary">{formatPriceShort(totalPrice)}k</p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {step === "time" && (
              <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex gap-2 mb-5">
                  {(["today", "tomorrow"] as DateOpt[]).map(d => (
                    <button key={d} onClick={() => setDateOpt(d)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${dateOpt === d ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                      {d === "today" ? "📅 Bugun" : "📅 Ertaga"}
                    </button>
                  ))}
                  <button onClick={() => setDateOpt("custom")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${dateOpt === "custom" ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>Boshqa</button>
                </div>
                {isTeam ? (
                  <div className="space-y-4">
                    <div className={`rounded-2xl border p-4 transition-all ${selectedBarber === "any" ? "border-primary/30 bg-primary/6" : "border-white/8 bg-white/3"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-xl shrink-0">👥</div>
                        <div><p className="font-semibold text-sm">Istalgan barber</p><p className="text-xs text-muted-foreground">Birinchi bo'sh usta qabul qiladi</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generateSlots(totalDuration, SOLO_BUSY.slice(0, 2)).map(slot => (
                          <button key={slot} onClick={() => { setSelectedBarber("any"); setSelectedTime(slot); }}
                            className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${selectedBarber === "any" && selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8"}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
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
                          ? <p className="text-xs text-muted-foreground/50">Bo'sh vaqt yo'q</p>
                          : <div className="flex flex-wrap gap-2">
                              {slots.slice(0, 8).map(slot => (
                                <button key={slot} onClick={() => { setSelectedBarber(barber.id); setSelectedTime(slot); }}
                                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${selectedBarber === barber.id && selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8"}`}>
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
                            <button key={slot} onClick={() => setSelectedTime(slot)}
                              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8"}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                    }
                  </div>
                )}
                <button onClick={() => selectedTime && setStep("info")} disabled={!selectedTime}
                  className="w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-base mt-6 disabled:opacity-30 shadow-lg shadow-primary/20">
                  Davom etish →
                </button>
              </motion.div>
            )}
            {step === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-5">Telegram bot bron ma'lumotlarini tasdiqlaydi</p>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tanlangan vaqt</p>
                    <p className="text-sm font-bold">{dateOpt === "today" ? "Bugun" : "Ertaga"}, soat {selectedTime}</p>
                    {isTeam && selectedBarber && selectedBarber !== "any" && <p className="text-xs text-primary">{TEAM_BARBERS.find(b => b.id === selectedBarber)?.name}</p>}
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
                    <p className="text-xs text-[#2AABEE]/80 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 shrink-0" /> Telegram bot bron tasdiqlaydi</p>
                  </div>
                  <button onClick={handleBookingSubmit} disabled={!clientName.trim() || submitting}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-30 text-sm">
                    {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Yuklanmoqda...</> : <><Send className="w-4 h-4" /> Telegram orqali tasdiqlash</>}
                  </button>
                </div>
              </motion.div>
            )}
            {step === "verifying" && (
              <motion.div key="verifying" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <div className="w-20 h-20 rounded-3xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center text-4xl mx-auto mb-5">💬</div>
                <h2 className="text-lg font-bold mb-1">Telegram bot kutilmoqda</h2>
                <p className="text-sm text-muted-foreground mb-6">Telegram botda <b>✅ Tasdiqlash</b> tugmasini bosing</p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
                  {[0, 0.2, 0.4].map((d, i) => <span key={i} className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${d}s` }} />)}
                  <span className="ml-1">Tasdiq kutilmoqda</span>
                </div>
                {sessionId && (
                  <button onClick={() => window.open(`tg://resolve?domain=Barberuz_yordamchi_bot&start=booking_${sessionId}`, "_blank")}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 text-[#2AABEE] font-semibold text-sm flex items-center justify-center gap-2 mb-3">
                    <Send className="w-4 h-4" /> Telegram botni qayta ochish
                  </button>
                )}
                <button onClick={() => { stopPolling(); setStep("info"); }} className="text-xs text-muted-foreground underline">Bekor qilish</button>
              </motion.div>
            )}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-24 h-24 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-5xl mx-auto mb-5">✅</div>
                <h2 className="text-xl font-bold mb-1">Bron qabul qilindi!</h2>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 my-5 text-left">
                  <p className="text-xs text-muted-foreground mb-1">Bron ma'lumotlari</p>
                  <p className="text-sm font-semibold">{dateOpt === "today" ? "Bugun" : "Ertaga"}, soat {selectedTime}</p>
                  <p className="text-xs text-muted-foreground mt-2">{selectedServices.map(s => s.name).join(", ")}</p>
                </div>
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
// CUSTOMER VIEW — preview mode
// ──────────────────────────────────────────────────────────────────────────────

export function CustomerView({ profile, services, isTeam, barberId, previewMode }: {
  profile: ProfileData; services: ServiceItem[]; isTeam: boolean; barberId: string; previewMode?: boolean;
}) {
  const [previewTab, setPreviewTab] = useState<"asosiy" | "xizmatlar">("asosiy");
  const [activeCat, setActiveCat] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailSvc, setDetailSvc] = useState<ServiceItem | null>(null);
  const [previewWarn, setPreviewWarn] = useState(false);

  const visibleCats = ["all", ...Array.from(new Set(services.map(s => s.category)))];
  const catChips = DEFAULT_CATS.filter(c => visibleCats.includes(c.id));
  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);
  const selectedServices = services.filter(s => selectedIds.includes(s.id));

  function calcTotal() {
    let dur = 0, price = 0;
    selectedServices.forEach(s => { dur += s.duration; price += s.price; });
    services.filter(s => s.comboIds).forEach(combo => {
      if (combo.comboIds!.every(id => selectedIds.includes(id)) && combo.comboPrice) {
        const orig = combo.comboIds!.reduce((acc, id) => acc + (services.find(s => s.id === id)?.price ?? 0), 0);
        price -= (orig - combo.comboPrice);
      }
    });
    return { dur, price };
  }

  const { dur: totalDur, price: totalPrice } = calcTotal();
  function toggleService(id: string) { setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  const COVER_GRAD = ["from-primary/50 via-primary/20 to-transparent", "from-amber-600/50 via-amber-600/20 to-transparent", "from-emerald-600/50 via-emerald-600/20 to-transparent", "from-violet-600/50 via-violet-600/20 to-transparent"];
  const gradIdx = profile.name.charCodeAt(0) % COVER_GRAD.length;
  const coverImage = profile.galleryImages[0] || "";

  const workDaysLabel = profile.workDays.length > 0
    ? profile.workDays.map(k => DAYS.find(d => d.key === k)?.label || k).join(", ")
    : null;

  return (
    <div className="pb-28 -mx-4">
      {/* Hero */}
      <div className="relative">
        <div className="w-full h-48 relative overflow-hidden">
          {coverImage
            ? <img src={coverImage} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg,#ffffff08 0,#ffffff08 1px,transparent 0,transparent 50%)", backgroundSize: "20px 20px" }} />
                <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRAD[gradIdx]}`} />
              </div>
          }
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="absolute bottom-0 left-4 translate-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-gradient-to-br from-primary/40 to-primary/15 flex items-center justify-center shadow-2xl shadow-black/40">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} className="w-full h-full object-cover" />
              : <span className="text-3xl font-bold text-primary uppercase">{profile.name.charAt(0) || "?"}</span>
            }
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-12 pb-3">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{profile.brandName || profile.name}</h1>
        {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}
      </div>

      {/* Gallery strip — always above tabs (1+ images) */}
      {profile.galleryImages.length > 0 && (
        <div className="overflow-x-auto scrollbar-hide pb-3">
          <div className="flex gap-2.5 px-4">
            {profile.galleryImages.map((src, i) => (
              <div key={i} className="relative shrink-0 w-40 h-28 rounded-2xl overflow-hidden border border-white/8">
                <img src={src} className="w-full h-full object-cover" alt="" />
                {i === 0 && <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-primary/80 text-black text-[9px] font-bold rounded-full">Muqova</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="px-4 mb-1">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          {(["asosiy", "xizmatlar"] as const).map(t => (
            <motion.button key={t} onClick={() => setPreviewTab(t)} whileTap={{ scale: 0.97 }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${previewTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {previewTab === "asosiy" && (
          <motion.div key="asosiy" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4 space-y-5">
              {/* Speciality chips */}
              {profile.speciality.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.speciality.map((s, i) => <span key={i} className="px-2.5 py-1 rounded-full bg-primary/12 border border-primary/20 text-xs text-primary font-medium">{s}</span>)}
                </div>
              )}

              {/* 🕐 Ish vaqti */}
              {(workDaysLabel || profile.workStart) && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">🕐</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Ish vaqti</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <div className="flex items-center justify-between bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-primary/70 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground/50 mb-0.5">Kun</p>
                        <p className="text-xs text-foreground font-medium">{workDaysLabel || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground/50 mb-0.5">Soat</p>
                      <p className="text-xs text-foreground font-medium">{profile.workStart}–{profile.workEnd}</p>
                    </div>
                  </div>
                  {profile.lunchEnabled && profile.lunchStart && profile.lunchEnd && (
                    <div className="flex items-center gap-2 mt-2 px-4 py-2.5 bg-white/3 border border-white/6 rounded-2xl">
                      <span className="text-sm">🍽</span>
                      <span className="text-xs text-muted-foreground">Tushlik tanaffus: {profile.lunchStart}–{profile.lunchEnd}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 📞 Aloqa */}
              {profile.phoneVisible && profile.phone && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📞</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Aloqa</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <a
                    href={`tel:${profile.phone}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-colors"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>Qo'ng'iroq qilish</span>
                    <span className="ml-auto text-xs text-emerald-400/70">{profile.phone}</span>
                  </a>
                </div>
              )}

              {/* 📍 Manzil */}
              {(profile.latitude && profile.longitude) ? (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📍</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Manzil</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-2xl overflow-hidden border border-white/8" style={{ height: 140 }}>
                      <iframe
                        src={osmPreviewUrl(profile.latitude, profile.longitude)}
                        className="w-full h-full"
                        style={{ border: 0, pointerEvents: "none" }}
                        scrolling="no"
                        loading="lazy"
                        title="Joylashuv"
                      />
                    </div>
                    {profile.address && (
                      <p className="text-xs text-muted-foreground px-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 shrink-0 text-primary/60" />
                        <span className="truncate">{profile.address}</span>
                      </p>
                    )}
                    <a
                      href={safeUrl(profile.mapLink) || `https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-card border border-white/8 text-xs font-semibold text-primary hover:border-primary/30 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Xaritada ochish
                    </a>
                  </div>
                </div>
              ) : profile.address ? (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📍</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Manzil</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  {(() => {
                    const href = safeUrl(profile.mapLink);
                    const Tag = href ? "a" : "div";
                    const extraProps = href ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : {};
                    return (
                      <Tag {...extraProps} className="block bg-card border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors">
                        <div className="h-16 bg-zinc-900 relative overflow-hidden">
                          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(#4af 1px,transparent 1px),linear-gradient(90deg,#4af 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full bg-primary shadow-lg shadow-primary/50 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>
                          </div>
                        </div>
                        <div className="px-4 py-3 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm text-foreground flex-1">{profile.address}</span>
                          {href && <span className="text-xs text-primary font-semibold">Ko'rish →</span>}
                        </div>
                      </Tag>
                    );
                  })()}
                </div>
              ) : null}

              {/* 🔗 Ijtimoiy tarmoqlar */}
              {(profile.telegram || profile.instagram) && (
                <div className="pb-2">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">🔗</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Ijtimoiy tarmoqlar</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <div className="space-y-2">
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
          </motion.div>
        )}
        {previewTab === "xizmatlar" && (
          <motion.div key="xizmatlar" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4">
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
                      <div className={`bg-card border rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all ${isSelected ? "border-primary/40 bg-primary/6" : "border-white/6 hover:border-white/12"}`}
                        onClick={() => setDetailSvc(s)}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${isSelected ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/8"}`}>{catEmoji(s.category)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDur(s.duration)} · <span className="text-foreground/80 font-medium">{formatPriceShort(s.price)} so'm</span></p>
                        </div>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); toggleService(s.id); }}
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

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-md mx-auto px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-white/8">
          <AnimatePresence mode="wait">
            {selectedIds.length > 0 ? (
              <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{selectedIds.length} xizmat · {formatDur(totalDur)}</p>
                  <p className="text-base font-bold text-foreground">{formatPrice(totalPrice)}</p>
                </div>
                <button
                  onClick={() => previewMode ? setPreviewWarn(true) : setBookingOpen(true)}
                  className="h-12 px-6 rounded-2xl bg-primary text-black font-bold text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all shrink-0">
                  Bron qilish →
                </button>
              </motion.div>
            ) : (
              <motion.div key="inactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => previewMode ? setPreviewWarn(true) : setPreviewTab("xizmatlar")}
                  className="w-full h-12 rounded-2xl bg-white/6 border border-white/8 text-muted-foreground font-semibold text-sm hover:bg-white/10 hover:text-foreground transition-all">
                  💈 Xizmat tanlash
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview mode warning popup */}
      <AnimatePresence>
        {previewWarn && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewWarn(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="relative w-full max-w-md bg-card rounded-t-3xl z-10 border-t border-white/8 px-5 py-6"
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-3xl">⚠️</div>
                <h3 className="text-base font-bold text-foreground">Bu ko'rish rejimi</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "Xizmatni tanlash" tugmasi faqat <span className="text-foreground font-semibold">mijozlaringiz uchun maxsus havola (link)</span> orqali kirganda ishlaydi.
                </p>
                <button onClick={() => setPreviewWarn(false)}
                  className="mt-2 w-full py-3 rounded-2xl bg-white/8 border border-white/12 text-sm font-semibold text-foreground hover:bg-white/12 transition-colors">
                  Tushunarli
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Service detail sheet */}
      <AnimatePresence>
        {detailSvc && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailSvc(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="relative w-full max-w-md bg-card rounded-t-3xl z-10 border-t border-white/8" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-5 pb-10 pt-3">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-3xl shrink-0">{catEmoji(detailSvc.category)}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-foreground mb-0.5">{detailSvc.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatDur(detailSvc.duration)} · {formatPrice(detailSvc.price)}</p>
                  </div>
                  <button onClick={() => setDetailSvc(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                </div>
                {detailSvc.description && <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{detailSvc.description}</p>}
                <p className="text-xs text-muted-foreground/50 text-center mb-4">ℹ️ Iltimos, belgilangan vaqtdan 5 daqiqa oldin keling</p>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { toggleService(detailSvc.id); setDetailSvc(null); }}
                  className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${selectedIds.includes(detailSvc.id) ? "bg-white/6 border border-white/10 text-muted-foreground" : "bg-primary text-black shadow-xl shadow-primary/25 hover:bg-primary/90"}`}>
                  {selectedIds.includes(detailSvc.id) ? "✓ Tanlangan (bekor qilish)" : "Tanlash →"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingOpen && (
          <BookingModal selectedServices={selectedServices} totalDuration={totalDur} isTeam={isTeam} barberId={barberId} profile={profile} onClose={() => setBookingOpen(false)} />
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

  const [tab, setTab] = useState<Tab>("asosiy");
  const [preview, setPreview] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [slugModalOpen, setSlugModalOpen] = useState(false);
  const [userSlug, setUserSlug] = useState(user?.username || "");

  useEffect(() => { setUserSlug(user?.username || ""); }, [user?.username]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    apiGet("/api/settings/profile")
      .then((data: Record<string, unknown>) => { if (!cancelled) { setProfile(apiToProfile(data)); setLoadingProfile(false); } })
      .catch(() => { if (!cancelled) setLoadingProfile(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingServices(true);
    apiGet("/api/services")
      .then((data: { services: Record<string, unknown>[] }) => { if (!cancelled) { setServices((data.services || []).map(apiToService)); setLoadingServices(false); } })
      .catch(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, []);

  function reloadServices() {
    setLoadingServices(true);
    apiGet("/api/services")
      .then((data: { services: Record<string, unknown>[] }) => { setServices((data.services || []).map(apiToService)); setLoadingServices(false); })
      .catch(() => setLoadingServices(false));
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(null);
    try {
      const updated = await apiPut("/api/settings/profile", profileToApi(profile));
      setProfile(apiToProfile(updated));
      setSaveMsg({ type: "ok", text: "Muvaffaqiyatli saqlandi ✓" });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch { setSaveMsg({ type: "err", text: "Saqlashda xatolik. Qayta urinib ko'ring." }); }
    finally { setSaving(false); }
  }

  const pageTitle = isTeam ? "🌐 Barbershop sahifasi" : "🌐 Mening sahifam";
  const TABS: { id: Tab; label: string }[] = [
    { id: "asosiy", label: "Asosiy" },
    { id: "xizmatlar", label: "Xizmatlar" },
    { id: "qr", label: "QR & Link" },
  ];

  return (
    <Layout hideBottomNav>
      {/* Page header */}
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

      {/* Save toast */}
      <AnimatePresence>
        {saveMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`mb-4 px-4 py-3 rounded-2xl text-sm font-semibold ${saveMsg.type === "ok" ? "bg-emerald-500/12 border border-emerald-500/25 text-emerald-400" : "bg-destructive/12 border border-destructive/25 text-destructive"}`}>
            {saveMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {preview ? (
        <>
          <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 mb-0 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md flex items-center justify-between">
            <p className="text-xs text-amber-400 font-semibold">👁 Ko'rish rejimi — mijoz qanday ko'radi</p>
            <button onClick={() => setPreview(false)} className="text-xs text-amber-300 font-bold underline underline-offset-2">← Tahrirlash</button>
          </div>
          <CustomerView profile={profile} services={services} isTeam={isTeam} barberId={user?.id || ""} previewMode={true} />
        </>
      ) : (
        <>
          {/* Gallery strip — ALWAYS visible above tabs in edit mode */}
          {!loadingProfile && (
            <GalleryStripEdit images={profile.galleryImages} onChange={imgs => setProfile(p => ({ ...p, galleryImages: imgs }))} />
          )}

          {/* Completion bar — ALWAYS visible above tabs in edit mode */}
          {!loadingProfile && <CompletionBar profile={profile} />}

          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 mb-4 bg-background/95 backdrop-blur-md border-b border-white/6">
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {tab === "asosiy" && (
              <motion.div key="asosiy" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                {loadingProfile
                  ? <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                  : <AsosiyTab profile={profile} onChange={setProfile} onSave={handleSave} saving={saving} />
                }
              </motion.div>
            )}
            {tab === "xizmatlar" && (
              <motion.div key="xizmatlar" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                {loadingServices
                  ? <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                  : <XizmatlarTab services={services} customCats={customCats} onReload={reloadServices} onAddCat={c => setCustomCats(prev => [...prev, c])} />
                }
              </motion.div>
            )}
            {tab === "qr" && (
              <motion.div key="qr" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <QRLinkTab userSlug={userSlug} onEditSlug={() => setSlugModalOpen(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {slugModalOpen && (
        <SlugEditModal currentSlug={userSlug} onClose={() => setSlugModalOpen(false)}
          onSaved={newSlug => { setUserSlug(newSlug); setSlugModalOpen(false); }} />
      )}
    </Layout>
  );
}
