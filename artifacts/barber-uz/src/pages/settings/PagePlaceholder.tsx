import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, QrCode } from "lucide-react";

export default function PagePlaceholder() {
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
        <h1 className="text-xl font-bold font-display">{t('settings.page.solo')}</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 mb-6 rotate-3">
          <QrCode className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Tez kunda!</h2>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Mijozlaringiz uchun shaxsiy sahifangiz va QR kodingiz shu yerda shakllantiriladi.
        </p>
      </div>
    </Layout>
  );
}
