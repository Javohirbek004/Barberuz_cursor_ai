import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import NotFound from "@/pages/not-found";

// ── Types (mirrored from PersonalPage) ────────────────────────────────────────

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
  category: string;
  name: string;
  duration: number;
  price: number;
  description: string;
}

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
  services: Array<{ id: string; name: string; nameRu: string | null; duration: number; price: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapToProfileData(b: BarberData): ProfileData {
  const specs = b.specializations
    ? b.specializations.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  return {
    name: b.brandName || b.name,
    bio: b.bio || "",
    speciality: specs,
    phone: b.phone || "",
    address: "",
    mapLink: "",
    workDays: "Dush — Shan",
    workStart: b.workingHoursStart || "09:00",
    workEnd: b.workingHoursEnd || "20:00",
    lunchStart: b.lunchBreakStart || "13:00",
    lunchEnd: b.lunchBreakEnd || "14:00",
    telegram: b.telegramUsername ? `@${b.telegramUsername}` : "",
    instagram: "",
    profileImage: b.avatarUrl || "",
    coverImage: "",
  };
}

function mapToServiceItems(raw: BarberData["services"]): ServiceItem[] {
  return raw.map(s => ({
    id: s.id,
    category: "soch",
    name: s.name,
    duration: s.duration,
    price: s.price,
    description: "",
  }));
}

// ── Inline CustomerView (self-contained for the public page) ──────────────────

const DEFAULT_CATS = [
  { id: "all", label: "Hammasi" },
  { id: "soch", label: "✂️ Soch" },
  { id: "soqol", label: "🪒 Soqol" },
  { id: "bolalar", label: "👦 Bolalar" },
  { id: "vip", label: "💎 VIP" },
];

function formatDur(m: number) {
  return m < 60 ? `${m} daq` : `${Math.floor(m / 60)}s ${m % 60 > 0 ? `${m % 60}d` : ""}`.trim();
}
function formatPrice(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function catEmoji(cat: string) {
  const map: Record<string, string> = {
    soch: "✂️", soqol: "🪒", bolalar: "👦", vip: "💎",
  };
  return map[cat] || "💈";
}

const COVER_GRADS = [
  "from-primary/50 via-primary/20 to-transparent",
  "from-amber-600/50 via-amber-600/20 to-transparent",
  "from-emerald-600/50 via-emerald-600/20 to-transparent",
  "from-violet-600/50 via-violet-600/20 to-transparent",
];

function PublicCustomerView({
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
  const [activeCat, setActiveCat] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const gradIdx = profile.name.charCodeAt(0) % COVER_GRADS.length;
  const filtered = activeCat === "all" ? services : services.filter(s => s.category === activeCat);

  const totalPrice = services
    .filter(s => selectedIds.includes(s.id))
    .reduce((a, s) => a + s.price, 0);
  const totalDur = services
    .filter(s => selectedIds.includes(s.id))
    .reduce((a, s) => a + s.duration, 0);

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <div className="pb-28 min-h-screen bg-background">
      {/* Hero */}
      <div className="relative">
        <div className="w-full h-52 relative overflow-hidden">
          {profile.coverImage
            ? <img src={profile.coverImage} className="w-full h-full object-cover" alt="cover" />
            : <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, #ffffff08 0, #ffffff08 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />
                <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRADS[gradIdx]}`} />
              </div>
          }
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="absolute bottom-0 left-4 translate-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-gradient-to-br from-primary/40 to-primary/15 flex items-center justify-center shadow-2xl shadow-black/40">
            {profile.profileImage
              ? <img src={profile.profileImage} className="w-full h-full object-cover" alt={profile.name} />
              : <span className="text-3xl font-bold text-primary uppercase">{profile.name.charAt(0)}</span>
            }
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-12 pb-4 max-w-md mx-auto">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{profile.name}</h1>
        {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}
      </div>

      {/* Tab bar */}
      <div className="px-4 mb-1 max-w-md mx-auto">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          {(["asosiy", "xizmatlar"] as const).map(t => (
            <button
              key={t}
              onClick={() => setPreviewTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${previewTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 max-w-md mx-auto">
        {previewTab === "asosiy" && (
          <div className="pt-4 space-y-3">
            {profile.speciality.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.speciality.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-primary/12 border border-primary/20 text-xs text-primary font-medium">{s}</span>
                ))}
              </div>
            )}
            {profile.workStart && (
              <div className="bg-card border border-white/6 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Ish vaqti</p>
                <p className="text-sm text-foreground">{profile.workDays}</p>
                <p className="text-sm text-foreground">{profile.workStart} — {profile.workEnd}</p>
              </div>
            )}
            {profile.phone && (
              <div className="bg-card border border-white/6 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-lg">📞</span>
                <span className="text-sm text-foreground">{profile.phone}</span>
              </div>
            )}
          </div>
        )}

        {previewTab === "xizmatlar" && (
          <div className="pt-4">
            {services.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Xizmatlar hali qo'shilmagan</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(s => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <div key={s.id}
                      className={`bg-card border rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all ${isSelected ? "border-primary/40 bg-primary/6" : "border-white/6 hover:border-white/12"}`}
                      onClick={() => toggle(s.id)}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${isSelected ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/8"}`}>
                        {catEmoji(s.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDur(s.duration)} · <span className="text-foreground/80 font-medium">{s.price.toLocaleString()} so'm</span>
                        </p>
                      </div>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 ${isSelected ? "bg-primary text-black border-primary" : "bg-white/5 border-white/12 text-muted-foreground"}`}>
                        {isSelected ? "✓" : "+"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-md mx-auto px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-white/8">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{selectedIds.length} xizmat · {formatDur(totalDur)}</p>
                <p className="text-base font-bold text-foreground">{formatPrice(totalPrice)}</p>
              </div>
              <a
                href={`https://t.me/${encodeURIComponent("Barberuz_yordamchi_bot")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-6 rounded-2xl bg-primary text-black font-bold text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all shrink-0"
              >
                Bron qilish →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main public page component ────────────────────────────────────────────────

type Status = "loading" | "loaded" | "not_found" | "error";

export default function BarberPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();

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
        if (data.redirectTo) {
          navigate(`/${data.redirectTo}`, { replace: true });
          return;
        }
        setBarber(data as BarberData);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [slug]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "not_found") return <NotFound />;

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-2xl">⚠️</p>
        <p className="text-foreground font-semibold">Sahifani yuklashda xatolik</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-white/8 border border-white/12 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!barber) return null;

  const profile = mapToProfileData(barber);
  const services = mapToServiceItems(barber.services);
  const isTeam = barber.mode === "team";

  return (
    <PublicCustomerView
      profile={profile}
      services={services}
      isTeam={isTeam}
      barberId={barber.id}
    />
  );
}
