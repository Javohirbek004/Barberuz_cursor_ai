export function Compact() {
  const coverUrl = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80";
  const avatarUrl = "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=200&q=80";

  return (
    <div className="w-[390px] bg-[#0a0a0a] font-sans">
      {/* Cover image — shorter */}
      <div className="relative w-full h-32 overflow-hidden">
        <img src={coverUrl} className="w-full h-full object-cover object-top" alt="cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />
      </div>

      {/* Horizontal: avatar left + name right */}
      <div className="flex items-end gap-3 px-4 -mt-8 pb-4">
        <div className="w-[68px] h-[68px] rounded-full border-4 border-[#0a0a0a] overflow-hidden shadow-xl shrink-0 z-10">
          <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
        </div>
        <div className="pb-1">
          <h1 className="text-xl font-bold text-white leading-tight">Barber Java</h1>
          <p className="text-xs text-zinc-400 mt-0.5">5 yillik tajriba</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {["Asosiy", "Xizmatlar"].map((t, i) => (
          <button key={t}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 -mb-px transition-all ${
              i === 0 ? "text-white border-amber-500" : "text-zinc-500 border-transparent"
            }`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
