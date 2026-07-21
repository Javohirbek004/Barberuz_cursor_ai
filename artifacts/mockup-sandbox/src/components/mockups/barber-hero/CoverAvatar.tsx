export function CoverAvatar() {
  const coverUrl = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80";
  const avatarUrl = "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=200&q=80";

  return (
    <div className="w-[390px] bg-[#0a0a0a] font-sans">
      {/* Cover image with avatar overlay */}
      <div className="relative">
        <div className="w-full h-44 overflow-hidden">
          <img src={coverUrl} className="w-full h-full object-cover" alt="cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        </div>
        {/* Avatar overlaid bottom-left */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="w-[72px] h-[72px] rounded-full border-4 border-[#0a0a0a] overflow-hidden shadow-xl">
            <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
          </div>
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-0.5">Barber Java</h1>
        <p className="text-sm text-zinc-400">5 yillik tajriba</p>
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
