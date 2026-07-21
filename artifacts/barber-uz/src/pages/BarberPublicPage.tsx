import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, MapPin, Instagram, Phone, X, ArrowLeft } from "lucide-react";

interface BarberData {
  id: string;
  name: string;
  brandName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
  phoneVisible: boolean;
  specializations: string | null;
  mode: string;
  lang: string;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  scheduleJson: string | null;
  lunchBreakEnabled: boolean;
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
  telegramUsername: string | null;
  username: string;
  address: string | null;
  mapLink: string | null;
  latitude: string | null;
  longitude: string | null;
  instagram: string | null;
  galleryImages: string | null;
  services: Array<{
    id: string;
    name: string;
    nameRu: string | null;
    duration: number;
    price: number;
  }>;
}

function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

function osmEmbedUrl(lat: string, lng: string): string {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  const delta = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lo - delta},${la - delta},${lo + delta},${la + delta}&layer=mapnik&marker=${la},${lo}`;
}

function mapsHref(lat: string, lng: string, mapLink: string | null): string {
  if (mapLink && /^https?:\/\//i.test(mapLink)) return mapLink;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = {
  mon: "Du", tue: "Se", wed: "Ch", thu: "Pa", fri: "Ju", sat: "Sh", sun: "Ya",
};

function formatDur(n: number) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  return m > 0 ? `${h}s ${m}m` : `${h} soat`;
}

function formatPrice(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function toMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function generatePublicSlots(duration: number, barber: BarberData): string[] {
  const start = toMins(barber.workingHoursStart || "09:00");
  const end = toMins(barber.workingHoursEnd || "20:00");
  const busy: { s: number; e: number }[] = [];
  if (barber.lunchBreakEnabled && barber.lunchBreakStart && barber.lunchBreakEnd) {
    busy.push({ s: toMins(barber.lunchBreakStart), e: toMins(barber.lunchBreakEnd) });
  }
  const slots: string[] = [];
  for (let t = start; t + duration <= end; t += 30) {
    const slotEnd = t + duration;
    if (!busy.some(b => t < b.e && slotEnd > b.s)) {
      slots.push(fmtTime(t));
    }
  }
  return slots;
}

type PubBookingStep = "time" | "name" | "confirm" | "verifying" | "done";

function PublicBookingModal({
  barber, selectedServices, totalDuration, totalPrice, onClose
}: {
  barber: BarberData;
  selectedServices: BarberData["services"];
  totalDuration: number;
  totalPrice: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<PubBookingStep>("time");
  const [dateOpt, setDateOpt] = useState<"today" | "tomorrow">("today");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const displayName = barber.brandName || barber.name;
  const dateLabel = dateOpt === "today" ? "Bugun" : "Ertaga";
  const slots = generatePublicSlots(totalDuration, barber);

  async function handleConfirm() {
    if (submitting || !selectedTime || !clientName.trim()) return;
    setSubmitting(true);

    try {
      const services = selectedServices.map(s => ({ name: s.name, price: s.price, duration: s.duration }));
      const pageLink = `${window.location.origin}/${barber.username}`;
      const res = await fetch("/api/public/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: barber.id, barberName: displayName,
          barberAddress: barber.address || "", mapLink: barber.mapLink || "",
          barberPageLink: pageLink, isTeam: false, teamBarberName: null,
          services, totalPrice, totalDuration, date: dateOpt, time: selectedTime,
          clientName: clientName.trim(),
        }),
      });
      if (!res.ok) throw new Error("Session creation failed");
      const data = await res.json();
      setSessionId(data.sessionId);
      setDeepLink(data.deepLink);

      if (data.deepLink) {
        window.location.href = data.deepLink;
      }

      setStep("verifying");
      setSubmitting(false);
      pollingRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`/api/public/sessions/${data.sessionId}`).then(r => r.json());
          if (poll.status === "confirmed") { stopPolling(); setStep("done"); }
          else if (poll.status === "expired") { stopPolling(); setStep("confirm"); }
        } catch {}
      }, 3000);
    } catch {
      tgWindow?.close();
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step !== "done" ? onClose : undefined} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />
        <div className="flex items-center gap-3 px-5 py-4 shrink-0 border-b border-white/6">
          {(step === "name" || step === "confirm") && (
            <button onClick={() => setStep(step === "confirm" ? "name" : "time")}
              className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1">
            {step === "time" && <h2 className="font-bold text-base">Vaqt tanlash</h2>}
            {step === "name" && <h2 className="font-bold text-base">✍️ Ismingizni kiriting</h2>}
            {step === "confirm" && <h2 className="font-bold text-base">📌 Buyurtmani tasdiqlash</h2>}
            {step === "verifying" && <h2 className="font-bold text-base text-[#2AABEE]">Tasdiq kutilmoqda...</h2>}
            {step === "done" && <h2 className="font-bold text-base text-emerald-400">Bron tasdiqlandi! 🎉</h2>}
          </div>
          {step !== "done" && (
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {step !== "done" && step !== "verifying" && (
            <div className="bg-primary/6 border border-primary/12 rounded-2xl px-4 py-3 mt-4 mb-5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {selectedServices.map(s => (
                  <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{s.name}</span>
                ))}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatDur(totalDuration)}</p>
                <p className="text-sm font-bold text-primary">{formatPrice(totalPrice)}</p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {step === "time" && (
              <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex gap-2 mb-5">
                  {(["today", "tomorrow"] as const).map(d => (
                    <button key={d} onClick={() => { setDateOpt(d); setSelectedTime(null); }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${dateOpt === d ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground"}`}>
                      {d === "today" ? "📅 Bugun" : "📅 Ertaga"}
                    </button>
                  ))}
                </div>
                {slots.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl text-muted-foreground text-sm">Bu kun bo'sh vaqt yo'q 😔</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map(slot => (
                      <button key={slot} onClick={() => setSelectedTime(slot)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${selectedTime === slot ? "border-primary bg-primary/20 text-primary" : "border-white/12 bg-background/50 text-muted-foreground hover:bg-white/8"}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => selectedTime && setStep("name")} disabled={!selectedTime}
                  className="w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-base mt-6 disabled:opacity-30 shadow-lg shadow-primary/20">
                  Davom etish →
                </button>
              </motion.div>
            )}
            {step === "name" && (
              <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pt-2">
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tanlangan vaqt</p>
                    <p className="text-sm font-bold">{dateLabel}, soat {selectedTime}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground block">Ismingiz *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="masalan: Ali"
                    autoFocus
                    className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <button onClick={() => clientName.trim() && setStep("confirm")} disabled={!clientName.trim()}
                  className="w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-base mt-6 disabled:opacity-30 shadow-lg shadow-primary/20">
                  Keyingi →
                </button>
              </motion.div>
            )}
            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pt-2">
                <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3 mb-4">
                  {([
                    ["💇‍♂️", "Usta", displayName],
                    ["🛠", "Xizmat", selectedServices.map(s => s.name).join(", ")],
                    ["💸", "Narx", formatPrice(totalPrice)],
                    ["📅", "Sana", dateLabel],
                    ["⏰", "Vaqt", selectedTime || ""],
                  ] as const).map(([icon, label, value]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-base w-5 shrink-0">{icon}</span>
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">{label}</p>
                        <p className="text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#2AABEE]/8 border border-[#2AABEE]/20 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-xs text-[#2AABEE]/80 leading-relaxed">💬 Navbatingizni ro'yxatga olish va eslatma yuborish uchun jarayonni Telegram botimizda yakunlang.</p>
                </div>
                <button onClick={handleConfirm} disabled={submitting}
                  className="w-full py-3.5 rounded-2xl bg-[#2AABEE] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#2AABEE]/20">
                  {submitting
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Yuklanmoqda...</>
                    : <><Send className="w-4 h-4" /> Telegram orqali tasdiqlash</>}
                </button>
              </motion.div>
            )}
            {step === "verifying" && (
              <motion.div key="verifying" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <div className="w-20 h-20 rounded-3xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center text-4xl mx-auto mb-5">💬</div>
                <h2 className="text-lg font-bold mb-1">Telegram bot kutilmoqda</h2>
                <p className="text-sm text-muted-foreground mb-6">Botda <b>📱 Telefon raqamni yuborish</b> tugmasini bosing</p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${d}s` }} />
                  ))}
                  <span className="ml-1">Tasdiq kutilmoqda</span>
                </div>
                {deepLink && (
                  <button onClick={() => { window.location.href = deepLink; }}
                    className="w-full h-12 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 text-[#2AABEE] font-semibold text-sm flex items-center justify-center gap-2 mb-3">
                    <Send className="w-4 h-4" /> Telegram botni qayta ochish
                  </button>
                )}
                <button onClick={() => { stopPolling(); setStep("confirm"); }}
                  className="text-xs text-muted-foreground underline">Bekor qilish</button>
              </motion.div>
            )}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-24 h-24 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-5xl mx-auto mb-5">🎉</div>
                <h2 className="text-xl font-bold mb-2">Navbat band qilindi!</h2>
                <p className="text-sm text-muted-foreground mb-5">Barcha ma'lumotlar Telegram orqali yuborildi.</p>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 mb-5 text-left space-y-1">
                  <p className="text-sm font-semibold">{dateLabel}, soat {selectedTime}</p>
                  <p className="text-xs text-muted-foreground">{selectedServices.map(s => s.name).join(", ")}</p>
                  <p className="text-xs text-primary">{formatPrice(totalPrice)}</p>
                </div>
                <button onClick={onClose}
                  className="w-full h-12 rounded-2xl bg-primary text-black font-bold shadow-lg shadow-primary/20">
                  ✅ Yopish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function GalleryStrip({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 px-4 py-3" style={{ width: "max-content" }}>
        {images.map((src, i) => (
          <div key={i} className="relative shrink-0 rounded-2xl overflow-hidden shadow-lg shadow-black/30"
            style={{ width: 220, height: 160 }}>
            <img src={src} className="w-full h-full object-cover" alt="" />
            {i === 0 && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold rounded-full">
                Muqova
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const COVER_GRADS = ["from-primary/50 via-primary/20 to-transparent", "from-amber-600/50 via-amber-600/20 to-transparent", "from-emerald-600/50 via-emerald-600/20 to-transparent", "from-violet-600/50 via-violet-600/20 to-transparent"];

function PublicView({ barber }: { barber: BarberData }) {
  const [tab, setTab] = useState<"asosiy" | "xizmatlar">("asosiy");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  const displayName = barber.brandName || barber.name;
  const specs = barber.specializations
    ? barber.specializations.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const telegramHandle = barber.telegramUsername?.replace("@", "") || null;
  const instagramHandle = barber.instagram?.replace("@", "") || null;

  const galleryImages: string[] = (() => {
    try { return JSON.parse(barber.galleryImages || "[]"); } catch { return []; }
  })();

  const coverImage = galleryImages[0] || "";
  const gradIdx = displayName.charCodeAt(0) % COVER_GRADS.length;

  const workDays: string[] = (() => {
    try { return JSON.parse(barber.scheduleJson || "{}").workDays || []; } catch { return []; }
  })();
  const workDaysLabel = workDays.length > 0
    ? workDays.map(k => DAY_LABELS[k] || k).join(", ")
    : null;

  const hasInfo = !!(barber.bio || specs.length || barber.workingHoursStart || barber.address || telegramHandle || instagramHandle);

  const selectedServices = barber.services.filter(s => selectedIds.includes(s.id));
  const totalDur = selectedServices.reduce((a, s) => a + s.duration, 0);
  const totalPrice = selectedServices.reduce((a, s) => a + s.price, 0);

  function toggleService(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function bronUrl(serviceNames?: string[]) {
    if (!telegramHandle) return null;
    const text = serviceNames && serviceNames.length > 0
      ? `Assalomu alaykum! ${serviceNames.map(n => `"${n}"`).join(", ")} xizmatiga yozilmoqchiman.`
      : "Assalomu alaykum! Yozilmoqchiman.";
    return `https://t.me/${telegramHandle}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="pb-28 -mx-4">
      {/* Hero — dark profile header */}
      <div className="bg-zinc-950 px-4 pt-8 pb-5">
        <div className="w-24 h-24 rounded-full border-4 border-zinc-800 overflow-hidden bg-zinc-900 flex items-center justify-center shadow-2xl shadow-black/60 mb-4">
          {barber.avatarUrl
            ? <img src={barber.avatarUrl} className="w-full h-full object-cover" alt="" />
            : <span className="text-4xl font-bold text-primary uppercase">{displayName.charAt(0) || "?"}</span>
          }
        </div>
        <h1 className="text-2xl font-display font-bold text-white mb-0.5">{displayName}</h1>
        {barber.bio && <p className="text-sm text-zinc-400 leading-relaxed">{barber.bio}</p>}
      </div>

      {/* Gallery strip (all images) */}
      {galleryImages.length > 0 && (
        <div className="overflow-x-auto scrollbar-hide pb-3">
          <div className="flex gap-2.5 px-4">
            {galleryImages.map((src, i) => (
              <div key={i} className="relative shrink-0 w-40 h-28 rounded-2xl overflow-hidden border border-white/8">
                <img src={src} className="w-full h-full object-cover" alt="" />
                {i === 0 && <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-primary/80 text-black text-[9px] font-bold rounded-full">Muqova</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-white/8 mb-1">
        {(["asosiy", "xizmatlar"] as const).map(t => (
          <motion.button key={t} onClick={() => setTab(t)} whileTap={{ scale: 0.97 }}
            className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${tab === t ? "text-foreground border-primary" : "text-muted-foreground border-transparent"}`}>
            {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "asosiy" && (
          <motion.div key="asosiy" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4 space-y-5">
              {!hasInfo && (
                <div className="text-center py-10 border border-dashed border-white/8 rounded-2xl">
                  <p className="text-3xl mb-2">✂️</p>
                  <p className="text-sm text-muted-foreground">Ma'lumotlar hali to'ldirilmagan</p>
                </div>
              )}

              {specs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {specs.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-primary/12 border border-primary/20 text-xs text-primary font-medium">{s}</span>
                  ))}
                </div>
              )}

              {/* 🕐 Ish vaqti */}
              {(barber.workingHoursStart || workDaysLabel) && (
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
                      <p className="text-xs text-foreground font-medium">{barber.workingHoursStart || "09:00"}–{barber.workingHoursEnd || "20:00"}</p>
                    </div>
                  </div>
                  {barber.lunchBreakEnabled && barber.lunchBreakStart && barber.lunchBreakEnd && (
                    <div className="flex items-center gap-2 mt-2 px-4 py-2.5 bg-white/3 border border-white/6 rounded-2xl">
                      <span className="text-sm">🍽</span>
                      <span className="text-xs text-muted-foreground">Tushlik tanaffus: {barber.lunchBreakStart}–{barber.lunchBreakEnd}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 📞 Aloqa */}
              {barber.phoneVisible && barber.phone && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📞</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Aloqa</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <a href={`tel:${barber.phone}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-colors">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>Qo'ng'iroq qilish</span>
                    <span className="ml-auto text-xs text-emerald-400/70">{barber.phone}</span>
                  </a>
                </div>
              )}

              {/* 📍 Manzil */}
              {(barber.latitude && barber.longitude) ? (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📍</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Manzil</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-2xl overflow-hidden border border-white/8" style={{ height: 160 }}>
                      <iframe src={osmEmbedUrl(barber.latitude, barber.longitude)} className="w-full h-full" style={{ border: 0, pointerEvents: "none" }} scrolling="no" loading="lazy" title="Joylashuv" />
                    </div>
                    {barber.address && (
                      <p className="text-sm text-muted-foreground px-0.5 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                        <span className="truncate">{barber.address}</span>
                      </p>
                    )}
                    <a href={mapsHref(barber.latitude, barber.longitude, barber.mapLink)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-card border border-white/8 text-sm font-semibold text-primary hover:border-primary/30 transition-colors">
                      <MapPin className="w-4 h-4" /> Xaritada ochish
                    </a>
                  </div>
                </div>
              ) : barber.address ? (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">📍</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Manzil</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  {(() => {
                    const href = safeHref(barber.mapLink);
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
                          <span className="text-sm text-foreground flex-1">{barber.address}</span>
                          {href && <span className="text-xs text-primary font-semibold">Ko'rish →</span>}
                        </div>
                      </Tag>
                    );
                  })()}
                </div>
              ) : null}

              {/* 🔗 Ijtimoiy tarmoqlar */}
              {(telegramHandle || instagramHandle) && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm">🔗</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Ijtimoiy tarmoqlar</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                  <div className="space-y-2">
                    {telegramHandle && (
                      <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#2AABEE]/10 border border-[#2AABEE]/25 text-[#2AABEE] text-sm font-medium hover:bg-[#2AABEE]/20 transition-colors">
                        <Send className="w-3.5 h-3.5" /><span>@{telegramHandle}</span>
                      </a>
                    )}
                    {instagramHandle && (
                      <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 text-pink-400 text-sm font-medium hover:from-pink-500/20 hover:to-violet-500/20 transition-colors">
                        <Instagram className="w-3.5 h-3.5" /><span>@{instagramHandle}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === "xizmatlar" && (
          <motion.div key="xizmatlar" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4 pb-4">
              {barber.services.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/8 rounded-2xl">
                  <p className="text-3xl mb-2">✂️</p>
                  <p className="text-sm text-muted-foreground">Hozircha xizmatlar qo'shilmagan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {barber.services.map(s => {
                    const selected = selectedIds.includes(s.id);
                    return (
                      <div key={s.id}
                        onClick={() => toggleService(s.id)}
                        className={`bg-card border rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all ${selected ? "border-primary/40 bg-primary/5" : "border-white/6 hover:border-white/12"}`}>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border transition-all ${selected ? "bg-primary/15 border-primary/30" : "bg-white/5 border-white/8"}`}>
                          ✂️
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDur(s.duration)} · <span className="text-foreground/80 font-medium">{formatPrice(s.price)}</span>
                          </p>
                        </div>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "bg-primary border-primary text-black" : "bg-white/5 border-white/20 text-muted-foreground"}`}>
                          {selected ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-md mx-auto px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-white/8">
          <AnimatePresence mode="wait">
            {selectedIds.length > 0 ? (
              <motion.div key="selected" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{selectedServices.map(s => s.name).join(", ")}</p>
                  <p className="text-sm font-bold text-foreground">{formatDur(totalDur)} · {formatPrice(totalPrice)}</p>
                </div>
                <button onClick={() => setBookingOpen(true)}
                  className="shrink-0 h-12 px-5 rounded-2xl bg-primary text-black font-bold text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center">
                  💈 Bron qilish
                </button>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => setTab("xizmatlar")}
                  className="w-full h-12 rounded-2xl bg-white/6 border border-white/8 text-muted-foreground font-semibold text-sm hover:bg-white/10 hover:text-foreground transition-all">
                  💈 Xizmat tanlash
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Booking modal */}
      <AnimatePresence>
        {bookingOpen && (
          <PublicBookingModal
            barber={barber}
            selectedServices={selectedServices}
            totalDuration={totalDur}
            totalPrice={totalPrice}
            onClose={() => setBookingOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type Status = "loading" | "loaded" | "not_found" | "error";

export default function BarberPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();
  const { user } = useAuth(false);
  const isOwner = !!user && user.username === slug;

  const [status, setStatus] = useState<Status>("loading");
  const [barber, setBarber] = useState<BarberData | null>(null);

  useEffect(() => {
    if (!slug) { setStatus("not_found"); return; }
    let cancelled = false;
    fetch(`/api/public/barber/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (cancelled) return;
        if (r.status === 404) { setStatus("not_found"); return; }
        if (!r.ok) { setStatus("error"); return; }
        const data = await r.json();
        if (cancelled) return;
        if (data.redirectTo) { navigate(`/${data.redirectTo}`, { replace: true }); return; }
        setBarber(data as BarberData);
        setStatus("loaded");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [slug]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-5xl mb-2">🔍</p>
        <h1 className="text-xl font-bold text-foreground">Barber topilmadi</h1>
        <p className="text-sm text-muted-foreground max-w-xs">Bu sahifa mavjud emas yoki olib tashlangan bo'lishi mumkin.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-2xl">⚠️</p>
        <p className="text-foreground font-semibold">Sahifani yuklashda xatolik</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-white/8 border border-white/12 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!barber) return null;

  return (
    <div className="max-w-md mx-auto px-4">
      {isOwner && (
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-primary/10 border-b border-primary/20 backdrop-blur-md flex items-center justify-between">
          <p className="text-xs text-primary font-semibold">✏️ Bu sizning sahifangiz — mijozlar shunday ko'radi</p>
          <Link href="/settings/page">
            <span className="text-xs text-primary font-bold underline underline-offset-2 cursor-pointer">Tahrirlash →</span>
          </Link>
        </div>
      )}
      <PublicView barber={barber} />
    </div>
  );
}
