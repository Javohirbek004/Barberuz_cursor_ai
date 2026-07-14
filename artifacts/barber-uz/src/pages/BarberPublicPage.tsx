import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, MapPin, Instagram, Phone } from "lucide-react";

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
      {/* Hero — cover image + profile avatar */}
      <div className="relative">
        <div className="w-full h-48 relative overflow-hidden">
          {coverImage
            ? <img src={coverImage} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg,#ffffff08 0,#ffffff08 1px,transparent 0,transparent 50%)", backgroundSize: "20px 20px" }} />
                <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRADS[gradIdx]}`} />
              </div>
          }
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="absolute bottom-0 left-4 translate-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-gradient-to-br from-primary/40 to-primary/15 flex items-center justify-center shadow-2xl shadow-black/40">
            {barber.avatarUrl
              ? <img src={barber.avatarUrl} className="w-full h-full object-cover" alt="" />
              : <span className="text-3xl font-bold text-primary uppercase">{displayName.charAt(0) || "?"}</span>
            }
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-12 pb-3">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{displayName}</h1>
        {barber.bio && <p className="text-sm text-muted-foreground leading-relaxed">{barber.bio}</p>}
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
      <div className="px-4 mb-1">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          {(["asosiy", "xizmatlar"] as const).map(t => (
            <motion.button key={t} onClick={() => setTab(t)} whileTap={{ scale: 0.97 }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </motion.button>
          ))}
        </div>
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
                {telegramHandle ? (
                  <a href={bronUrl(selectedServices.map(s => s.name)) || "#"} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 h-12 px-5 rounded-2xl bg-primary text-black font-bold text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center">
                    💈 Bron qilish
                  </a>
                ) : (
                  <span className="shrink-0 h-12 px-5 rounded-2xl bg-white/8 border border-white/12 text-muted-foreground text-sm font-bold flex items-center">
                    Bron qilish
                  </span>
                )}
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
