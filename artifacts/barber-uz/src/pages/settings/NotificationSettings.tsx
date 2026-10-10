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
import { ChevronLeft, BellRing, BellOff, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deviceHeaders } from "@/lib/device";

type ClientOff = "quick" | "auto";

type FormState = {
  newBooking: boolean;
  cancellation: boolean;
  reminders: boolean;
  reminderMinutes: number;
  eveningConfirm: boolean;
  quickReminder: boolean;
  autoCancel: boolean;
};

const CONFIRM_COPY: Record<ClientOff, { title: string; body: string }> = {
  quick: {
    title: "⚠️ Tezkor eslatmani o'chirasizmi?",
    body: "Xizmatga 1-3 soat qolganda mijozlarga qayta eslatma bormaydi. Bu mijoz navbatini unutib qo'yishi va kelmay qolishi xavfini oshiradi.",
  },
  auto: {
    title: "⚠️ Avto-bekor qilishni o'chirasizmi?",
    body: "Javob bermagan mijozlar bronlari avtomatik bekor qilinmaydi. Bu xizmat vaqtida kelmaydigan mijozlar sababli bo'sh vaqtlaringiz kuyib ketishiga olib kelishi mumkin.",
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
  });
  const [confirmOff, setConfirmOff] = useState<ClientOff | null>(null);
  const [testing15, setTesting15] = useState(false);

  const run15MinTest = async () => {
    if (testing15) return;
    setTesting15(true);
    try {
      const res = await fetch("/api/settings/test-15min-reminder", {
        method: "POST",
        headers: deviceHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Sinov yuborilmadi. Qayta urinib ko'ring.", variant: "destructive" });
        return;
      }
      if (!data.telegramLinked) {
        toast({ title: "Avval Telegramni ulang — xabar ketmadi.", variant: "destructive" });
        return;
      }
      if (data.sent) {
        toast({ title: `Telegramga «${data.remainingMinutes} daqiqa qoldi» ketdi` });
      } else {
        toast({ title: "Bron ochildi, lekin Telegramga xabar ketmadi.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Sinov yuborilmadi. Qayta urinib ko'ring.", variant: "destructive" });
    } finally {
      setTesting15(false);
    }
  };

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

  const handleChange = (key: keyof FormState, value: boolean | number) => {
    save({ ...formData, [key]: value });
  };

  const applyOff = () => {
    if (!confirmOff) return;
    const key = confirmOff === "quick" ? "quickReminder" : "autoCancel";
    setConfirmOff(null);
    save({ ...formData, [key]: false });
  };

  if (isLoading)
    return <Layout><div className="py-20 text-center">{t("loading")}</div></Layout>;

  const copy = confirmOff ? CONFIRM_COPY[confirmOff] : null;

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
              onChange={v => handleChange("newBooking", v)}
            />
            <SwitchRow
              icon={<BellOff className="w-4 h-4 text-red-400" />}
              title={t("notif.cancellation")}
              desc={t("notif.cancellation_desc")}
              checked={formData.cancellation}
              onChange={v => handleChange("cancellation", v)}
            />
          </div>
        </section>

        <section data-testid="client-notifications">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            ⏰ Mijozlarga eslatmalar va Avto-bekor qilish
          </p>
          <div className="space-y-2">
            <SwitchRow
              testId="client-evening"
              icon={<span className="text-base leading-none">🔔</span>}
              title="Kechki tasdiqlash xabari (20:00)"
              desc="Ertangi mijozlarga bir kun oldin kechqurun soat 20:00 da tasdiqlash so'rovi yuboriladi"
              checked={formData.eveningConfirm}
              onChange={v => {
                save(
                  { ...formData, eveningConfirm: v },
                  v ? undefined : "Kechki tasdiqlash xabari o'chirildi",
                );
              }}
            />
            <SwitchRow
              testId="client-quick"
              icon={<span className="text-base leading-none">⏰</span>}
              title="Tezkor eslatma (1-3 soat qolganda)"
              desc="Tasdiqlanmagan mijozlarga navbatga 3 soatdan 1 soatgacha vaqt qolganda tasdiq so'rovi yuboriladi"
              checked={formData.quickReminder}
              onChange={v => {
                if (!v) {
                  setConfirmOff("quick");
                  return;
                }
                save({ ...formData, quickReminder: true });
              }}
            />
            <SwitchRow
              testId="client-auto"
              icon={<span className="text-base leading-none">🚫</span>}
              title="Tasdiqlanmagan bronlarni avto-bekor qilish"
              desc="Navbatga 1 soat qolganda ham tasdiqlanmagan bronlar avtomatik bekor qilinadi"
              checked={formData.autoCancel}
              onChange={v => {
                if (!v) {
                  setConfirmOff("auto");
                  return;
                }
                save({ ...formData, autoCancel: true });
              }}
            />
          </div>
        </section>

        <section data-testid="barber-15min-test">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            Sinov
          </p>
          <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground leading-tight">
                  8 daqiqa eslatmasini sinash
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  8 daqiqadan keyin «Sinov mijoz» bron ochiladi va Telegramga hozir xabar ketadi. Haqiqiy mijozlarga tegmaydi.
                </p>
              </div>
            </div>
            <Button
              type="button"
              data-testid="test-15min-reminder"
              onClick={run15MinTest}
              disabled={testing15}
              className="w-full h-11 rounded-2xl font-semibold"
            >
              {testing15 ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hozir sinash"}
            </Button>
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
