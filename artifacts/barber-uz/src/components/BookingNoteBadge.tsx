export function BookingNoteBadge({ note }: { note?: string | null }) {
  const text = note?.trim();
  if (!text) return null;
  return (
    <div className="text-xs text-amber-200/90 flex items-center gap-1 min-w-0 mt-0.5">
      <span aria-hidden="true">📝</span>
      <span className="truncate max-w-[180px]">{text}</span>
    </div>
  );
}
