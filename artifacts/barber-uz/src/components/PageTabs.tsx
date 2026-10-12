type TabKey = "asosiy" | "xizmatlar";

export function PageTabs({
  value,
  onChange,
  serviceCount = 0,
}: {
  value: TabKey;
  onChange: (tab: TabKey) => void;
  serviceCount?: number;
}) {
  const items = [
    { key: "asosiy" as const, label: "🏠 Asosiy" },
    { key: "xizmatlar" as const, label: `✂️ Xizmatlar (${serviceCount})` },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-1">
      {items.map((item) => {
        const on = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-all ${
              on
                ? "border border-amber-400/70 bg-amber-500/15 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.18)]"
                : "border border-zinc-800 bg-zinc-900/50 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
