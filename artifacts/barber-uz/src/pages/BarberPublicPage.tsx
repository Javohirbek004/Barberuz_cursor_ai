import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, MapPin, Instagram } from "lucide-react";

interface BarberData {
  id: string;
  name: string;
  brandName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
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

const COVER_GRADS = [
  "from-primary/50 via-primary/20 to-transparent",
  "from-amber-600/50 via-amber-600/20 to-transparent",
  "from-emerald-600/50 via-emerald-600/20 to-transparent",
  "from-violet-600/50 via-violet-600/20 to-transparent",
];

function GalleryStrip({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <div className="overflow-x-auto scrollbar-hide pb-3">
      <div className="flex gap-2.5 px-4">
        {images.map((src, i) => (
          <div key={i} className="relative shrink-0">
            <div className="w-48 h-36 rounded-2xl overflow-hidden border border-white/8 shadow-md shadow-black/30">
              <img src={src} className="w-full h-full object-cover" alt="" />
            </div>
            {i === 0 && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-primary/80 backdrop-blur-sm text-black text-[9px] font-bold rounded-full">
                Asosiy
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicView({ barber }: { barber: BarberData }) {
  const [tab, setTab] = useState<"asosiy" | "xizmatlar">("asosiy");

  const displayName = barber.brandName || barber.name;
  const specs = barber.specializations
    ? barber.specializations.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const gradIdx = displayName.charCodeAt(0) % COVER_GRADS.length;
  const telegramHandle = barber.telegramUsername?.replace("@", "") || null;
  const instagramHandle = barber.instagram?.replace("@", "") || null;

  const galleryImages: string[] = (() => {
    try { return JSON.parse(barber.galleryImages || "[]"); } catch { return []; }
  })();

  const workDays: string[] = (() => {
    try { return JSON.parse(barber.scheduleJson || "{}").workDays || []; } catch { return []; }
  })();

  const workDaysLabel = workDays.length > 0
    ? workDays.map(k => DAY_LABELS[k] || k).join(", ")
    : null;

  const hasInfo = !!(barber.bio || specs.length || barber.workingHoursStart || barber.address || telegramHandle || instagramHandle);

  function bronUrl(serviceName?: string) {
    if (!telegramHandle) return null;
    const text = serviceName ? `Assalomu alaykum! "${serviceName}" xizmatiga yozilmoqchiman.` : "Assalomu alaykum! Yozilmoqchiman.";
    return `https://t.me/${telegramHandle}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="pb-16 -mx-4">
      {/* Hero */}
      <div className="relative">
        <div className="w-full h-48 relative overflow-hidden">
          {galleryImages.length > 0 ? (
            <img src={galleryImages[0]} className="w-full h-full object-cover" alt="" />
          ) : barber.avatarUrl ? (
            <img src={barber.avatarUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg,#ffffff08 0,#ffffff08 1px,transparent 0,transparent 50%)", backgroundSize: "20px 20px" }} />
              <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRADS[gradIdx]}`} />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="absolute bottom-0 left-4 translate-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-gradient-to-br from-primary/40 to-primary/15 flex items-center justify-center shadow-2xl shadow-black/40">
            {barber.avatarUrl ? (
              <img src={barber.avatarUrl} className="w-full h-full object-cover" alt={displayName} />
            ) : (
              <span className="text-3xl font-bold text-primary uppercase">{displayName.charAt(0)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-12 pb-3">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{displayName}</h1>
        {barber.bio && <p className="text-sm text-muted-foreground leading-relaxed">{barber.bio}</p>}
      </div>

      {/* Gallery strip — always visible above tabs (1–5 images) */}
      {galleryImages.length > 0 && <GalleryStrip images={galleryImages} />}

      {/* Tab bar */}
      <div className="px-4 mb-1 mt-1">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          {(["asosiy", "xizmatlar"] as const).map(t => (
            <motion.button
              key={t}
              onClick={() => setTab(t)}
              whileTap={{ scale: 0.97 }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "asosiy" && (
          <motion.div key="asosiy" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4 space-y-4">
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

              {(barber.workingHoursStart || workDaysLabel) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 border border-white/8 w-fit px-3 py-2 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                  <span>
                    {workDaysLabel ? `${workDaysLabel} · ` : ""}
                    {barber.workingHoursStart || "09:00"}–{barber.workingHoursEnd || "20:00"}
                  </span>
                </div>
              )}

              {barber.address && (() => {
                const href = safeHref(barber.mapLink);
                const Tag = href ? "a" : "div";
                const extraProps = href ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : {};
                return (
                  <Tag {...extraProps} className="flex items-center gap-3 bg-card border border-white/8 rounded-2xl p-3.5 hover:border-white/15 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{barber.address}</p>
                      {href && <p className="text-xs text-primary mt-0.5">Xaritada ko'rish →</p>}
                    </div>
                  </Tag>
                );
              })()}

              {(telegramHandle || instagramHandle) && (
                <div className="space-y-2">
                  {telegramHandle && (
                    <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#2AABEE]/8 border border-[#2AABEE]/20 text-[#2AABEE] text-sm font-medium hover:bg-[#2AABEE]/15 transition-colors">
                      <Send className="w-4 h-4 shrink-0" />
                      <span>@{telegramHandle}</span>
                    </a>
                  )}
                  {instagramHandle && (
                    <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500/8 to-violet-500/8 border border-pink-500/15 text-pink-400 text-sm font-medium hover:from-pink-500/15 hover:to-violet-500/15 transition-colors">
                      <Instagram className="w-4 h-4 shrink-0" />
                      <span>@{instagramHandle}</span>
                    </a>
                  )}
                </div>
              )}

              <div className="pt-1 pb-2">
                {telegramHandle ? (
                  <a href={bronUrl() || ""} target="_blank" rel="noopener noreferrer"
                    className="block w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-sm text-center shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all">
                    💈 Bron qilish
                  </a>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/8 text-muted-foreground text-sm text-center">
                    Bron qilish uchun Telegram orqali murojaat qiling
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {tab === "xizmatlar" && (
          <motion.div key="xizmatlar" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            <div className="px-4 pt-4">
              {barber.services.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/8 rounded-2xl">
                  <p className="text-3xl mb-2">✂️</p>
                  <p className="text-sm text-muted-foreground">Hozircha xizmatlar qo'shilmagan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {barber.services.map(s => {
                    const url = bronUrl(s.name);
                    return (
                      <div key={s.id} className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 bg-white/5 border border-white/8">
                          ✂️
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDur(s.duration)} · <span className="text-foreground/80 font-medium">{formatPrice(s.price)}</span>
                          </p>
                        </div>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 h-9 px-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold flex items-center hover:bg-primary/20 transition-colors">
                            Bron
                          </a>
                        ) : (
                          <span className="shrink-0 h-9 px-3.5 rounded-xl bg-white/5 border border-white/8 text-muted-foreground/40 text-xs font-semibold flex items-center cursor-not-allowed">
                            Bron
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {barber.services.length > 0 && (
                <div className="mt-5 pb-4">
                  {telegramHandle ? (
                    <a href={bronUrl() || ""} target="_blank" rel="noopener noreferrer"
                      className="block w-full py-3.5 rounded-2xl bg-primary text-black font-bold text-sm text-center shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all">
                      💈 Bron qilish
                    </a>
                  ) : (
                    <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/8 text-muted-foreground text-sm text-center">
                      Bron qilish uchun Telegram orqali murojaat qiling
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
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
