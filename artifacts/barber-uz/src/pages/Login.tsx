import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useLoginUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Generate a cryptographically random 16-char hex code. */
function generateAuthCode(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Read stored auth code — survives page refresh. Returns null if older than 10 min. */
function getStoredCode(): string | null {
  const code = localStorage.getItem("telegram_auth_code");
  const ts   = localStorage.getItem("telegram_auth_code_ts");
  if (!code) return null;
  if (ts && Date.now() - Number(ts) > 10 * 60 * 1000) {
    localStorage.removeItem("telegram_auth_code");
    localStorage.removeItem("telegram_auth_code_ts");
    return null;
  }
  return code;
}

export default function Login() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Already logged in — verify token with server before redirecting
  useEffect(() => {
    const token = localStorage.getItem("barber_token");
    const params = new URLSearchParams(window.location.search);
    if (!token || params.has("tg_code") || params.has("authToken")) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.ok) {
          navigate("/dashboard");
        } else {
          localStorage.removeItem("barber_token");
          localStorage.removeItem("barber_user");
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Telegram login state: "idle" | "waiting"
  const [tgState, setTgState] = useState<"idle" | "waiting">(() =>
    getStoredCode() ? "waiting" : "idle",
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Password login ──────────────────────────────────────────
  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("barber_token", data.token);
        localStorage.setItem("barber_user", JSON.stringify(data.user));
        toast({ title: t("success") });
        navigate("/dashboard");
      },
      onError: () => {
        toast({
          title: t("error"),
          description: t("login.error.invalid_credentials"),
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    loginMutation.mutate({ data: { username, password } });
  };

  // ── Handle ?authToken= from bot deep-link (direct login) ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get("authToken");
    if (authToken) {
      localStorage.setItem("barber_token", authToken);
      window.history.replaceState({}, "", window.location.pathname);
      navigate("/dashboard");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle ?tg_code= from bot link (new browser context) ────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tgCode = params.get("tg_code");
    if (tgCode && !getStoredCode()) {
      localStorage.setItem("telegram_auth_code", tgCode);
      localStorage.setItem("telegram_auth_code_ts", String(Date.now()));
      setTgState("waiting");
      // Clean up URL without triggering a reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Telegram login ──────────────────────────────────────────
  function startTelegramLogin() {
    const code = generateAuthCode();
    localStorage.setItem("telegram_auth_code", code);
    localStorage.setItem("telegram_auth_code_ts", String(Date.now()));
    setTgState("waiting");

    const botUrl = `https://t.me/BARBERUZ_YORDAMCHI_BOT?start=auth_${code}_${lang}`;
    window.open(botUrl, "_blank", "noopener,noreferrer");
  }

  function cancelTelegramLogin() {
    stopPolling();
    localStorage.removeItem("telegram_auth_code");
    localStorage.removeItem("telegram_auth_code_ts");
    setTgState("idle");
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Poll the backend every 2s whenever in "waiting" state
  useEffect(() => {
    if (tgState !== "waiting") {
      stopPolling();
      return;
    }

    async function checkStatus() {
      const code = getStoredCode();
      if (!code) {
        cancelTelegramLogin();
        return;
      }

      try {
        const res = await fetch(`/api/auth/telegram-login-status/${code}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.ready && data.token && data.user) {
          stopPolling();
          localStorage.removeItem("telegram_auth_code");
          localStorage.removeItem("telegram_auth_code_ts");
          localStorage.setItem("barber_token", data.token);
          localStorage.setItem("barber_user", JSON.stringify(data.user));
          toast({ title: t("success") });
          navigate("/dashboard");
        }
      } catch {
        // silently retry
      }
    }

    checkStatus(); // immediate first check
    pollRef.current = setInterval(checkStatus, 2000);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgState]);

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-barber.png`}
          alt="Barbershop Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-2xl shadow-primary/10 mb-6">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Barber.uz"
              className="w-12 h-12 object-contain"
            />
          </div>
          <h1 className="text-4xl font-display font-bold text-gradient mb-2">Barber.uz</h1>
          <p className="text-muted-foreground">{t("login.title")}</p>
        </div>

        <AnimatePresence mode="wait">
          {tgState === "waiting" ? (
            // ── Telegram waiting view ────────────────────────
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-8 rounded-3xl text-center space-y-6"
            >
              {/* Animated Telegram icon */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-[#0088cc]/10 border border-[#0088cc]/30 shadow-lg shadow-blue-500/20">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-10 h-10 fill-[#2AABEE]"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  {t("login.telegram.waiting.title")}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed px-2">
                  {t("login.telegram.waiting.desc")}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-1">
                <Loader2 className="w-4 h-4 animate-spin text-[#2AABEE]" />
                <span>{t("verify.checking")}</span>
              </div>

              <Button
                variant="ghost"
                onClick={cancelTelegramLogin}
                className="w-full text-muted-foreground hover:text-foreground border border-white/10 rounded-xl h-11"
              >
                {t("login.telegram.cancel")}
              </Button>
            </motion.div>
          ) : (
            // ── Normal login form ────────────────────────────
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 sm:p-8 rounded-3xl"
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name / username */}
                <div className="space-y-2">
                  <Label className="text-white/80">{t("register.name")}</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("register.name_placeholder")}
                    className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
                  />
                </div>

                {/* Password with eye toggle */}
                <div className="space-y-2">
                  <Label className="text-white/80">{t("register.password")}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loginMutation.isPending || !username || !password}
                  className="w-full h-12 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-lg hover:shadow-primary/30 text-black border-0 mt-4"
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  {t("login.submit")}
                </Button>
              </form>

              <div className="mt-6 flex flex-col items-center gap-4">
                {/* Telegram Login Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={startTelegramLogin}
                  className="w-full h-12 rounded-xl border-[#0088cc]/30 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 hover:border-[#0088cc]/60 text-[#2AABEE] hover:text-[#2AABEE] transition-all"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current flex-shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    {t("login.telegram")}
                  </span>
                </Button>

                <p className="text-sm text-muted-foreground">
                  {t("login.no_account")}{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    {t("register.title")}
                  </Link>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
