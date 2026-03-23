import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function FeedbackPage() {
  const { t } = useTranslation();
  useAuth();

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">💬&nbsp;{t("settings.feedback")}</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 mb-6 text-5xl">
          💬
        </div>
        <h2 className="text-2xl font-bold mb-3">{t("coming_soon")}</h2>
        <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
          {t("settings.feedback.desc")}
        </p>
      </div>
    </Layout>
  );
}
