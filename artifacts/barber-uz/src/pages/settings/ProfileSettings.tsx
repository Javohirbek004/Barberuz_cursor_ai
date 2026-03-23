import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { Card } from "@/components/ui/card";

const THEMES: { value: Theme; labelKey: string }[] = [
  { value: "system", labelKey: "settings.appearance.system" },
  { value: "light",  labelKey: "settings.appearance.light"  },
  { value: "dark",   labelKey: "settings.appearance.dark"   },
];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, changeTheme } = useTheme();

  const isTeam = user?.mode === "team";
  const pageTitle = isTeam ? t("settings.profile.team") : t("settings.profile.solo");

  const { data: profile, isLoading } = useGetProfile();
  const updateMutation = useUpdateProfile();

  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    workingHoursStart: "",
    workingHoursEnd: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        brandName: profile.brandName || "",
        workingHoursStart: profile.workingHoursStart || "09:00",
        workingHoursEnd: profile.workingHoursEnd || "20:00",
      });
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { data: formData },
      {
        onSuccess: () => toast({ title: t("success") }),
        onError:   () => toast({ title: t("error"), variant: "destructive" }),
      }
    );
  };

  if (isLoading)
    return (
      <Layout>
        <div className="py-20 text-center">{t("loading")}</div>
      </Layout>
    );

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">{pageTitle}</h1>
      </div>

      <div className="space-y-5">
        {/* ── User / Salon Info ── */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 bg-card/50 p-5 rounded-3xl border border-white/5">
            <div className="space-y-2">
              <Label>{t("register.name")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background/50 h-12"
              />
            </div>

            {isTeam ? (
              <>
                <div className="space-y-2">
                  <Label>{t("settings.salon.name")}</Label>
                  <Input
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    className="bg-background/50 h-12"
                    placeholder={t("settings.salon.name_placeholder")}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{t("register.brandName")}</Label>
                <Input
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="bg-background/50 h-12"
                />
              </div>
            )}

            <div className="pt-1">
              <Label className="block mb-2">{t("profile.hours")}</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="time"
                  value={formData.workingHoursStart}
                  onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                  className="bg-background/50 h-12"
                />
                <Input
                  type="time"
                  value={formData.workingHoursEnd}
                  onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                  className="bg-background/50 h-12"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
            >
              {t("profile.save")}
            </Button>
          </div>
        </form>

        {/* ── Bildirishnomalar ── */}
        <Link href="/settings/notifications">
          <Card className="px-5 py-4 bg-card border-white/5 flex items-center justify-between hover-lift cursor-pointer group">
            <span className="font-medium text-base text-foreground group-hover:text-primary transition-colors">
              🔔&nbsp;&nbsp;{t("settings.notifications")}
            </span>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Card>
        </Link>

        {/* ── Ilova ko'rinishi ── */}
        <div className="bg-card/50 p-5 rounded-3xl border border-white/5 space-y-3">
          <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            🎨&nbsp;&nbsp;{t("settings.appearance")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, labelKey }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => changeTheme(value)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    active
                      ? "bg-primary text-black border-primary shadow-md shadow-primary/30"
                      : "bg-background/30 text-muted-foreground border-white/5 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {t(labelKey as any)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Hisobdan chiqish ── */}
        <div className="pt-2 pb-4">
          <button
            onClick={logout}
            className="w-full p-5 rounded-2xl bg-destructive/10 text-destructive font-bold text-base flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors border border-destructive/20 active:scale-95 transition-transform"
          >
            🚪&nbsp;&nbsp;{t("settings.logout")}
          </button>
        </div>
      </div>
    </Layout>
  );
}
