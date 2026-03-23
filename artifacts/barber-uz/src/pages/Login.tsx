import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useLoginUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  const telegramLoginUrl = `https://t.me/Barberuz_yordamchi_bot?start=login_${lang}`;

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-barber.png`}
          alt="Barbershop Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      {/* Top right language switcher */}
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

        <div className="glass-panel p-6 sm:p-8 rounded-3xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name / username field */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.name")}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("register.name_placeholder")}
                className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              />
            </div>

            {/* Password field with eye toggle */}
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
            <a
              href={telegramLoginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl border-[#0088cc]/30 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 hover:border-[#0088cc]/60 text-[#2AABEE] hover:text-[#2AABEE] transition-all group"
              >
                <span className="flex items-center gap-2 font-semibold">
                  {/* Official Telegram brand icon */}
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
            </a>

            <p className="text-sm text-muted-foreground">
              {t("login.no_account")}{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                {t("register.title")}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
