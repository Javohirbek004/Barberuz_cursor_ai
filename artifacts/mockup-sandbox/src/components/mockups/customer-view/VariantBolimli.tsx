import { Phone, MapPin, Clock, Send, Instagram, Scissors } from "lucide-react";

const profile = {
  name: "Ali Valiyev",
  brandName: "Ali Barbershop",
  bio: "Professional sartarosh, 8 yillik tajriba. Soch va soqol bo'yicha mutaxassis.",
  avatarLetter: "A",
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

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{emoji}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{title}</span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

export function VariantBolimli() {
  return (
    <div className="bg-zinc-950 min-h-screen text-white font-sans overflow-y-auto">
      {/* Cover */}
      <div className="relative w-full h-44 bg-gradient-to-br from-amber-900/60 via-zinc-900 to-zinc-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        {/* Avatar */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="w-20 h-20 rounded-full border-4 border-zinc-950 bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-xl font-bold text-white">{profile.brandName}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">{profile.name}</p>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{profile.bio}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.speciality.map((s) => (
            <span key={s} className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs text-amber-400 font-medium">{s}</span>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-6 pb-10">
        {/* Ish vaqti */}
        <div>
          <SectionHeader emoji="🕐" title="Ish vaqti" />
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3 border border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Kun</p>
                  <p className="text-sm text-white font-medium">{profile.workDays}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Soat</p>
                <p className="text-sm text-white font-medium">{profile.workStart}–{profile.workEnd}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-zinc-900/60 rounded-2xl px-4 py-2.5 border border-zinc-800/60">
              <span className="text-base">🍽</span>
              <span className="text-xs text-zinc-400">Tushlik tanaffus: {profile.lunchStart}–{profile.lunchEnd}</span>
            </div>
          </div>
        </div>

        {/* Aloqa */}
        <div>
          <SectionHeader emoji="📞" title="Aloqa" />
          <a href={`tel:${profile.phone}`} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
            <Phone className="w-4 h-4 shrink-0" />
            <span>Qo'ng'iroq qilish</span>
            <span className="ml-auto text-xs text-emerald-400/70">{profile.phone}</span>
          </a>
        </div>

        {/* Manzil */}
        <div>
          <SectionHeader emoji="📍" title="Manzil" />
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="h-20 bg-zinc-800 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#4af 1px,transparent 1px),linear-gradient(90deg,#4af 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm text-zinc-300 flex-1 leading-snug">{profile.address}</span>
              <span className="text-xs text-amber-400 font-semibold shrink-0">Ko'rish →</span>
            </div>
          </div>
        </div>

        {/* Ijtimoiy tarmoqlar */}
        <div>
          <SectionHeader emoji="🔗" title="Ijtimoiy tarmoqlar" />
          <div className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#2AABEE]/10 border border-[#2AABEE]/25 text-[#2AABEE] text-sm font-medium">
              <Send className="w-3.5 h-3.5" /> {profile.telegram}
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 text-pink-400 text-sm font-medium">
              <Instagram className="w-3.5 h-3.5" /> {profile.instagram}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
