import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion } from "framer-motion";
import { Loader2, User, Users, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    brandName: "",
    password: "",
    confirmPassword: "",
    mode: "solo" as "solo" | "team",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [touched, setTouched] = useState({
    name: false,
    password: false,
    confirmPassword: false,
  });

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("barber_token", data.token);
        localStorage.setItem("barber_user", JSON.stringify(data.user));
        toast({ title: t("success") });
        navigate("/verify-telegram");
      },
      onError: () => {
        toast({
          title: t("error"),
          description: "Foydalanuvchi nomi allaqachon band.",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    registerMutation.mutate({
      data: {
        name: formData.name,
        username: formData.username,
        brandName: formData.brandName || undefined,
        password: formData.password,
        mode: formData.mode,
        lang: "uz",
      },
    });
  };

  const update = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const pwdTooShort = formData.password.length > 0 && formData.password.length < 6;
  const pwdMismatch =
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;

  const isFormValid =
    formData.name.trim().length > 0 &&
    formData.username.trim().length > 0 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword;

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
              <Label className="text-white/80">{t("register.name")} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder={t("register.name_placeholder")}
                className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.username")} *</Label>
              <Input
                value={formData.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder={t("register.username_placeholder")}
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
              <Label className="text-white/80">{t("register.password")} *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  onBlur={() => touch("password")}
                  placeholder="••••••••"
                  className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {touched.password && pwdTooShort && (
                <p className="text-red-400 text-xs mt-1">{t("register.error.pwd_short")}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label className="text-white/80">{t("register.confirm_password")} *</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  onBlur={() => touch("confirmPassword")}
                  placeholder="••••••••"
                  className="bg-black/20 border-white/10 focus-visible:ring-primary h-12 rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {pwdMismatch && (
                <p className="text-red-400 text-xs mt-1">{t("register.error.pwd_mismatch")}</p>
              )}
            </div>
          </div>

          {/* Mode selection */}
          <div className="space-y-3">
            <Label className="text-white/80 pl-2">{t("register.mode")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => update("mode", "solo")}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-300 ${
                  formData.mode === "solo"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-white/5 bg-black/20 hover:border-white/20"
                }`}
              >
                <User
                  className={`w-8 h-8 mb-3 ${
                    formData.mode === "solo" ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div className="font-bold text-foreground">{t("register.mode.solo")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("register.mode.solo_sub")}</div>
              </div>

              <div
                onClick={() => update("mode", "team")}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-300 ${
                  formData.mode === "team"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-white/5 bg-black/20 hover:border-white/20"
                }`}
              >
                <Users
                  className={`w-8 h-8 mb-3 ${
                    formData.mode === "team" ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div className="font-bold text-foreground">{t("register.mode.team")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("register.mode.team_sub")}</div>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={registerMutation.isPending || !isFormValid}
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-xl hover:shadow-primary/30 text-black border-0 mt-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
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
