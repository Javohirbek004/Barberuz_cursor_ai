import { parseSpecializations, specialtyIcon } from "@/lib/specializations";

export function SpecialtyTags({ value }: { value: string | string[] | null | undefined }) {
  const tags = parseSpecializations(value);
  if (tags.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-sm" aria-hidden="true">✂️</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Mutaxassislik</span>
        <div className="h-px flex-1 bg-white/6" />
      </div>
      <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-none">
        {tags.map((tag, index) => {
          const icon = specialtyIcon(tag);
          return (
            <span
              key={`${tag}-${index}`}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-neutral-700/40 bg-neutral-800/70 px-3 py-1.5 text-xs font-medium text-neutral-300"
            >
              {icon && <span aria-hidden="true">{icon}</span>}
              {tag}
            </span>
          );
        })}
      </div>
    </div>
  );
}
