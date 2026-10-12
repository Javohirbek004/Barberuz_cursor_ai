import { useState } from "react";

type TabKey = "asosiy" | "xizmatlar";

function VariantLabel({ n, title }: { n: number; title: string }) {
  return (
    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
      {n}-namuna · {title}
    </p>
  );
}

function CapsuleTabs() {
  const [tab, setTab] = useState<TabKey>("asosiy");
  return (
    <div>
      <VariantLabel n={1} title="Kapsula" />
      <div className="flex rounded-full bg-zinc-900 p-1">
        {(["asosiy", "xizmatlar"] as const).map((key) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${
                on
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {key === "asosiy" ? "Asosiy" : "Xizmatlar"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardTabs({ serviceCount }: { serviceCount: number }) {
  const [tab, setTab] = useState<TabKey>("asosiy");
  return (
    <div>
      <VariantLabel n={2} title="Ikkita karta" />
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: "asosiy" as const, label: "🏠 Asosiy" },
          { key: "xizmatlar" as const, label: `✂️ Xizmatlar (${serviceCount})` },
        ]).map((item) => {
          const on = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
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
    </div>
  );
}

function UnderlineTabs() {
  const [tab, setTab] = useState<TabKey>("asosiy");
  return (
    <div>
      <VariantLabel n={3} title="Chiziq va nuqta" />
      <div className="flex border-b border-white/8">
        {(["asosiy", "xizmatlar"] as const).map((key) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${
                on ? "text-foreground" : "text-zinc-500 hover:text-neutral-300"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                {on && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />}
                {key === "asosiy" ? "Asosiy" : "Xizmatlar"}
              </span>
              {on && (
                <span className="absolute inset-x-8 -bottom-px h-0.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabsPreview({ serviceCount = 0 }: { serviceCount?: number }) {
  return (
    <div className="mx-4 mb-4 space-y-5 rounded-3xl border border-amber-500/20 bg-black/40 p-4">
      <div>
        <p className="text-xs font-bold text-amber-400">Namuna — hozircha tanlov</p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
          Pastdagi 3 xil tugmani bosing. Yoqqanini ayting, shunda asosiy sahifaga qo‘yamiz.
        </p>
      </div>
      <CapsuleTabs />
      <CardTabs serviceCount={serviceCount} />
      <UnderlineTabs />
    </div>
  );
}
