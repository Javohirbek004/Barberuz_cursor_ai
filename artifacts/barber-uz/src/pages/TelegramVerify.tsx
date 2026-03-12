import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useGetTelegramStatus, useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function TelegramVerify() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();

  // Try to get userId from localStorage first (faster than a network call)
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem("barber_user") || "null"); } catch { return null; }
  })();

  const { data: currentUser } = useGetCurrentUser({
    query: { retry: false, staleTime: 30_000, enabled: !storedUser?.id }
  });

  const userId = storedUser?.id || currentUser?.id || "";
  const userName = storedUser?.name || currentUser?.name || "";

  const { data: status } = useGetTelegramStatus(userId, {
    query: {
      refetchInterval: 3000,
      enabled: !!userId,
    },
  });

  // If already verified when landing here, go straight to dashboard
  const redirected = useRef(false);
  useEffect(() => {
    if (status?.verified && !redirected.current) {
      redirected.current = true;
      navigate("/dashboard");
    }
  }, [status, navigate]);

  const botLink = `https://t.me/barberuzbot?start=reg_${userId}_${lang}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center space-y-8"
      >
        {/* Telegram icon */}
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 bg-[#2AABEE]/10 border border-[#2AABEE]/20">
          <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#2AABEE]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-display font-bold text-foreground">
            {t("verify.wait")}
          </h1>
          <p className="text-muted-foreground text-base px-4 leading-relaxed">
            {t("verify.message")}
          </p>
        </div>

        {/* Steps */}
        <div className="glass-panel rounded-2xl p-5 text-left space-y-3">
          <Step n={1} text={lang === "uz"
            ? "Quyidagi tugmani bosib botni oching"
            : "Нажмите кнопку ниже, чтобы открыть бота"} />
          <Step n={2} text={lang === "uz"
            ? `Bot sizga salom beradi va "📱 Raqamni yuborish" tugmasini ko'rasiz`
            : `Бот поприветствует вас и покажет кнопку "📱 Отправить номер"`} />
          <Step n={3} text={lang === "uz"
            ? "Raqamni yuboring — sahifa avtomatik ochiladi"
            : "Отправьте номер — страница откроется автоматически"} />
        </div>

        <a href={botLink} target="_blank" rel="noopener noreferrer" className="block w-full">
          <Button className="w-full h-14 text-lg font-bold rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all">
            {t("verify.btn")}
          </Button>
        </a>

        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>{t("verify.checking")}</span>
        </div>
      </motion.div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}
