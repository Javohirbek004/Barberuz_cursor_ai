import { Phone, MapPin, Clock, Send, Instagram, ChevronRight } from "lucide-react";

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

export function VariantKartochkali() {
  return (
    <div className="min-h-screen font-sans overflow-y-auto" style={{ background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      {/* Hero */}
      <div className="relative">
        <div className="w-full h-52" style={{ background: "linear-gradient(135deg, #0f3460 0%, #533483 50%, #e94560 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 60%, #1a1a2e)" }} />
        </div>
        {/* Avatar */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-[#1a1a2e] flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg, #e94560, #533483)" }}>
              <span className="text-4xl font-bold text-white">A</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="text-center pt-16 pb-4 px-4">
        <h1 className="text-2xl font-bold text-white">{profile.brandName}</h1>
        <p className="text-sm text-white/50 mt-0.5">{profile.name}</p>
        <p className="text-sm text-white/60 mt-2 leading-relaxed max-w-xs mx-auto">{profile.bio}</p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
          {profile.speciality.map((s) => (
            <span key={s} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", color: "#e94560" }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 pb-10 space-y-3">
        {/* Ish vaqti card */}
        <div className="rounded-3xl p-4 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(83,52,131,0.4)" }}>
              <Clock className="w-4 h-4" style={{ color: "#a78bfa" }} />
            </div>
            <span className="text-sm font-semibold text-white">Ish vaqti</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Kun</p>
              <p className="text-sm font-semibold text-white mt-1">{profile.workDays}</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Soat</p>
              <p className="text-sm font-semibold text-white mt-1">{profile.workStart}–{profile.workEnd}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="text-sm">🍽</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Tushlik: {profile.lunchStart}–{profile.lunchEnd}</span>
          </div>
        </div>

        {/* Aloqa card */}
        <div className="rounded-3xl p-4 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.2)" }}>
              <Phone className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-white">Aloqa</span>
          </div>
          <a href={`tel:${profile.phone}`} className="flex items-center justify-between w-full py-3 px-4 rounded-2xl" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <span className="text-sm font-semibold text-emerald-400">Qo'ng'iroq qilish</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "rgba(52,211,153,0.7)" }}>{profile.phone}</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-400/50" />
            </div>
          </a>
        </div>

        {/* Manzil card */}
        <div className="rounded-3xl overflow-hidden border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="p-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.2)" }}>
                <MapPin className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-sm font-semibold text-white">Manzil</span>
            </div>
          </div>
          <div className="h-24 relative" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(#4af 1px,transparent 1px),linear-gradient(90deg,#4af 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/50 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
            </div>
          </div>
          <div className="p-4 pt-3 flex items-center justify-between">
            <p className="text-sm text-white/70 flex-1 leading-snug">{profile.address}</p>
            <button className="ml-3 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              Ko'rish
            </button>
          </div>
        </div>

        {/* Social card */}
        <div className="rounded-3xl p-4 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(42,171,238,0.2)" }}>
              <Send className="w-4 h-4" style={{ color: "#2AABEE" }} />
            </div>
            <span className="text-sm font-semibold text-white">Ijtimoiy tarmoqlar</span>
          </div>
          <div className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl" style={{ background: "rgba(42,171,238,0.12)", border: "1px solid rgba(42,171,238,0.25)", color: "#2AABEE" }}>
              <Send className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{profile.telegram}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(236,72,153,0.25)", color: "#f472b6" }}>
              <Instagram className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{profile.instagram}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
