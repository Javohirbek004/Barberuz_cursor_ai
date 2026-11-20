import { useEffect, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
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
import { useBotUsername } from "@/lib/bot-link";
import { pathAfterAuth } from "@/lib/onboarding";
import { signupSlug } from "@/lib/signup-name";

const LAST_SLUG_KEY = "zumio_last_slug";

function readLoginError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("data" in err)) return false;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("error" in data)) return false;
  const code = (data as { error?: unknown }).error;
  return code === "USER_NOT_FOUND" || code === "INVALID_PASSWORD";
}

export default function Login() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [formError, setFormError] = useState<"empty" | "invalid" | null>(null);
  const botUsername = useBotUsername();
  const resetSuccess = new URLSearchParams(window.location.search).get("reset") === "success";
  const entryCode = new URLSearchParams(window.location.search).get("entry");

  useEffect(() => {
    if (entryCode) return;
    const token = localStorage.getItem("barber_token");
    if (!token || resetSuccess) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.ok) {
          navigate(pathAfterAuth());
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
        const slug = signupSlug(data.user.name) || signupSlug(username);
        if (slug) localStorage.setItem(LAST_SLUG_KEY, slug);
        localStorage.setItem("barber_token", data.token);
        localStorage.setItem("barber_user", JSON.stringify(data.user));
        toast({ title: t("success") });
        navigate(pathAfterAuth());
      },
      onError: (err) => {
        if (readLoginError(err)) {
          setFormError("invalid");
          return;
        }
        toast({
          title: t("error"),
          description: t("login.error.bad"),
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMutation.isPending) return;
    const slug = signupSlug(username);
    if (!username.trim() || !password) {
      setFormError("empty");
      return;
    }
    if (!slug) {
      setFormError("invalid");
      return;
    }
    loginMutation.mutate({ data: { username: slug, password } });
  };

  if (entryCode) {
    return <Redirect to={`/dashboard?entry=${encodeURIComponent(entryCode)}`} />;
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/auth-shop.jpg`}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/42 to-black/62" />
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
          <img
            src={`${import.meta.env.BASE_URL}images/zumio-pin.png`}
            alt=""
            width={257}
            height={321}
            className="mx-auto mb-3 h-20 w-auto object-contain"
          />
          <h1 aria-label="Zumio" className="mb-2 flex items-end justify-center font-display text-5xl font-extrabold leading-none tracking-tight text-[#12304A]">
            <span aria-hidden>Zum</span>
            <span aria-hidden className="relative mx-[0.01em] inline-block">
              <span className="inline-block h-[0.72em] overflow-hidden leading-none">i</span>
              <img
                src={`${import.meta.env.BASE_URL}images/zumio-i-pin.png`}
                alt=""
                width={52}
                height={66}
                className="absolute bottom-[0.78em] left-1/2 h-[0.42em] w-auto -translate-x-1/2 object-contain"
              />
            </span>
            <span aria-hidden>o</span>
          </h1>
          <p className="text-muted-foreground">{t("login.title")}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-white/12 bg-[#16181c]/55 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {resetSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200 leading-relaxed">
                {t("login.reset_success")}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-white/80">{t("login.phone_label")}</Label>
              <Input
                value={username}
                onChange={(e) => {
                  setFormError(null);
                  setUsername(e.target.value);
                }}
                placeholder={t("login.phone_placeholder")}
                autoComplete="username"
                className="h-12 rounded-xl border-white/10 bg-[#10141c]/60 text-white placeholder:text-white/40 focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">{t("register.password")}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setFormError(null);
                    setPassword(e.target.value);
                  }}
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-white/10 bg-[#10141c]/60 pr-12 text-white placeholder:text-white/40 focus-visible:ring-primary"
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
              className="text-left text-sm text-primary underline underline-offset-4"
            >
              {t("login.forgot")}
            </button>

            {formError && (
              <p className="text-sm leading-snug text-red-400">
                {formError === "empty" ? t("login.error.missing") : t("login.error.bad")}
              </p>
            )}

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-lg hover:shadow-primary/30 text-black border-0 mt-2"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              {loginMutation.isPending ? t("login.loading") : t("login.submit")}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-400">
              {t("login.no_account")}{" "}
              <Link
                href="/register"
                className="font-semibold text-amber-400 underline underline-offset-4"
              >
                {t("register.title")}
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="glass-panel border-white/10 sm:rounded-2xl max-w-md">
          <DialogHeader className="text-left space-y-3">
            <DialogTitle className="text-xl">{t("login.forgot_title")}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("login.forgot_body")}
            </DialogDescription>
          </DialogHeader>
          <a
            href={`https://t.me/${botUsername}?start=reset_password`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full h-12 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold transition-colors"
          >
            {t("login.forgot_button")}
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}
