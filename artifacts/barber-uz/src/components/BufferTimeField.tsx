import { useEffect, useRef, useState } from "react";
import { ChevronDown, Info, X } from "lucide-react";
import { BUFFER_OPTIONS } from "@/lib/schedule";

export const BUFFER_INFO_TEXT =
  "💡 Ma'lumot: Ushbu tanaffus faqat sizning tahrirlash panelingizda koʻrinadi. Sahifangizda mijozlarga alohida koʻrsatilmaydi.";

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  /** Show the (i) info icon. Only the "Mening sahifam" page uses it. */
  showInfo?: boolean;
}

/**
 * "⏱ Oraliq tanaffus" – preparation gap kept after every service.
 * Shared by settings/profile and settings/page so both edit the same value.
 */
export function BufferTimeField({ value, onChange, showInfo = false }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click outside or Escape closes the tooltip.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      data-testid="buffer-time-field"
      className="relative bg-card border border-white/6 rounded-2xl p-4"
    >
      <div className="flex items-center gap-2">
        <p className="font-semibold text-sm text-foreground">⏱ Oraliq tanaffus</p>
        {showInfo && (
          <button
            type="button"
            aria-label="Oraliq tanaffus haqida ma'lumot"
            aria-expanded={open}
            data-testid="buffer-info-button"
            onClick={() => setOpen((o) => !o)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {showInfo && open && (
        <div
          role="tooltip"
          data-testid="buffer-info-tooltip"
          className="absolute left-0 right-0 bottom-full mb-2 z-20 flex items-start gap-2 rounded-xl border border-white/10 bg-background px-3 py-2.5 text-xs leading-relaxed text-foreground/90 shadow-xl"
        >
          <span data-testid="buffer-info-text" className="flex-1">{BUFFER_INFO_TEXT}</span>
          <button
            type="button"
            aria-label="Yopish"
            data-testid="buffer-info-close"
            onClick={() => setOpen(false)}
            className="shrink-0 w-5 h-5 -mr-1 -mt-0.5 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 mt-0.5 mb-3">
        Xizmatlar orasidagi tayyorgarlik vaqti
      </p>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          data-testid="buffer-time-select"
          className="w-full h-11 appearance-none px-3 pr-9 rounded-xl bg-background/60 border border-white/8 text-sm text-foreground focus:outline-none focus:border-primary/40"
        >
          {BUFFER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}
