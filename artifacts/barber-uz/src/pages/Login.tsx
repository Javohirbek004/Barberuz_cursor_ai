import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useLoginUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RESET_BOT_URL = "https://t.me/BARBERUZ_YORDAMCHI_BOT?start=reset_password";

function looksLikeLegacyUsername(value: string): boolean {
  return /[a-zA-Z_]/.test(value);
}

function formatUzPhoneMask(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (!digits.length) return "";
  let out = "+998";
  if (!digits.length) return out;
  out += ` ${digits.slice(0, 2)}`;
  if (digits.length > 2) out += ` ${digits.slice(2, 5)}`;
  if (digits.length > 5) out += `-${digits.slice(5, 7)}`;
  if (digits.length > 7) out += `-${digits.slice(7, 9)}`;
  return out;
}

function toLoginIdentifier(display: string): string {
  if (looksLikeLegacyUsername(display)) return display.trim();
  const digits = display.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return display.trim();
}

export default function Login() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const resetSuccess = new URLSearchParams(window.location.search).get("reset") === "success";

  useEffect(() => {
    const token = localStorage.getItem("barber_token");
    if (!token || resetSuccess) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.ok) {
          navigate("/dashboard");
        } else {
          localStorage.removeItem("barber_token");
          localStorage.removeItem("barber_user");
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    loginMutation.mutate({ data: { username: toLoginIdentifier(username), password } });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-6 sm:p-8 rounded-3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {resetSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200 leading-relaxed">
                🟢 Parol oʻzgardi. Telefon raqamingiz va yangi parolingizni kiritib profilingizga kiring.
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-white/80">Telefon raqamingizni kiriting:</Label>
              <Input
                value={username}
                onChange={(e) => {
                  const next = e.target.value;
                  setUsername(looksLikeLegacyUsername(next) ? next : formatUzPhoneMask(next));
                }}
                placeholder="+998 90 123-45-67"
                inputMode="tel"
                autoComplete="tel"
                className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              />
            </div>

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

            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-sm text-primary hover:underline font-medium text-left"
            >
              Parolni unutdingizmi?
            </button>

            <Button
              type="submit"
              disabled={loginMutation.isPending || !username || !password}
              className="w-full h-12 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-lg hover:shadow-primary/30 text-black border-0 mt-2"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              {t("login.submit")}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {t("login.no_account")}{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                {t("register.title")}
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="glass-panel border-white/10 sm:rounded-2xl max-w-md">
          <DialogHeader className="text-left space-y-3">
            <DialogTitle className="text-xl">🔒 Parolni tiklash</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Parolni unutdingizmi? Bu muammo emas! Parolni qaytarish uchun pastdagi tugmani bosib botga kiring va
              ro'yxatdan o'tishda ishlatgan telefon raqamingizni yuboring.
            </DialogDescription>
          </DialogHeader>
          <a
            href={RESET_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full h-12 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold transition-colors"
          >
            Telegram bot orqali tiklash 📲
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}
