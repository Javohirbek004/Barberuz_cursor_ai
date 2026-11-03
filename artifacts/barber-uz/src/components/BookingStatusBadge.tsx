import { AlertTriangle, Calendar, CheckCircle2, UserX, XCircle, type LucideIcon } from "lucide-react";
import { bookingVisualStatus, type BookingVisualKey } from "@/lib/booking-feed";

const LOOK: Record<BookingVisualKey, { Icon: LucideIcon; badge: string; card: string; dot: string; price: string }> = {
  confirmed: {
    Icon: Calendar,
    badge: "bg-green-500/10 text-green-500",
    card: "border-green-500/55 bg-green-500/15",
    dot: "bg-green-500",
    price: "text-green-400",
  },
  pending_action: {
    Icon: AlertTriangle,
    badge: "bg-yellow-500/10 text-yellow-500",
    card: "border-yellow-500/45 bg-yellow-500/10",
    dot: "bg-yellow-500",
    price: "text-yellow-400",
  },
  completed: {
    Icon: CheckCircle2,
    badge: "bg-blue-500/15 text-blue-400",
    card: "border-blue-500/60 bg-blue-500/20 opacity-60",
    dot: "bg-blue-500",
    price: "text-blue-300",
  },
  no_show: {
    Icon: UserX,
    badge: "bg-red-500/10 text-red-500",
    card: "border-red-500/35 bg-red-500/5",
    dot: "bg-red-500",
    price: "text-red-400/70 line-through",
  },
  cancelled: {
    Icon: XCircle,
    badge: "bg-red-500/10 text-red-500",
    card: "border-red-500/30 bg-red-500/5",
    dot: "bg-red-500",
    price: "text-red-400/70 line-through",
  },
};

export function bookingLook(
  booking: { status: string; date: string; startTime: string },
  now = Date.now(),
) {
  const view = bookingVisualStatus(booking, now);
  return { ...view, ...LOOK[view.key] };
}

/** Yellow mark for a client the bot does not know: no Telegram link. */
export function showsBotGap(record: object): boolean {
  const row = record as { botLinked?: boolean; telegramId?: string | null };
  if (row.botLinked === true) return false;
  if (row.telegramId?.trim()) return false;
  return true;
}

/** Inside a booking or a client profile. The button does nothing until the copy step is added. */
export function BotLinkPrompt({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      data-testid="bot-link-box"
      className="mt-3 rounded-2xl border border-primary/45 bg-primary/10 px-3 py-3"
    >
      <p className="mb-2 text-xs text-muted-foreground">Bot holati</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-primary">⚠️ Botga ulanmagan</span>
        <button
          type="button"
          data-testid="bot-link-button"
          className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-extrabold text-primary-foreground"
        >
          Botga ulash
        </button>
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">
        Mijozga eslatmalar borishi uchun botga ulang!
      </p>
    </div>
  );
}

export function BotUnlinkedBang({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="shrink-0 inline-flex items-center gap-0.5 text-sm leading-none" aria-hidden>
      <span>⚠️</span>
      <span>🔕</span>
    </span>
  );
}

export function BookingStatusBadge({
  booking,
  now,
  testId,
  className,
}: {
  booking: { status: string; date: string; startTime: string };
  now?: number;
  testId?: string;
  className?: string;
}) {
  const view = bookingLook(booking, now);
  const Icon = view.Icon;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold leading-tight ${className ?? "max-w-[9.5rem]"} ${view.badge}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span className="text-left">{view.label}</span>
    </span>
  );
}
