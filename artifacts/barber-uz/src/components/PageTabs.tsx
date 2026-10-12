export function PageTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (tab: T) => void;
  items: { key: T; label: string }[];
  serviceCount?: number;
}) {
  return (
    <div className="flex rounded-full bg-zinc-900/80 p-1">
      {items.map((item) => {
        const on = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
              on ? "bg-zinc-800 text-white" : "bg-transparent text-zinc-400"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
