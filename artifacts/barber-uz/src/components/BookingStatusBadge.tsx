import { AlertTriangle, Calendar, CheckCircle2, UserX, XCircle, type LucideIcon } from "lucide-react";
import { bookingVisualStatus, type BookingVisualKey } from "@/lib/booking-feed";

const LOOK: Record<BookingVisualKey, { Icon: LucideIcon; badge: string; card: string; dot: string; price: string }> = {
  confirmed: {
    Icon: Calendar,
    badge: "bg-blue-500/10 text-blue-500",
    card: "border-blue-500/45 bg-blue-500/10",
    dot: "bg-blue-500",
    price: "text-blue-400",
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
    badge: "bg-green-500/10 text-green-500",
    card: "border-green-500/20 bg-green-500/5 opacity-60",
    dot: "bg-green-500",
    price: "text-foreground/70",
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
    price: "text-red-400/80",
  },
};

export function bookingLook(
  booking: { status: string; date: string; startTime: string },
  now = Date.now(),
) {
  const view = bookingVisualStatus(booking, now);
  return { ...view, ...LOOK[view.key] };
}

export function BookingStatusBadge({
  booking,
  now,
  testId,
}: {
  booking: { status: string; date: string; startTime: string };
  now?: number;
  testId?: string;
}) {
  const view = bookingLook(booking, now);
  const Icon = view.Icon;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 max-w-[9.5rem] px-2 py-0.5 rounded-full text-[11px] font-semibold leading-tight ${view.badge}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span className="text-left">{view.label}</span>
    </span>
  );
}
