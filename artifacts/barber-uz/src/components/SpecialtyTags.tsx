import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { parseSpecializations, specialtyDisplayIcon } from "@/lib/specializations";

export const SPECIALTY_PILL_CLASS =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-neutral-700/40 bg-neutral-800/70 px-3 py-1.5 text-xs font-medium text-neutral-300";

export const SPECIALTY_TAG_ROW_CLASS = "flex flex-nowrap overflow-x-auto scrollbar-none gap-2 py-1";

const SCROLL_FADE =
  "after:pointer-events-none after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-6 after:bg-gradient-to-l after:from-zinc-950 after:to-transparent";

export function SpecialtyTagScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setShowFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [children, update]);

  return (
    <div className={`relative min-w-0 ${showFade ? SCROLL_FADE : ""}`}>
      <div ref={ref} className={SPECIALTY_TAG_ROW_CLASS}>
        {children}
      </div>
    </div>
  );
}

export function SpecialtyTags({ value }: { value: string | string[] | null | undefined }) {
  const tags = parseSpecializations(value);
  if (tags.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-sm" aria-hidden="true">⭐</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Mutaxassislik</span>
        <div className="h-px flex-1 bg-white/6" />
      </div>
      <SpecialtyTagScroller>
        {tags.map((tag, index) => {
          const icon = specialtyDisplayIcon(tag);
          return (
            <span key={`${tag}-${index}`} className={SPECIALTY_PILL_CLASS}>
              {icon && <span aria-hidden="true">{icon}</span>}
              {tag}
            </span>
          );
        })}
      </SpecialtyTagScroller>
    </div>
  );
}
