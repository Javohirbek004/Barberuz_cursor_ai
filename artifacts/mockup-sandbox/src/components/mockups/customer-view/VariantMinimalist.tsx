import { Phone, MapPin, Clock, Send, Instagram, ExternalLink } from "lucide-react";

const profile = {
  name: "Ali Valiyev",
  brandName: "Ali Barbershop",
  bio: "Professional sartarosh, 8 yillik tajriba. Soch va soqol bo'yicha mutaxassis.",
  speciality: ["Soch kesish", "Soqol olish", "Rang berish"],
  workDays: "Du–Ju, Sha",
  workStart: "09:00",
  workEnd: "20:00",
  lunchStart: "13:00",
  lunchEnd: "14:00",
  phone: "+998 91 234 56 78",
  address: "Toshkent sh., Yunusobod tum., 4-mavze, 15-uy",
  telegram: "@Ali_Barber",
  instagram: "@ali_barbershop",
};

function Row({ icon, label, value, accent, href }: { icon: React.ReactNode; label: string; value: string; accent?: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/6">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent ? `${accent}18` : "rgba(255,255,255,0.06)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
        <p className="text-sm text-white font-medium truncate">{value}</p>
      </div>
      {href && <ExternalLink className="w-3.5 h-3.5 text-white/20 shrink-0" />}
    </div>
  );
  if (href) return <a href={href}>{inner}</a>;
  return <div>{inner}</div>;
}

export function VariantMinimalist() {
  return (
    <div className="bg-[#111111] min-h-screen text-white font-sans overflow-y-auto">
      {/* Minimal top bar */}
      <div className="relative h-36 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1c1c1c 0%, #2a2a2a 100%)" }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #111111)" }} />
        {/* Avatar — left aligned */}
        <div className="absolute bottom-0 left-5 translate-y-1/2">
          <div className="w-16 h-16 rounded-2xl border-2 border-[#111111] flex items-center justify-center shadow-xl" style={{ background: "linear-gradient(135deg, #333, #555)" }}>
            <span className="text-2xl font-bold text-white">A</span>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="px-5 pt-11 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{profile.brandName}</h1>
            <p className="text-xs text-white/40 mt-0.5">{profile.name}</p>
          </div>
          <div className="flex gap-1.5">
            {["✂️", "💈"].map((e, i) => <span key={i} className="text-lg">{e}</span>)}
          </div>
        </div>
        <p className="text-xs text-white/50 mt-2.5 leading-relaxed">{profile.bio}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.speciality.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded text-[11px] text-white/50 border border-white/10">{s}</span>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-white/8" />

      {/* Info rows */}
      <div className="px-5">
        {/* Ish vaqti group */}
        <p className="text-[10px] uppercase tracking-widest text-white/20 pt-5 pb-2">Ish vaqti</p>
        <Row
          icon={<Clock className="w-3.5 h-3.5 text-white/50" />}
          label="Kunlar"
          value={`${profile.workDays}, ${profile.workStart}–${profile.workEnd}`}
        />
        <Row
          icon={<span className="text-sm">🍽</span>}
          label="Tushlik"
          value={`${profile.lunchStart}–${profile.lunchEnd}`}
        />

        {/* Aloqa group */}
        <p className="text-[10px] uppercase tracking-widest text-white/20 pt-5 pb-2">Aloqa</p>
        <Row
          icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />}
          label="Telefon"
          value={profile.phone}
          accent="#10b981"
          href={`tel:${profile.phone}`}
        />

        {/* Manzil group */}
        <p className="text-[10px] uppercase tracking-widest text-white/20 pt-5 pb-2">Manzil</p>
        <div className="mb-2 rounded-2xl overflow-hidden border border-white/8 h-24 relative">
          <div className="absolute inset-0" style={{ background: "#1a1a1a", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-white shadow-lg shadow-white/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#111]" />
            </div>
          </div>
        </div>
        <Row
          icon={<MapPin className="w-3.5 h-3.5 text-white/50" />}
          label="Manzil"
          value={profile.address}
          href="#"
        />

        {/* Ijtimoiy group */}
        <p className="text-[10px] uppercase tracking-widest text-white/20 pt-5 pb-2">Ijtimoiy tarmoqlar</p>
        <Row
          icon={<Send className="w-3.5 h-3.5" style={{ color: "#2AABEE" }} />}
          label="Telegram"
          value={profile.telegram}
          accent="#2AABEE"
          href="#"
        />
        <Row
          icon={<Instagram className="w-3.5 h-3.5 text-pink-400" />}
          label="Instagram"
          value={profile.instagram}
          accent="#ec4899"
          href="#"
        />
        <div className="h-8" />
      </div>
    </div>
  );
}
