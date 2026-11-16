import { useEffect, useRef, useState, type ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import { useLocation } from "wouter";
import { Camera, Check, ChevronLeft, ChevronRight, MapPin, Navigation, Pencil, Plus, Star, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick, weekdayNames } from "@/i18n/pick";
import { useToast } from "@/hooks/use-toast";
import {
  DAY_KEYS,
  SHORT_BY_DAY,
  isValidHHMM,
  toMins,
  writeScheduleJson,
  type WeekSchedule,
} from "@/lib/schedule";
import { ONBOARDING_PENDING_KEY, ONBOARDING_READY_KEY } from "@/lib/onboarding";

const DRAFT_KEY = "barber_onboarding_draft";
const STEPS = 7;
const OPEN_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const CLOCK_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const CLOCK_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function splitClock(value: string): [string, string] {
  const [rawHour = "09", rawMinute = "00"] = value.split(":");
  const hour = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.min(55, Math.max(0, Math.round((Number(rawMinute) || 0) / 5) * 5));
  return [String(hour).padStart(2, "0"), String(minute).padStart(2, "0")];
}

type ServiceDraft = {
  key: string;
  name: string;
  duration: number;
  price: number;
  category: string;
  on: boolean;
  custom?: boolean;
  savedId?: string;
};

type Draft = {
  step: number;
  services: ServiceDraft[];
  days: string[];
  workStart: string;
  workEnd: string;
  lunchOn: boolean;
  lunchStart: string;
  lunchEnd: string;
  address: string;
  mapLink: string;
  latitude: string;
  longitude: string;
  phone: string;
  phoneVisible: boolean;
  bio: string;
  avatarUrl: string;
  gallery: string[];
  instagram: string;
  telegram: string;
};

const TEMPLATES: ServiceDraft[] = [
  { key: "soch", name: "Soch olish", duration: 30, price: 50000, category: "Soch", on: false },
  { key: "soqol", name: "Soqol olish", duration: 20, price: 30000, category: "Soqol", on: false },
  { key: "kompleks", name: "Soch va soqol (Kompleks)", duration: 45, price: 70000, category: "Kompleks xizmatlar", on: false },
  { key: "bola", name: "Bolalar sochi", duration: 20, price: 40000, category: "Soch", on: false },
  { key: "yuz", name: "Yuzni tozalash / Maskalar", duration: 25, price: 60000, category: "Yuz parvarishi", on: false },
];

const SALON = [
  { id: "stul", name: "Stul", file: "stul.jpg" },
  { id: "oyna", name: "Oyna", file: "oyna.jpg" },
  { id: "kutish", name: "Kutish joyi", file: "kutish.jpg" },
  { id: "asbob", name: "Asboblar", file: "asbob.jpg" },
];

function templateUrl(file: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/images/salon/${file}`;
}

function token(): string {
  return localStorage.getItem("barber_token") || "";
}

function showPageTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const error = new Error(`${method} ${path} ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

function money(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so‘m`;
}

function cleanHandle(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.)?(instagram\.com|t\.me|telegram\.me)\//i, "");
  s = s.replace(/^@+/, "");
  s = s.split(/[/?#\s]/)[0] || "";
  return /^[A-Za-z0-9._]{2,32}$/.test(s) ? s : "";
}

function loadDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Draft>;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o‘", қ: "q", ғ: "g‘", ҳ: "h",
};

const LAT_DIGRAPHS: [string, string][] = [
  ["shch", "щ"], ["sch", "щ"], ["yu", "ю"], ["ya", "я"], ["zh", "ж"],
  ["ch", "ч"], ["sh", "ш"], ["ts", "ц"], ["kh", "х"],
];

const LAT_TO_CYR: Record<string, string> = {
  a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з",
  ş: "ш", ç: "ч", ğ: "г", ö: "о", ü: "у", ı: "и", ə: "а",
};

function cyrillicToLatin(value: string): string {
  const named = value.replace(/Стамбул/g, "Istanbul").replace(/стамбул/g, "istanbul");
  let out = "";
  for (const ch of named) {
    const lat = CYR_TO_LAT[ch.toLowerCase()];
    if (lat === undefined) {
      out += ch;
      continue;
    }
    out += ch === ch.toLowerCase() ? lat : lat.charAt(0).toUpperCase() + lat.slice(1);
  }
  return out;
}

function latinToCyrillic(value: string): string {
  const named = value.replace(/Istanbul/g, "Стамбул").replace(/istanbul/g, "стамбул");
  let out = "";
  for (let i = 0; i < named.length; i++) {
    const lower = named.slice(i).toLowerCase();
    const pair = LAT_DIGRAPHS.find(([from]) => lower.startsWith(from));
    if (pair) {
      const [from, to] = pair;
      const upper = named[i] !== named[i].toLowerCase();
      out += upper ? to.toUpperCase() : to;
      i += from.length - 1;
      continue;
    }
    const lat = LAT_TO_CYR[lower[0]];
    if (lat === undefined) {
      out += named[i];
      continue;
    }
    out += named[i] === named[i].toLowerCase() ? lat : lat.toUpperCase();
  }
  return out;
}

function matchPlaceScript(value: string, lang: string): string {
  return lang === "ru" ? latinToCyrillic(value) : cyrillicToLatin(value);
}

function shortPlaceName(address: Record<string, string> | undefined, lang: string): string {
  const city = address?.city || address?.town || address?.village || address?.municipality || address?.county || "";
  const area = address?.suburb || address?.neighbourhood || address?.quarter || address?.city_district || "";
  const road = address?.road || address?.pedestrian || address?.footway || "";
  const parts: string[] = [];
  for (const part of [city, area, road]) {
    const clean = part.trim();
    if (!clean || parts.some((item) => item.toLowerCase() === clean.toLowerCase())) continue;
    parts.push(clean);
  }
  return matchPlaceScript(parts.slice(0, 3).join(", "), lang);
}

async function reverseGeocode(lat: number, lng: number, lang: string): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "Accept-Language": lang === "ru" ? "ru" : "uz" } },
    );
    const data = await res.json() as { address?: Record<string, string> };
    return shortPlaceName(data.address, lang) || fallback;
  } catch {
    return fallback;
  }
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function StepName({ title, mark, tone }: { title: string; mark?: string; tone: "need" | "skip" }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h1 className="font-display text-[26px] font-medium leading-tight">{title}</h1>
      {mark && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] leading-5 ${tone === "need" ? "bg-primary/15 font-medium text-primary" : "bg-white/10 font-normal text-muted-foreground"}`}>
          {mark}
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block mt-6">
      <span className="block mb-2 text-[13px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function Onboarding() {
  const { lang } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const saved = useRef(loadDraft());
  const t = (uz: string, ru: string) => pick(lang, uz, ru);

  const [step, setStep] = useState(() => Math.min(STEPS - 1, Math.max(0, saved.current?.step ?? 0)));
  const [services, setServices] = useState<ServiceDraft[]>(() =>
    Array.isArray(saved.current?.services) ? saved.current.services : [],
  );
  const [days, setDays] = useState<string[]>(
    Array.isArray(saved.current?.days) && saved.current.days.length > 0 ? saved.current.days : OPEN_DAYS,
  );
  const [workStart, setWorkStart] = useState(saved.current?.workStart || "09:00");
  const [workEnd, setWorkEnd] = useState(saved.current?.workEnd || "20:00");
  const [lunchOn, setLunchOn] = useState(!!saved.current?.lunchOn);
  const [lunchStart, setLunchStart] = useState(saved.current?.lunchStart || "13:00");
  const [lunchEnd, setLunchEnd] = useState(saved.current?.lunchEnd || "14:00");
  const [address, setAddress] = useState(saved.current?.address || "");
  const [mapLink, setMapLink] = useState(saved.current?.mapLink || "");
  const [latitude, setLatitude] = useState(saved.current?.latitude || "");
  const [longitude, setLongitude] = useState(saved.current?.longitude || "");
  const [phone, setPhone] = useState(saved.current?.phone || "");
  const [phoneVisible, setPhoneVisible] = useState(saved.current?.phoneVisible !== false);
  const [bio, setBio] = useState(saved.current?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(saved.current?.avatarUrl || "");
  const [gallery, setGallery] = useState<string[]>(saved.current?.gallery ?? []);
  const [instagram, setInstagram] = useState(saved.current?.instagram || "");
  const [telegram, setTelegram] = useState(saved.current?.telegram || "");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [clock, setClock] = useState<null | { field: "workStart" | "workEnd" | "lunchStart" | "lunchEnd"; title: string }>(null);
  const stepLock = useRef(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [ready, setReady] = useState<ServiceDraft[]>([]);
  const [sheet, setSheet] = useState<null | { key: string | null; name: string; duration: string; price: string; category: string; fromReady?: boolean }>(null);
  const [drop, setDrop] = useState(false);
  const [placeSaved, setPlaceSaved] = useState(false);
  const placeSavedTimer = useRef<number | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token()) navigate("/register");
    else if (localStorage.getItem(ONBOARDING_PENDING_KEY) !== "1") navigate("/dashboard");
  }, [navigate]);

  useEffect(() => {
    const draft: Draft = {
      step, services, days, workStart, workEnd, lunchOn, lunchStart, lunchEnd,
      address, mapLink, latitude, longitude, phone, phoneVisible, bio, avatarUrl, gallery, instagram, telegram,
    };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore quota */ }
  }, [step, services, days, workStart, workEnd, lunchOn, lunchStart, lunchEnd, address, mapLink, latitude, longitude, phone, phoneVisible, bio, avatarUrl, gallery, instagram, telegram]);

  function warn(title: string) {
    const item = toast({ title, duration: 4000 });
    window.setTimeout(() => item.dismiss(), 4000);
  }

  function applyPlace(lat: number, lng: number, place: string) {
    setLatitude(String(lat));
    setLongitude(String(lng));
    setAddress(place);
    setMapLink(`https://www.google.com/maps?q=${lat},${lng}`);
    setPlaceSaved(true);
    if (placeSavedTimer.current) window.clearTimeout(placeSavedTimer.current);
    placeSavedTimer.current = window.setTimeout(() => setPlaceSaved(false), 2500);
  }

  function locate() {
    if (!navigator.geolocation) {
      setGpsError(t("Telefon joylashuvni ko‘rsata olmaydi", "Телефон не показывает местоположение"));
      return;
    }
    setGpsBusy(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, lang);
        applyPlace(pos.coords.latitude, pos.coords.longitude, place);
        setGpsBusy(false);
      },
      () => {
        setGpsBusy(false);
        setGpsError(t("Joylashuvni aniqlab bo‘lmadi", "Не удалось определить местоположение"));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function saveServices() {
    const chosen = services.filter((item) => item.on && item.name.trim());
    const seeded = await api("/api/categories/seed", "POST", {});
    const byName = new Map<string, string>();
    for (const cat of (seeded.categories || []) as { id: string; name: string }[]) byName.set(cat.name, cat.id);
    async function ensure(name: string) {
      const found = byName.get(name);
      if (found) return found;
      const created = await api("/api/categories", "POST", { name }) as { id: string };
      byName.set(name, created.id);
      return created.id;
    }
    const next = [...services];
    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (!item.on || !item.name.trim()) continue;
      const categoryId = await ensure(item.category?.trim() || "Asosiy");
      const body = { name: item.name.trim(), duration: Number(item.duration), price: Number(item.price), categoryId };
      let savedId = item.savedId;
      if (savedId) {
        try {
          await api(`/api/services/${savedId}`, "PUT", body);
        } catch (err) {
          const status = (err as { status?: number }).status;
          const foreign = status === 404 || (status === 500 && !/^[0-9a-f-]{36}$/i.test(savedId));
          if (!foreign) throw err;
          savedId = undefined;
        }
      }
      if (!savedId) {
        const created = await api("/api/services", "POST", body) as { id: string };
        savedId = created.id;
      }
      next[i] = { ...item, savedId };
      setServices([...next]);
    }
  }

  async function saveHours() {
    const week = {} as WeekSchedule;
    for (const key of DAY_KEYS) {
      const open = days.includes(SHORT_BY_DAY[key]);
      week[key] = { enabled: open, start: workStart, end: workEnd };
    }
    await api("/api/settings/profile", "PUT", {
      workingHoursStart: workStart,
      workingHoursEnd: workEnd,
      scheduleJson: writeScheduleJson(week),
      lunchBreakEnabled: lunchOn,
      lunchBreakStart: lunchStart,
      lunchBreakEnd: lunchEnd,
    });
  }

  function saveClock(value: string) {
    if (!clock) return;
    if (clock.field === "workStart") setWorkStart(value);
    if (clock.field === "workEnd") setWorkEnd(value);
    if (clock.field === "lunchStart") setLunchStart(value);
    if (clock.field === "lunchEnd") setLunchEnd(value);
    setClock(null);
  }

  async function goNext() {
    if (busy || stepLock.current) return;
    if (step === 0) {
      const chosen = services.filter((item) => item.on && item.name.trim());
      if (chosen.length === 0) {
        warn(t("Davom etish uchun kamida bitta xizmat tanlang yoki yangisini qo‘shing", "Чтобы продолжить, выберите хотя бы одну услугу или добавьте свою"));
        return;
      }
      if (chosen.some((item) => item.duration < 5 || item.price < 0)) {
        warn(t("Vaqt va narxni to‘g‘ri yozing", "Укажите время и цену"));
        return;
      }
      stepLock.current = true;
      setStep(1);
      showPageTop();
      saveServices().catch(() => warn(t("Saqlanmadi. Qayta urinib ko‘ring", "Не сохранилось. Попробуйте ещё раз"))).finally(() => {
        stepLock.current = false;
      });
      return;
    }
    if (step === 1) {
      if (days.length === 0 || !isValidHHMM(workStart) || !isValidHHMM(workEnd) || toMins(workStart) >= toMins(workEnd)) {
        warn(t("Oldin shu majburiy oynani to‘ldiring", "Сначала заполните этот обязательный экран"));
        return;
      }
      if (lunchOn && (!isValidHHMM(lunchStart) || !isValidHHMM(lunchEnd) || toMins(lunchStart) >= toMins(lunchEnd) || toMins(lunchStart) < toMins(workStart) || toMins(lunchEnd) > toMins(workEnd))) {
        warn(t("Tushlik ish vaqti ichida bo‘lsin", "Обед должен быть внутри рабочего времени"));
        return;
      }
      stepLock.current = true;
      setStep(2);
      showPageTop();
      saveHours().catch(() => warn(t("Saqlanmadi. Qayta urinib ko‘ring", "Не сохранилось. Попробуйте ещё раз"))).finally(() => {
        stepLock.current = false;
      });
      return;
    }
    setBusy(true);
    let moved = false;
    try {
      if (step === 2 && (address.trim() || mapLink.trim() || latitude)) {
        const link = mapLink.trim();
        const mapLinkValue = /^https?:\/\//i.test(link) || !link ? link : (link.includes(".") ? `https://${link}` : link);
        await api("/api/settings/profile", "PUT", {
          address: address.trim(),
          mapLink: mapLinkValue,
          latitude: latitude || null,
          longitude: longitude || null,
        });
      }
      if (step === 3 && (phone.trim() || phoneVisible === false)) {
        await api("/api/settings/profile", "PUT", { phone: phone.trim(), phoneVisible });
      }
      if (step === 4 && bio.trim()) {
        await api("/api/settings/profile", "PUT", { bio: bio.trim() });
      }
      if (step === 5 && (avatarUrl || gallery.length > 0)) {
        await api("/api/settings/profile", "PUT", { avatarUrl, galleryImages: JSON.stringify(gallery) });
      }
      if (step === 6) {
        const ig = cleanHandle(instagram);
        const tg = cleanHandle(telegram);
        if (ig || tg) {
          await api("/api/settings/profile", "PUT", {
            ...(ig ? { instagram: ig } : {}),
            ...(tg ? { telegramUsername: tg } : {}),
          });
        }
        localStorage.removeItem(ONBOARDING_PENDING_KEY);
        sessionStorage.removeItem(DRAFT_KEY);
        sessionStorage.setItem(ONBOARDING_READY_KEY, "1");
        navigate("/settings/page");
        return;
      }
      setStep((n) => n + 1);
      moved = true;
    } catch {
      warn(t("Saqlanmadi. Qayta urinib ko‘ring", "Не сохранилось. Попробуйте ещё раз"));
    } finally {
      setBusy(false);
    }
    if (moved) showPageTop();
  }

  async function onAvatar(file?: File) {
    if (!file) return;
    try { setAvatarUrl(await readImage(file)); } catch { warn(t("Rasm ochilmadi", "Фото не открылось")); }
  }

  async function onGallery(file?: File) {
    if (!file) return;
    if (gallery.length >= 5) {
      warn(t("5 ta rasm to‘lgan. Avval bittasini olib tashlang", "Уже 5 фото. Сначала уберите одно"));
      return;
    }
    try {
      const url = await readImage(file);
      setGallery((list) => list.length >= 5 ? list : [...list, url]);
    } catch {
      warn(t("Rasm ochilmadi", "Фото не открылось"));
    }
  }

  function addTemplate(file: string) {
    const url = templateUrl(file);
    if (gallery.includes(url)) {
      setTemplatesOpen(false);
      return;
    }
    if (gallery.length >= 5) {
      warn(t("5 ta rasm to‘lgan. Avval bittasini olib tashlang", "Уже 5 фото. Сначала уберите одно"));
      return;
    }
    setGallery((list) => [...list, url]);
    setTemplatesOpen(false);
  }

  function openReady() {
    setReady(TEMPLATES.map((item) => ({ ...item, on: false })));
    setReadyOpen(true);
  }

  function saveReady() {
    const picked = ready.filter((item) => item.on && item.name.trim());
    if (picked.length === 0) return;
    setServices((list) => {
      const next = [...list];
      for (const item of picked) {
        const index = next.findIndex((row) => row.key === item.key);
        if (index >= 0) next[index] = { ...next[index], name: item.name, duration: item.duration, price: item.price, category: item.category, on: true };
        else next.push({ ...item, on: true });
      }
      return next;
    });
    setReadyOpen(false);
  }

  function saveSheet() {
    if (!sheet) return;
    const name = sheet.name.trim();
    const duration = Number(sheet.duration);
    const price = Number(String(sheet.price).replace(/\s/g, ""));
    if (!name || !Number.isFinite(duration) || duration < 5 || !Number.isFinite(price) || price < 0) {
      warn(t("Nom, vaqt va narxni to‘ldiring", "Заполните название, время и цену"));
      return;
    }
    if (sheet.key && sheet.fromReady) {
      setReady((list) => list.map((item) => item.key === sheet.key ? { ...item, name, duration, price } : item));
    } else if (sheet.key) {
      setServices((list) => list.map((item) => item.key === sheet.key ? { ...item, name, duration, price, on: true } : item));
    } else {
      setServices((list) => [...list, {
        key: `custom-${Date.now()}`,
        name,
        duration,
        price,
        category: "Asosiy",
        on: true,
        custom: true,
      }]);
    }
    setSheet(null);
  }

  function removeService() {
    if (!sheet?.key || sheet.fromReady) return;
    const current = services.find((item) => item.key === sheet.key);
    if (!current) return;
    setServices((list) => list.filter((item) => item.key !== current.key));
    setDrop(false);
    setSheet(null);
    if (!current.savedId) return;
    api(`/api/services/${current.savedId}`, "DELETE").catch(() => {
      setServices((list) => (list.some((item) => item.key === current.key) ? list : [...list, current]));
      warn(t("O‘chirilmadi. Qayta urinib ko‘ring", "Не удалось удалить. Попробуйте ещё раз"));
    });
  }

  const optional = step >= 2;
  const savedServices = services.filter((item) => item.on && item.name.trim());
  const readyPicked = ready.filter((item) => item.on).length;
  const names = weekdayNames(lang);
  const stepMark = optional ? t("Ixtiyoriy", "Необязательно") : t("Majburiy", "Обязательно");
  const stepTone = optional ? "skip" as const : "need" as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-4 pb-8">
        <header className={`sticky top-0 z-20 bg-background/95 backdrop-blur-sm ${step <= 2 ? "pt-4" : ""}`}>
          {step > 2 && (
            <div className="h-11 flex items-center justify-end">
              <button type="button" onClick={goNext} disabled={busy} className="h-11 px-1 text-primary text-base font-medium disabled:opacity-100">
                {busy ? t("Saqlanmoqda...", "Сохраняется...") : t("Keyingi", "Далее")}
              </button>
            </div>
          )}
          <div className="flex gap-1.5 pb-3">
            {Array.from({ length: STEPS }, (_, i) => (
              <i key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-zinc-700"}`} />
            ))}
          </div>
        </header>

        {step === 0 && (
          <section className="flex flex-1 flex-col min-h-[calc(100dvh-6.5rem)]">
            <StepName
              title={savedServices.length > 0 ? t("Saqlangan xizmatlar", "Сохранённые услуги") : t("Xizmatlarni qo‘shing", "Добавьте услуги")}
              mark={savedServices.length > 0 ? undefined : stepMark}
              tone={stepTone}
            />
            {savedServices.length > 0 && (
              <p className="mt-1.5 text-sm text-muted-foreground">{savedServices.length} {t("ta", "шт.")}</p>
            )}
            {savedServices.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center px-2">
                <h2 className="font-display text-[26px] font-medium leading-tight">{t("Hali xizmat yo‘q", "Услуг пока нет")}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-snug">
                  {t("Mijozlaringiz bron qilishi uchun kamida bitta xizmat qo‘shing yoki pastdagi tayyor ro‘yxatdan foydalaning", "Добавьте хотя бы одну услугу для записи или выберите готовый список внизу.")}
                </p>
              </div>
            ) : (
              <div className="mt-4 flex-1 space-y-2">
                {savedServices.map((item) => (
                  <div key={item.key} className="flex items-center gap-1 rounded-2xl border border-white/10 bg-card px-1.5 py-1">
                    <span className="h-11 w-11 shrink-0 flex items-center justify-center" aria-hidden="true">
                      <span className="h-6 w-6 rounded-lg bg-primary border border-primary text-black flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.duration} {t("daqiqa", "мин")} · {money(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheet({ key: item.key, name: item.name, duration: String(item.duration), price: String(item.price), category: item.category })}
                      className="h-11 px-2 text-sm text-primary"
                    >
                      {t("Tahrir", "Изменить")}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-2 pb-4">
              <button
                type="button"
                onClick={() => setSheet({ key: null, name: "", duration: "30", price: "", category: "Asosiy" })}
                className="h-12 w-full rounded-2xl border border-primary/30 text-sm font-medium"
              >
                <Plus className="inline w-4 h-4 mr-1 -mt-0.5" /> {t("Yangi xizmat qo‘shish", "Добавить услугу")}
              </button>
              <button
                type="button"
                onClick={openReady}
                className="h-12 w-full rounded-2xl border border-primary/30 text-sm font-medium"
              >
                <Plus className="inline w-4 h-4 mr-1 -mt-0.5" /> {t("Tayyor ro‘yxatni qo‘shish", "Добавить готовый список")}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                className={`h-12 w-full rounded-xl text-base font-medium disabled:opacity-100 ${savedServices.length > 0 ? "bg-primary text-black" : "border border-white/15 text-muted-foreground"}`}
              >
                {t("Keyingi", "Далее")}
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col min-h-[calc(100dvh-6.5rem)]">
            <StepName title={t("Ish kunlari va vaqti", "Рабочие дни и время")} mark={stepMark} tone={stepTone} />
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Ish kunlari va vaqtlarini sozlang. Tushlik vaqtini qo‘shish ixtiyoriy. Dam olish kunini shunchaki bosib yopib qo‘ying.", "Настройте рабочие дни и часы. Обед можно не добавлять. Выходной день просто нажмите и закройте.")}</p>
            <div className="mt-5 flex flex-nowrap gap-1">
              {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((key, i) => {
                const on = days.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays((list) => on ? list.filter((d) => d !== key) : [...list, key])}
                    className={`h-11 min-w-0 flex-1 rounded-xl text-sm font-medium border ${on ? "bg-primary text-black border-primary" : "border-white/10 text-muted-foreground"}`}
                  >
                    {names[i]}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Field label={t("Ochilish", "Открытие")}>
                <button type="button" onClick={() => setClock({ field: "workStart", title: t("Ochilish", "Открытие") })} className="h-12 w-full rounded-xl bg-card border border-white/10 px-3 text-center">{workStart}</button>
              </Field>
              <Field label={t("Yopilish", "Закрытие")}>
                <button type="button" onClick={() => setClock({ field: "workEnd", title: t("Yopilish", "Закрытие") })} className="h-12 w-full rounded-xl bg-card border border-white/10 px-3 text-center">{workEnd}</button>
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm">{t("Tushlik", "Обед")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={lunchOn}
                onClick={() => setLunchOn((v) => !v)}
                className={`relative shrink-0 overflow-hidden rounded-full p-0 ${lunchOn ? "bg-primary" : "bg-white/15"}`}
                style={{ width: 48, height: 28 }}
              >
                <span
                  className="absolute rounded-full bg-white"
                  style={{ top: 2, width: 24, height: 24, left: lunchOn ? 22 : 2 }}
                />
              </button>
            </div>
            {lunchOn && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setClock({ field: "lunchStart", title: t("Tushlik boshi", "Начало обеда") })} className="h-12 rounded-xl bg-card border border-white/10 px-3 text-center">{lunchStart}</button>
                <button type="button" onClick={() => setClock({ field: "lunchEnd", title: t("Tushlik oxiri", "Конец обеда") })} className="h-12 rounded-xl bg-card border border-white/10 px-3 text-center">{lunchEnd}</button>
              </div>
            )}
            <div className="mt-auto pt-6 flex gap-2">
              <button type="button" onClick={() => setStep(0)} className="h-12 w-[148px] shrink-0 rounded-xl border border-white/15 text-base font-medium flex items-center justify-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                {t("Orqaga", "Назад")}
              </button>
              <button type="button" onClick={goNext} disabled={busy} className={`h-12 flex-1 rounded-xl text-base font-medium flex items-center justify-center gap-2 disabled:opacity-100 ${days.length > 0 ? "bg-primary text-black" : "border border-white/15 text-muted-foreground"}`}>
                {t("Keyingi", "Далее")}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col min-h-[calc(100dvh-6.5rem)]">
            <StepName title={t("Manzil", "Адрес")} mark={stepMark} tone={stepTone} />
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Mijozlaringiz manzilingizni oson topishi uchun joylashuvingizni kiriting.", "Введите место, чтобы клиенты легко вас нашли.")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMapOpen(true)} className="h-24 rounded-2xl border border-primary/30 bg-card flex flex-col items-center justify-center gap-2 text-sm">
                <MapPin className="w-5 h-5 text-primary" />
                {t("Xaritadan tanlash", "Выбрать на карте")}
              </button>
              <button type="button" onClick={locate} disabled={gpsBusy} className="h-24 rounded-2xl border border-primary/30 bg-card flex flex-col items-center justify-center gap-2 text-sm disabled:opacity-60">
                <Navigation className="w-5 h-5 text-primary" />
                {gpsBusy ? t("Aniqlanmoqda...", "Определяется...") : t("Joylashuvimni aniqlash", "Определить моё место")}
              </button>
            </div>
            {gpsError && <p className="mt-2 text-sm text-destructive">{gpsError}</p>}
            <label className="block mt-6">
              <span className="block mb-2 text-[13px] text-muted-foreground">{t("Joy nomi", "Название места")}</span>
              <span className={`h-12 flex items-center rounded-xl bg-card border pr-1 ${placeSaved ? "border-primary" : "border-white/10"}`}>
                <input
                  ref={addressRef}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("Tuzla, Postane, Manastır Yolu", "Тузла, Постане, Манастир Йолу")}
                  className="h-12 min-w-0 flex-1 bg-transparent px-3 outline-none"
                />
                <button type="button" aria-label={t("Tahrir", "Изменить")} onClick={() => addressRef.current?.focus()} className="h-11 w-11 shrink-0 text-primary flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </button>
              </span>
            </label>
            <Field label={t("Xarita havolasi", "Ссылка на карту")}>
              <input readOnly value={mapLink} placeholder="https://www.google.com/maps?q=" className={`h-12 w-full rounded-xl bg-card border px-3 text-muted-foreground ${placeSaved ? "border-primary" : "border-white/10"}`} />
            </Field>
            {placeSaved && (
              <p className="mt-3 text-center text-[15px] font-semibold">{t("Manzil saqlandi ✅", "Адрес сохранён ✅")}</p>
            )}
            <div className="mt-auto pt-6 flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="h-12 w-[148px] shrink-0 rounded-xl border border-white/15 text-base font-medium flex items-center justify-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                {t("Orqaga", "Назад")}
              </button>
              <button type="button" onClick={goNext} className="h-12 flex-1 rounded-xl bg-primary text-black text-base font-medium flex items-center justify-center gap-2">
                {t("Keyingi", "Далее")}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <StepName title={t("Telefon", "Телефон")} mark={stepMark} tone={stepTone} />
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Mijoz qo‘ng‘iroq qila oladi. Ko‘rsatishni o‘zingiz yoqasiz.", "Клиент сможет позвонить. Показ включаете вы.")}</p>
            <Field label={t("Telefon raqam", "Номер телефона")}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+998" className="h-12 w-full rounded-xl bg-card border border-white/10 px-3" />
            </Field>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm">{t("Mijozga ko‘rinsin", "Показывать клиенту")}</span>
              <button type="button" aria-pressed={phoneVisible} onClick={() => setPhoneVisible((v) => !v)} className={`h-7 w-12 rounded-full relative ${phoneVisible ? "bg-primary" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${phoneVisible ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <StepName title={t("Tavsif", "Описание")} mark={stepMark} tone={stepTone} />
            <Field label={t("Tavsif (BIO)", "Описание (BIO)")}>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="Masalan: 3yillik tajriba ga ega Barber. Soch, soqol ustasi."
                className="w-full rounded-xl bg-card border border-white/10 px-3 py-3 resize-none"
              />
            </Field>
          </section>
        )}

        {step === 5 && (
          <section>
            <StepName title={t("Profil va ish joyi rasmlari", "Фото профиля и рабочего места")} mark={stepMark} tone={stepTone} />
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Mijozlar ishonchini oshirish uchun o‘zingiz va ishxonangiz rasmini qo‘shing. Keyinroq ham o‘zgartirish mumkin.", "Добавьте своё фото и фото места работы. Позже можно изменить.")}</p>
            <p className="mt-5 text-[13px] text-muted-foreground">{t("Profil rasmi (Yuzingiz)", "Фото профиля")}</p>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={() => avatarRef.current?.click()} className="h-20 w-20 rounded-full border border-primary overflow-hidden bg-card flex items-center justify-center shrink-0">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <Camera className="w-5 h-5 text-primary" />}
              </button>
              <div>
                <p className="text-sm font-medium">{t("Yuz rasmini yuklash", "Загрузить фото лица")}</p>
                <p className="text-[13px] text-muted-foreground mt-1">{t("Aniq va tabassumli rasm tavsiya etiladi.", "Лучше чёткое фото с улыбкой.")}</p>
                <button type="button" onClick={() => avatarRef.current?.click()} className="mt-2 h-9 px-3 rounded-xl border border-primary/30 bg-card text-[13px]">{t("Rasmni tanlash", "Выбрать фото")}</button>
              </div>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onAvatar(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="mt-6 flex items-center justify-between text-[13px]">
              <span>{t("Ish joyi rasmlari (Limit 5 rasm)", "Фото рабочего места (до 5)")}</span>
              <span className="text-muted-foreground">{gallery.length}/5</span>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((src, i) => (
                <div key={`${src}-${i}`} className="w-[132px] shrink-0">
                  <div className="relative h-28 rounded-t-xl overflow-hidden border border-primary/30 border-b-0">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" aria-label={t("Olib tashlash", "Убрать")} onClick={() => setGallery((list) => list.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGallery((list) => [list[i], ...list.filter((_, j) => j !== i)])}
                    className={`h-9 w-full rounded-b-xl border border-primary/30 text-xs flex items-center justify-center gap-1 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <Star className={`w-3 h-3 ${i === 0 ? "fill-primary" : ""}`} />
                    {i === 0 ? t("Muqova", "Обложка") : t("Muqova qilish", "Сделать обложкой")}
                  </button>
                </div>
              ))}
              {gallery.length < 5 && (
                <button type="button" onClick={() => galleryRef.current?.click()} className="h-[148px] w-28 shrink-0 rounded-xl border border-primary/30 text-primary text-2xl">+</button>
              )}
            </div>
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onGallery(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => setTemplatesOpen(true)} className="mt-4 h-11 w-full rounded-full border border-primary/30 bg-card text-sm">
              {t("Tayyor salon shablonlaridan tanlash", "Выбрать готовый шаблон салона")}
            </button>
          </section>
        )}

        {step === 6 && (
          <section>
            <StepName title={t("Ijtimoiy tarmoq", "Соцсеть")} mark={stepMark} tone={stepTone} />
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Mijozlaringiz sizni topishi va ishlaringizni ko‘rishi uchun profillaringizni qo‘shish tavsiya qilinadi.", "Добавьте профили, чтобы клиенты могли найти вас и увидеть работы.")}</p>
            <SocialField label="Instagram" value={instagram} onChange={setInstagram} placeholder="instagram.com/..." ok={!!cleanHandle(instagram)} mark="ig" />
            <SocialField label="Telegram" value={telegram} onChange={setTelegram} placeholder="t.me/..." ok={!!cleanHandle(telegram)} mark="tg" />
            <button type="button" onClick={goNext} className="mt-8 h-12 w-full rounded-xl bg-primary text-black font-medium">
              {busy ? t("Saqlanmoqda...", "Сохраняется...") : t("Keyingi", "Далее")}
            </button>
          </section>
        )}
      </div>

      {readyOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setReadyOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card border-t border-primary/30 px-4 pt-3 pb-4 max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-zinc-700 mx-auto mb-3" />
            <h2 className="font-display text-xl font-medium">{t("Tayyor ro‘yxat", "Готовый список")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Xizmatni tanlang", "Выберите услугу")}</p>
            <div className="mt-2 space-y-2 overflow-y-auto">
              {ready.map((item) => (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={item.on}
                  onClick={() => setReady((list) => list.map((row) => row.key === item.key ? { ...row, on: !row.on } : row))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setReady((list) => list.map((row) => row.key === item.key ? { ...row, on: !row.on } : row));
                  }}
                  className="flex items-center gap-1 rounded-2xl border border-white/10 bg-background px-1.5 py-1 cursor-pointer"
                >
                  <span className="h-11 w-11 shrink-0 flex items-center justify-center" aria-hidden="true">
                    <span className={`h-6 w-6 rounded-lg border flex items-center justify-center ${item.on ? "bg-primary border-primary text-black" : "border-white/25"}`}>
                      {item.on && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 py-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.duration} {t("daqiqa", "мин")} · {money(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheet({ key: item.key, name: item.name, duration: String(item.duration), price: String(item.price), category: item.category, fromReady: true });
                    }}
                    className="h-11 px-2 text-sm text-primary"
                  >
                    {t("Tahrir", "Изменить")}
                  </button>
                </div>
              ))}
            </div>
            {readyPicked > 0 && (
              <button type="button" onClick={saveReady} className="mt-3 h-12 w-full shrink-0 rounded-xl bg-primary text-black font-medium">
                {t("Xizmatni saqlash", "Сохранить услугу")}
              </button>
            )}
          </div>
        </div>
      )}

      {sheet && !drop && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card border-t border-primary/30 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl">{sheet.key ? t("Xizmatni tahrirlash", "Изменить услугу") : t("Yangi xizmat", "Новая услуга")}</h2>
            <Field label={t("Nomi", "Название")}>
              <input value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} className="h-12 w-full rounded-xl bg-background border border-white/10 px-3" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Daqiqa", "Минуты")}>
                <input inputMode="numeric" value={sheet.duration} onChange={(e) => setSheet({ ...sheet, duration: e.target.value })} className="h-12 w-full rounded-xl bg-background border border-white/10 px-3" />
              </Field>
              <Field label={t("Narx, so‘m", "Цена, сум")}>
                <input inputMode="numeric" value={sheet.price} onChange={(e) => setSheet({ ...sheet, price: e.target.value })} className="h-12 w-full rounded-xl bg-background border border-white/10 px-3" />
              </Field>
            </div>
            <button type="button" onClick={saveSheet} className="mt-5 h-12 w-full rounded-xl bg-primary text-black font-medium">{sheet.key ? t("Saqlash", "Сохранить") : t("Qo‘shish", "Добавить")}</button>
            {sheet.key && !sheet.fromReady && (
              <button type="button" onClick={() => setDrop(true)} className="mt-2 h-12 w-full text-base font-medium text-rose-400">
                {t("O‘chirish", "Удалить")}
              </button>
            )}
          </div>
        </div>
      )}

      {drop && sheet && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6" onClick={() => setDrop(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-white/10 px-4 pt-5 pb-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-medium leading-snug">
              {t(`${sheet.name.trim() || "Xizmat"} o‘chirilsinmi?`, `Удалить «${sheet.name.trim() || "услугу"}»?`)}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{t("Bu xizmat ro‘yxatdan olib tashlanadi.", "Услуга исчезнет из списка.")}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setDrop(false)} className="h-12 flex-1 rounded-xl border border-white/15 text-base font-medium">
                {t("Bekor qilish", "Отмена")}
              </button>
              <button type="button" onClick={removeService} className="h-12 flex-1 rounded-xl bg-rose-600 text-white text-base font-medium">
                {t("O‘chirish", "Удалить")}
              </button>
            </div>
          </div>
        </div>
      )}

      {templatesOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setTemplatesOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card border-t border-primary/30 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl">{t("Tayyor salon rasmlari", "Готовые фото салона")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Birini tanlasangiz, ish joyi rasmlariga qo‘shiladi.", "Выбранное фото добавится к фото рабочего места.")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SALON.map((item) => (
                <button key={item.id} type="button" onClick={() => addTemplate(item.file)} className="text-left">
                  <img src={templateUrl(item.file)} alt={item.name} className="h-32 w-full object-cover rounded-xl border border-primary/30" />
                  <span className="block mt-1 text-sm">{item.name}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setTemplatesOpen(false)} className="mt-4 h-11 w-full rounded-xl border border-primary/30">{t("Yopish", "Закрыть")}</button>
          </div>
        </div>
      )}

      {clock && (
        <ClockSheet
          title={clock.title}
          value={clock.field === "workStart" ? workStart : clock.field === "workEnd" ? workEnd : clock.field === "lunchStart" ? lunchStart : lunchEnd}
          hourLabel={t("Soat", "Час")}
          minuteLabel={t("Daqiqa", "Минута")}
          saveLabel={t("Tayyor", "Готово")}
          onClose={() => setClock(null)}
          onSave={saveClock}
        />
      )}

      {mapOpen && (
        <MapSheet
          lang={lang}
          lat={latitude ? Number(latitude) : 41.2995}
          lng={longitude ? Number(longitude) : 69.2401}
          title={t("Manzilni xaritadan tanlang", "Выберите адрес на карте")}
          saveLabel={t("Saqlash", "Сохранить")}
          onClose={() => setMapOpen(false)}
          onSave={(lat, lng, place) => {
            applyPlace(lat, lng, place);
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SocialField({
  label, value, onChange, placeholder, ok, mark,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ok: boolean;
  mark: "ig" | "tg";
}) {
  return (
    <label className="block mt-6">
      <span className="block mb-2 text-[13px] text-muted-foreground">{label}</span>
      <span className={`h-12 flex items-center gap-2 rounded-xl bg-card border px-3 ${ok ? "border-primary/40" : "border-white/10"}`}>
        {mark === "ig" ? <InstagramMark /> : <TelegramMark />}
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 min-w-0 bg-transparent outline-none" />
        {ok && <Check className="w-4 h-4 text-emerald-400" />}
      </span>
    </label>
  );
}

function InstagramMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="ig" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0" stopColor="#f9ce34" />
          <stop offset="0.5" stopColor="#ee2a7b" />
          <stop offset="1" stopColor="#6228d7" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#ig)" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="url(#ig)" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1" fill="url(#ig)" />
    </svg>
  );
}

function TelegramMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#2AABEE" />
      <path d="M7.2 12.1l9.2-3.6c.4-.2.8.2.7.6l-1.6 7.4c-.1.5-.6.7-1 .4l-2.6-1.9-1.3 1.2c-.2.2-.5.1-.5-.2l.2-2.2 4.8-4.3c.2-.2 0-.3-.2-.1l-5.9 3.7-2.1-.7c-.5-.1-.5-.7.1-.9z" fill="#fff" />
    </svg>
  );
}

