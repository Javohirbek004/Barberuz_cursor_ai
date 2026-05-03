import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import NotFound from "@/pages/not-found";
import { CustomerView, ProfileData, ServiceItem } from "@/pages/settings/PersonalPage";

// ── Raw API shape ─────────────────────────────────────────────────────────────

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

// ── Data mappers ──────────────────────────────────────────────────────────────

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
    <CustomerView
      profile={profile}
      services={services}
      isTeam={isTeam}
      barberId={barber.id}
    />
  );
}
