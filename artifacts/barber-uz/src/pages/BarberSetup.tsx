import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Eye, EyeOff, Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function TelegramOnboardingModal({
  onActivate,
  onSkip,
}: {
  onActivate: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-7 shadow-2xl text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" className="w-9 h-9 fill-[#2AABEE]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
          </svg>
        </div>

        <div className="mb-1 text-2xl font-display font-bold text-foreground">🚀 Akkaunt tayyor!</div>
        <p className="text-sm text-muted-foreground mt-2 mb-6 leading-relaxed">
          Telegram orqali yangi bronlar, bekor qilishlar va eslatmalarni bevosita Telegramga olishingiz mumkin.
        </p>

        <button
          onClick={onActivate}
          className="w-full h-12 rounded-2xl font-bold text-white bg-[#2AABEE] hover:bg-[#229ED9] transition-all mb-3 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
          </svg>
          Faollashtirish
        </button>

        <button
          onClick={onSkip}
          className="w-full h-10 rounded-2xl font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        >
          Hozir emas
        </button>
      </motion.div>
    </div>
  );
}

export default function BarberSetup() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const pwdShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;

  function handleSubmit() {
    setError("");
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (password !== confirm) {
      setError("Parollar mos kelmadi");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      localStorage.setItem("barber_token", `barber_token_${params.token}`);
      localStorage.setItem("barber_user", JSON.stringify({
        id: params.token,
        name: "Barber",
        mode: "barber_member",
        telegramVerified: false,
      }));
      setShowOnboarding(true);
    }, 1000);
  }

  function handleActivateTelegram() {
    setShowOnboarding(false);
    const userId = params.token || "unknown";
    const botLink = `https://t.me/Barberuz_yordamchi_bot?start=barber_${userId}`;
    window.open(botLink, "_blank");
    navigate("/dashboard");
  }

  function handleSkipTelegram() {
    setShowOnboarding(false);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Scissors className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
          Parol o'ylab toping
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Akkauntingizni himoyalash uchun parol yarating
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white/80 block">
              Yangi parol yarating
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full h-12 px-4 pr-12 rounded-xl bg-black/20 border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm transition-all"
              />
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              >
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-white/40 text-xs">Kamida 6 ta belgi bo'lishi kerak</p>
            <AnimatePresence>
              {pwdShort && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs"
                >
                  Parol kamida 6 ta belgidan iborat bo'lishi kerak
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-white/80 block">
              Parolni qayta kiriting
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••"
                className="w-full h-12 px-4 pr-12 rounded-xl bg-black/20 border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm transition-all"
              />
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <AnimatePresence>
              {mismatch && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs"
                >
                  Parollar mos kelmadi
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={handleSubmit}
            disabled={loading || password.length < 6 || password !== confirm}
            className="w-full h-12 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              "Hisob yaratish"
            )}
          </button>
        </div>
      </motion.div>

      {showOnboarding && (
        <TelegramOnboardingModal
          onActivate={handleActivateTelegram}
          onSkip={handleSkipTelegram}
        />
      )}
    </div>
  );
}
