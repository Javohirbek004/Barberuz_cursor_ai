import { useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

function generateUsername(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "usta").slice(0, 24);
}

type FieldKey = "name" | "password" | "confirmPassword";

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
  const [attempted, setAttempted] = useState(false);

  const fieldRefs = {
    name: useRef<HTMLDivElement>(null),
    brandName: useRef<HTMLDivElement>(null),
    password: useRef<HTMLDivElement>(null),
    confirmPassword: useRef<HTMLDivElement>(null),
  };
  const inputRefs = {
    name: useRef<HTMLInputElement>(null),
    brandName: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
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

  const errors: Record<FieldKey, string> = {
    name: formData.name.trim() ? "" : t("register.error.name"),
    password: formData.password.length >= 6 ? "" : t("register.error.pwd_short"),
    confirmPassword: !formData.confirmPassword
      ? t("register.error.confirm_required")
      : formData.password !== formData.confirmPassword
        ? t("register.error.pwd_mismatch")
        : "",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerMutation.isPending) return;

    setAttempted(true);
    const firstInvalid = (Object.keys(errors) as FieldKey[]).find((key) => errors[key]);
    if (firstInvalid) {
      fieldRefs[firstInvalid].current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      inputRefs[firstInvalid].current?.focus({ preventScroll: true });
      return;
    }

    registerMutation.mutate({
      data: {
        name: formData.name.trim(),
        username: generateUsername(formData.name),
        brandName: formData.brandName.trim() || undefined,
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

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-5">
            <Field
              blockRef={fieldRefs.name}
              inputRef={inputRefs.name}
              label={t("register.name_required")}
              requiredLabel={t("register.required")}
              value={formData.name}
              placeholder={t("register.name_placeholder")}
              error={attempted ? errors.name : ""}
              autoComplete="name"
              onChange={(value) => update("name", value)}
            />

            <Field
              blockRef={fieldRefs.brandName}
              inputRef={inputRefs.brandName}
              label={t("register.brandName")}
              value={formData.brandName}
              placeholder={t("register.brandName_placeholder")}
              error=""
              autoComplete="organization"
              onChange={(value) => update("brandName", value)}
            />

            <Field
              blockRef={fieldRefs.password}
              inputRef={inputRefs.password}
              label={t("register.password_label")}
              requiredLabel={t("register.required")}
              value={formData.password}
              placeholder="••••••"
              error={attempted ? errors.password : ""}
              hint={attempted && errors.password ? "" : t("register.password_hint")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              onChange={(value) => update("password", value)}
              trailing={
                <RevealButton
                  shown={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                />
              }
            />

            <Field
              blockRef={fieldRefs.confirmPassword}
              inputRef={inputRefs.confirmPassword}
              label={t("register.confirm_password_label")}
              requiredLabel={t("register.required")}
              value={formData.confirmPassword}
              placeholder="••••••"
              error={attempted ? errors.confirmPassword : ""}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              onChange={(value) => {
                update("confirmPassword", value);
                if (value !== formData.password) {
                  setShowPassword(true);
                  setShowConfirm(true);
                }
              }}
              trailing={
                <RevealButton
                  shown={showConfirm}
                  onToggle={() => setShowConfirm((value) => !value)}
                />
              }
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-amber-600 hover:shadow-xl hover:shadow-primary/30 text-black border-0 mt-4 transition-all"
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

function Field({
  blockRef,
  inputRef,
  label,
  requiredLabel,
  value,
  placeholder,
  error,
  hint,
  type = "text",
  autoComplete,
  onChange,
  trailing,
}: {
  blockRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  requiredLabel?: string;
  value: string;
  placeholder: string;
  error: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div ref={blockRef} className="space-y-2 scroll-mt-24">
      <Label className="text-white/80">
        {label}
        {requiredLabel ? (
          <>
            {" "}
            <span className="text-primary font-medium">{requiredLabel}</span>
          </>
        ) : null}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={cn(
            "bg-black/20 h-12 rounded-xl",
            trailing && "pr-12",
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-white/10 focus-visible:ring-primary",
          )}
        />
        {trailing}
      </div>
      {hint ? <p className="text-white/40 text-xs">{hint}</p> : null}
      {error ? <p className="text-red-400 text-sm">{error}</p> : null}
    </div>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
    >
      {shown ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  );
}
