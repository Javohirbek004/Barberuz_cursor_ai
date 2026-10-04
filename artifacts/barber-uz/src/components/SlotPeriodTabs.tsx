import { SLOT_PERIODS, type SlotPeriod } from "@/lib/schedule";

interface Props {
  value: SlotPeriod;
  onChange: (period: SlotPeriod) => void;
}

/** Segmented filter: Barchasi / Ertalab / Tushdan keyin / Kechki. */
export function SlotPeriodTabs({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Kun qismi"
      data-testid="slot-period-tabs"
      className="grid grid-cols-4 gap-1 p-1 mb-3 rounded-2xl bg-white/5 border border-white/8"
    >
      {SLOT_PERIODS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-period={p.value}
            onClick={() => onChange(p.value)}
            className={`min-h-[34px] px-1 py-1.5 rounded-xl text-[11px] font-semibold leading-tight text-center transition-all ${
              active
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground border border-transparent hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
