import { parseSpecializations, specialtyIcon } from "@/lib/specializations";

export function SpecialtyTags({ value }: { value: string | string[] | null | undefined }) {
  const tags = parseSpecializations(value);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, index) => {
        const icon = specialtyIcon(tag);
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-800/60 px-2.5 py-1 text-xs font-medium text-neutral-300"
          >
            {icon && <span aria-hidden="true">{icon}</span>}
            {tag}
          </span>
        );
      })}
    </div>
  );
}
