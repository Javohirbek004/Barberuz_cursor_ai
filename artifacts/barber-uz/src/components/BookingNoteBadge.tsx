export function BookingNoteBadge({
  note,
  muted = false,
}: {
  note?: string | null;
  muted?: boolean;
}) {
  const text = note?.trim();
  if (!text) return null;
  return (
    <div
      className={`text-xs flex items-center gap-1 min-w-0 mt-0.5 ${
        muted ? "text-zinc-500" : "text-amber-200/90"
      }`}
    >
      <span aria-hidden="true">📝</span>
      <span className="truncate max-w-[180px]">{text}</span>
    </div>
  );
}
