import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { useGetNotificationSettings, useUpdateNotificationSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotificationSettings() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();

  const [formData, setFormData] = useState({
    newBooking: true,
    cancellation: true,
    reminders: true,
    reminderMinutes: 30,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        newBooking: settings.newBooking,
        cancellation: settings.cancellation,
        reminders: settings.reminders,
        reminderMinutes: settings.reminderMinutes || 30,
      });
    }
  }, [settings]);

  const handleChange = (key: keyof typeof formData, value: boolean | number) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    updateMutation.mutate({ data: updated }, {
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  if (isLoading)
    return <Layout><div className="py-20 text-center">{t("loading")}</div></Layout>;

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
              title={t("notif.new_booking")}
              desc={t("notif.new_booking_desc")}
              checked={formData.newBooking}
              onChange={v => handleChange("newBooking", v)}
            />
            <SwitchRow
              title={t("notif.cancellation")}
              desc={t("notif.cancellation_desc")}
              checked={formData.cancellation}
              onChange={v => handleChange("cancellation", v)}
            />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            {t("notif.section.reminders")}
          </p>
          <div className="space-y-2">
            <SwitchRow
              title={t("notif.reminder")}
              desc={t("notif.reminder_desc")}
              checked={formData.reminders}
              onChange={v => handleChange("reminders", v)}
            />
          </div>
        </section>
      </div>
    </Layout>
  );
}

function SwitchRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
