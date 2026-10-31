import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import {
  useGetNotificationSettings,
  useUpdateNotificationSettings,
  type NotificationSettings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, BellRing, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ClientOff = "newBooking" | "cancellation" | "remind24" | "remind1h";

type FormState = {
  newBooking: boolean;
  cancellation: boolean;
  reminders: boolean;
  reminderMinutes: number;
  eveningConfirm: boolean;
  quickReminder: boolean;
  autoCancel: boolean;
  cancelLimit: number;
};

const CANCEL_LIMITS = [
  { value: 30, label: "30 daqiqa" },
  { value: 60, label: "1 soat" },
  { value: 120, label: "2 soat" },
  { value: 180, label: "3 soat" },
];

const CONFIRM_COPY: Record<ClientOff, { title: string; body: string }> = {
  newBooking: {
    title: "⚠️ Ogohlantirish",
    body: "Siz haqiqatan ham \"Yangi bron\" bildirishnomalarini o‘chirmoqchimisiz? Agar o‘chirsangiz, yangi bron haqida sizga Telegramdan xabar kelmaydi. Mijozga tasdiq xabari avvalgidek boradi.",
  },
  cancellation: {
    title: "⚠️ Ogohlantirish",
    body: "Siz haqiqatan ham \"Bekor qilish\" bildirishnomalarini o‘chirmoqchimisiz? Agar o‘chirsangiz, mijoz bronni bekor qilsa Telegram botdan xabar kelmaydi.",
  },
  remind24: {
    title: "Diqqat!",
    body: "Ushbu eslatmani o'chirsangiz, mijozlarga avtomatik xabarnomalar bormaydi. Rostdan ham o'chirmoqchimisiz?",
  },
  remind1h: {
    title: "Diqqat!",
    body: "Ushbu eslatmani o'chirsangiz, mijozlarga avtomatik xabarnomalar bormaydi. Rostdan ham o'chirmoqchimisiz?",
  },
};

function readForm(settings: NotificationSettings): FormState {
  const extra = settings as NotificationSettings & Partial<FormState>;
  return {
    newBooking: settings.newBooking,
    cancellation: settings.cancellation,
    reminders: settings.reminders,
    reminderMinutes: settings.reminderMinutes || 30,
    eveningConfirm: extra.eveningConfirm !== false,
    quickReminder: extra.quickReminder !== false,
    autoCancel: extra.autoCancel !== false,
    cancelLimit: CANCEL_LIMITS.some(item => item.value === extra.cancelLimit) ? extra.cancelLimit! : 60,
  };
}

export default function NotificationSettings() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();

  const [formData, setFormData] = useState<FormState>({
    newBooking: true,
    cancellation: true,
    reminders: true,
    reminderMinutes: 30,
    eveningConfirm: true,
    quickReminder: true,
    autoCancel: true,
    cancelLimit: 60,
  });
  const [confirmOff, setConfirmOff] = useState<ClientOff | null>(null);

  useEffect(() => {
    if (settings) setFormData(readForm(settings));
  }, [settings]);

  useEffect(() => {
    if (!confirmOff) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmOff(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [confirmOff]);

  const save = (updated: FormState, notice?: string) => {
    setFormData(updated);
    updateMutation.mutate({ data: updated as NotificationSettings }, {
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
    if (notice) toast({ title: notice });
  };

  const applyOff = () => {
    if (!confirmOff) return;
    const key = confirmOff === "remind24"
      ? "eveningConfirm"
      : confirmOff === "remind1h"
        ? "quickReminder"
        : confirmOff;
    setConfirmOff(null);
    save({ ...formData, [key]: false });
  };

  if (isLoading)
    return <Layout><div className="py-20 text-center">{t("loading")}</div></Layout>;

  const copy = confirmOff ? CONFIRM_COPY[confirmOff] : null;
  const bookingWarning = confirmOff === "newBooking" || confirmOff === "cancellation";
  const reminderWarning = confirmOff === "remind24" || confirmOff === "remind1h";

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings/general">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">{t("notif.title")}</h1>
      </div>

      <div className="space-y-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            {t("notif.section.bookings")}
          </p>
          <div className="space-y-2">
            <SwitchRow
              icon={<BellRing className="w-4 h-4 text-primary" />}
              title={t("notif.new_booking")}
              desc={t("notif.new_booking_desc")}
              checked={formData.newBooking}
              testId="booking-new"
              onChange={v => {
                if (!v) {
                  setConfirmOff("newBooking");
                  return;
                }
                save({ ...formData, newBooking: true });
              }}
            />
            <SwitchRow
              icon={<BellOff className="w-4 h-4 text-red-400" />}
              title={t("notif.cancellation")}
              desc={t("notif.cancellation_desc")}
              checked={formData.cancellation}
              testId="booking-cancel"
              onChange={v => {
                if (!v) {
                  setConfirmOff("cancellation");
                  return;
                }
                save({ ...formData, cancellation: true });
              }}
            />
          </div>
        </section>

        <section data-testid="client-notifications">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            ⏰ Mijozlarga eslatmalar
          </p>
          <div className="space-y-2">
            <SwitchRow
              testId="client-24h"
              icon={<span className="text-base leading-none">🔔</span>}
              title="24 soat oldingi eslatma"
              desc="Bron vaqtiga 24 soat (1 kun) qolganda mijozga eslatma va bekor qilish tugmasi yuboriladi"
              checked={formData.eveningConfirm}
              onChange={v => {
                if (!v) {
                  setConfirmOff("remind24");
                  return;
                }
                save({ ...formData, eveningConfirm: true });
              }}
            />
            <SwitchRow
              testId="client-1h"
              icon={<span className="text-base leading-none">⏰</span>}
              title="1 soat oldingi tezkor eslatma"
              desc="Bron vaqtiga 1 soat qolganda mijozga yo'lga chiqish va ogohlantirish xabari yuboriladi"
              checked={formData.quickReminder}
              onChange={v => {
                if (!v) {
                  setConfirmOff("remind1h");
                  return;
                }
                save({ ...formData, quickReminder: true });
              }}
            />
            <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5">
              <p className="font-semibold text-sm text-foreground leading-tight">Bot orqali bekor qilish vaqti cheklovi</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bron vaqtiga bu vaqtdan kam qolganda mijoz bot orqali bronni o‘zi bekor qila olmaydi</p>
              <select
                data-testid="client-cancel-limit"
                value={formData.cancelLimit}
                onChange={event => save({ ...formData, cancelLimit: Number(event.target.value) })}
                className="mt-3 w-full h-11 rounded-2xl bg-black/20 border border-white/10 px-3 text-sm text-foreground"
              >
                {CANCEL_LIMITS.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>

      {copy && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" data-testid="client-off-confirm">
          <button
            type="button"
            aria-label="Ortga"
            className="absolute inset-0 bg-black/70"
            onClick={() => setConfirmOff(null)}
          />
          <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground text-center mb-2">{copy.title}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-6">{copy.body}</p>
            <div className="flex gap-3">
              {bookingWarning ? (
                <>
                  <button
                    type="button"
                    data-testid="booking-off-submit"
                    onClick={applyOff}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm"
                  >
                    Ha, o‘chirish
                  </button>
                  <button
                    type="button"
                    data-testid="booking-off-keep"
                    onClick={() => setConfirmOff(null)}
                    className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm"
                  >
                    Yo‘q, qoldirish
                  </button>
                </>
              ) : reminderWarning ? (
                <>
                  <button
                    type="button"
                    data-testid="remind-off-submit"
                    onClick={applyOff}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm"
                  >
                    ✅ Ha, o‘chirish
                  </button>
                  <button
                    type="button"
                    data-testid="remind-off-keep"
                    onClick={() => setConfirmOff(null)}
                    className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm"
                  >
                    🛑 Bekor qilmaslik
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="client-off-back"
                    onClick={() => setConfirmOff(null)}
                    className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm"
                  >
                    Ortga
                  </button>
                  <button
                    type="button"
                    data-testid="client-off-submit"
                    onClick={applyOff}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm"
                  >
                    Ha, o'chirilsin
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Layout>
  );
}

function SwitchRow({
  icon,
  title,
  desc,
  checked,
  onChange,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}
