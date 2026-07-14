import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useGetTelegramStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";

function getStoredUserId(): string {
  try {
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return u?.id || "";
  } catch {
    return "";
  }
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem("barber_token");
  } catch {
    return null;
  }
}

function isAlreadyVerified(): boolean {
  try {
    const token = getStoredToken();
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return !!(token && u?.telegramVerified === true);
  } catch {
    return false;
  }
}

export default function TelegramVerify() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();

  // If user already has a valid token + telegramVerified, skip this page
  useEffect(() => {
    if (isAlreadyVerified()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  // Initialise userId from localStorage
  const [userId, setUserId] = useState<string>(getStoredUserId);
  // Track whether verification just completed and no token is present in this tab
  const [showReturnToTab, setShowReturnToTab] = useState(false);

  // If opened via bot link: read ?uid= and ?token= from URL.
  // When a token is present, auto-login the user and go to dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const token = params.get("token");

    if (token) {
      localStorage.setItem("barber_token", token);
      navigate("/dashboard");
      return;
    }

    if (!userId && uid) {
      setUserId(uid);
    }
  }, []);

  // Poll verification status every 3 s
  const { data: status } = useGetTelegramStatus(userId, {
    query: {
      refetchInterval: 3000,
      enabled: !!userId,
    },
  });

  // Redirect or show "return to original tab" when verification succeeds
  const redirected = useRef(false);
  useEffect(() => {
    if (status?.verified && !redirected.current) {
      redirected.current = true;

      // Persist verified flag in localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("barber_user") || "null");
        if (stored) {
          stored.telegramVerified = true;
          localStorage.setItem("barber_user", JSON.stringify(stored));
        }
      } catch {
        // ignore
      }

      // If this tab has a token, go to dashboard directly.
      // If no token (opened in new browser/device via bot link),
      // tell the user to return to the original tab instead of bouncing.
      if (getStoredToken()) {
        navigate("/dashboard");
      } else {
        setShowReturnToTab(true);
      }
    }
  }, [status, navigate]);

  const botLink = `tg://resolve?domain=BARBERUZ_YORDAMCHI_BOT&start=reg_${userId}_${lang}`;

  // ── "Return to original tab" screen ───────────────────────────────────────
  if (showReturnToTab) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center space-y-6"
        >
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t("verify.confirmed.title")}
            </h1>
            <p className="text-muted-foreground text-base px-4 leading-relaxed">
              {t("verify.confirmed.desc")}
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">
            {t("verify.confirmed.close")}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Waiting screen ─────────────────────────────────────────────────────────
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
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
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
          <Step n={1} text={t("verify.step1")} />
          <Step n={2} text={t("verify.step2")} />
          <Step n={3} text={t("verify.step3")} />
        </div>

        <a
          href={userId ? botLink : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <Button
            disabled={!userId}
            className="w-full h-14 text-lg font-bold rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
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