function ClockWheel({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  useEffect(() => {
    if (placed.current) return;
    const box = ref.current;
    const item = box?.querySelector(`[data-v="${selected}"]`) as HTMLElement | null;
    if (!box || !item) return;
    placed.current = true;
    box.scrollTop = item.offsetTop - box.clientHeight / 2 + item.offsetHeight / 2;
  }, [selected]);

  return (
    <div
      ref={ref}
      className="h-48 flex-1 overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]"
      onScroll={(event) => {
        const box = event.currentTarget;
        const mid = box.scrollTop + box.clientHeight / 2;
        let best = values[0];
        let dist = Number.POSITIVE_INFINITY;
        for (const node of box.querySelectorAll("button")) {
          const next = Math.abs(node.offsetTop + node.offsetHeight / 2 - mid);
          if (next < dist) {
            dist = next;
            best = node.dataset.v || best;
          }
        }
        if (best !== selected) onSelect(best);
      }}
    >
      <div className="h-[72px]" />
      {values.map((value) => (
        <button
          key={value}
          type="button"
          data-v={value}
          onClick={() => onSelect(value)}
          className={`h-12 w-full snap-center text-2xl font-medium ${value === selected ? "text-foreground" : "text-muted-foreground"}`}
        >
          {value}
        </button>
      ))}
      <div className="h-[72px]" />
    </div>
  );
}

function ClockSheet({
  title,
  value,
  hourLabel,
  minuteLabel,
  saveLabel,
  onClose,
  onSave,
}: {
  title: string;
  value: string;
  hourLabel: string;
  minuteLabel: string;
  saveLabel: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [hour, minute] = splitClock(value);
  const [pickedHour, setHour] = useState(hour);
  const [pickedMinute, setMinute] = useState(minute);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card border-t border-primary/30 px-4 pt-3 pb-4" onClick={(event) => event.stopPropagation()}>
        <div className="w-9 h-1 rounded-full bg-zinc-700 mx-auto mb-3" />
        <h2 className="font-display text-xl font-medium">{title}</h2>
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <p className="mb-1 text-center text-[13px] text-muted-foreground">{hourLabel}</p>
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-12 -translate-y-1/2 rounded-xl bg-white/8" />
              <div className="relative z-10">
                <ClockWheel values={CLOCK_HOURS} selected={pickedHour} onSelect={setHour} />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-center text-[13px] text-muted-foreground">{minuteLabel}</p>
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-12 -translate-y-1/2 rounded-xl bg-white/8" />
              <div className="relative z-10">
                <ClockWheel values={CLOCK_MINUTES} selected={pickedMinute} onSelect={setMinute} />
              </div>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => onSave(`${pickedHour}:${pickedMinute}`)} className="mt-3 h-12 w-full rounded-xl bg-primary text-black font-medium">
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function MapSheet({
  lang, lat, lng, title, saveLabel, onClose, onSave,
}: {
  lang: string;
  lat: number;
  lng: number;
  title: string;
  saveLabel: string;
  onClose: () => void;
  onSave: (lat: number, lng: number, address: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<{ getLatLng: () => { lat: number; lng: number } } | null>(null);
  const [place, setPlace] = useState("");

  useEffect(() => {
    let destroyed = false;
    let map: { remove: () => void } | null = null;
    import("leaflet").then(async (mod) => {
      const L = mod.default;
      if (destroyed || !mapRef.current) return;
      const iconBase = "https://unpkg.com/leaflet@1.9.4/dist/images/";
      // @ts-expect-error leaflet private field
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: iconBase + "marker-icon-2x.png",
        iconUrl: iconBase + "marker-icon.png",
        shadowUrl: iconBase + "marker-shadow.png",
      });
      const created = L.map(mapRef.current).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(created);
      const marker = L.marker([lat, lng], { draggable: true }).addTo(created);
      markerRef.current = marker;
      map = created;
      const show = async (la: number, ln: number) => {
        const text = await reverseGeocode(la, ln, lang);
        if (!destroyed) setPlace(text);
      };
      show(lat, lng);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        show(pos.lat, pos.lng);
      });
      created.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        show(e.latlng.lat, e.latlng.lng);
      });
    });
    return () => {
      destroyed = true;
      map?.remove();
    };
  }, [lang, lat, lng]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10">
        <button type="button" onClick={onClose} className="h-10 w-10 rounded-xl border border-white/10"><X className="w-4 h-4 mx-auto" /></button>
        <p className="flex-1 text-sm font-medium truncate">{place || title}</p>
        <button
          type="button"
          onClick={() => {
            const pos = markerRef.current?.getLatLng();
            if (pos) onSave(pos.lat, pos.lng, place);
          }}
          className="h-10 px-3 rounded-xl bg-primary text-black text-sm font-medium"
        >
          {saveLabel}
        </button>
      </div>
      <div ref={mapRef} className="flex-1" />
    </div>
  );
}
