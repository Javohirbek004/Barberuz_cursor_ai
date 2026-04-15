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
        <h1 className="text-xl font-bold font-display">Bildirishnomalar</h1>
      </div>

      <div className="space-y-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            🔔 Mijoz bronlari
          </p>
          <div className="space-y-2">
            <SwitchRow
              icon="🔔"
              title="Yangi bron"
              desc="Mijoz yangi yozilganda xabar keladi"
              checked={formData.newBooking}
              onChange={v => handleChange("newBooking", v)}
            />
            <SwitchRow
              icon="🔔"
              title="Bekor qilish"
              desc="Mijoz bronni bekor qilsa"
              checked={formData.cancellation}
              onChange={v => handleChange("cancellation", v)}
            />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
            ⏰ Eslatmalar
          </p>
          <div className="space-y-2">
            <SwitchRow
              icon="⏰"
              title="Mijozga eslatma"
              desc="Bron vaqtidan oldin eslatma"
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
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-lg leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
