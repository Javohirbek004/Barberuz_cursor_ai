import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function generateUsername(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `${base || "barber"}_${suffix}`;
}

export default function Register() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    password: "",
    confirmPassword: "",
    mode: "solo" as "solo" | "team",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({ name: false, password: false, confirmPassword: false });

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
        // Clear any stale Telegram auth code from previous sessions
        localStorage.removeItem("telegram_auth_code");
        localStorage.removeItem("telegram_auth_code_ts");
        localStorage.setItem("barber_token", data.token);
        localStorage.setItem("barber_user", JSON.stringify(data.user));
        toast({ title: t("success") });
        navigate("/verify-telegram");
      },
      onError: () => {
        toast({
          title: t("error"),
          description: t("register.error.register_failed"),
          variant: "destructive",
        });
      },
    },
  });

  const update = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const pwdTooShort = formData.password.length > 0 && formData.password.length < 6;
  const pwdMismatch =
    formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

  const isFormValid =
    formData.name.trim().length > 0 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    registerMutation.mutate({
      data: {
        name: formData.name,
        username: generateUsername(formData.name),
        brandName: formData.brandName || undefined,
        password: formData.password,
        mode: formData.mode,
        lang: (localStorage.getItem("barber_lang") as "uz" | "ru") || "uz",
      },
    });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-12">
      <div className="absolute inset-0 z-0 bg-background" />

      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {t("register.title")}
          </h1>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500/90 text-sm p-3 rounded-xl inline-block mt-2 font-medium">
            {t("register.note")}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.name_required")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder={t("register.name_placeholder")}
                className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              />
            </div>

            {/* Brand name (optional) */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.brandName")}</Label>
              <Input
                value={formData.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                placeholder={t("register.brandName_placeholder")}
                className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.password_label")}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  onBlur={() => touch("password")}
                  placeholder="••••••"
                  className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl pr-12"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-white/40 text-xs">{t("register.password_hint")}</p>
              {touched.password && pwdTooShort && (
                <p className="text-red-400 text-xs">{t("register.error.pwd_short")}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.confirm_password_label")}</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  onBlur={() => touch("confirmPassword")}
                  placeholder="••••••"
                  className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl pr-12"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {pwdMismatch && (
                <p className="text-red-400 text-xs">{t("register.error.pwd_mismatch")}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={registerMutation.isPending || !isFormValid}
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-xl hover:shadow-primary/30 text-black border-0 mt-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {t("register.submit")}
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-2 pb-4">
            {t("register.have_account")}{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              {t("register.login_link")}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
