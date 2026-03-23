import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const isTeam = user?.mode === "team";

  const soloItems = [
    { href: "/settings/profile",   label: "👤  " + t("settings.profile.solo") },
    { href: "/settings/page",      label: "🌐  " + t("settings.page.solo") },
    { href: "/settings/analytics", label: "📊  " + t("settings.analytics") },
    { href: "/settings/bonus",     label: "💰  " + t("settings.bonus") },
    { href: "/settings/feedback",  label: "💬  " + t("settings.feedback") },
  ];

  const teamItems = [
    { href: "/settings/profile",   label: "🏢  " + t("settings.profile.team") },
    { href: "/settings/page",      label: "🌐  " + t("settings.page.team") },
    { href: "/settings/analytics", label: "📊  " + t("settings.analytics") },
    { href: "/settings/barbers",   label: "👷‍♂️  " + t("settings.barbers") },
    { href: "/settings/bonus",     label: "💰  " + t("settings.bonus") },
    { href: "/settings/feedback",  label: "💬  " + t("settings.feedback") },
  ];

  const menuItems = isTeam ? teamItems : soloItems;

  return (
    <Layout>
      <PageHeader title={t("settings.title")} />

      <div className="space-y-2.5">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="px-5 py-4 bg-card border-white/5 flex items-center justify-between hover-lift cursor-pointer group">
              <span className="font-medium text-base text-foreground group-hover:text-primary transition-colors">
                {item.label}
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
