import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ONBOARDING_COMPLETED_KEY, ONBOARDING_PENDING_KEY, ONBOARDING_INTRO_KEY } from "@/lib/onboarding";
import { inspectSignupName, signupSlug } from "@/lib/signup-name";

function WaitSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="animate-spin" style={{ animationDuration: "0.8s" }}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x="8.15"
          y="1.1"
          width="1.7"
          height="4.6"
          rx="0.85"
          fill="currentColor"
          opacity={0.18 + (i / 11) * 0.82}
          transform={`rotate(${i * 30} 9 9)`}
        />
      ))}
    </svg>
  );
}

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
type NameState = "idle" | "checking" | "free" | "taken" | "short" | "long" | "digits" | "symbols";

async function fetchNameCheck(name: string): Promise<{ status: NameState | "empty"; suggestions: string[] } | null> {
  try {
    const res = await fetch(`/api/auth/name-check?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function Register() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: new URLSearchParams(window.location.search).get("name") || "",
    brandName: "",
    password: "",
    confirmPassword: "",
    mode: "solo" as "solo" | "team",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [nameState, setNameState] = useState<NameState>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const nameCheckSeq = useRef(0);
  const pickedName = useRef<string | null>(null);
  const [waitPhase, setWaitPhase] = useState<null | "account" | "pages">(null);
  const waitTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (waitTimer.current != null) window.clearTimeout(waitTimer.current);
  }, []);

  useEffect(() => {
    const typed = formData.name;
    const problem = inspectSignupName(typed);
    if (problem === "empty") {
      nameCheckSeq.current += 1;
      pickedName.current = null;
      setNameState("idle");
      setSuggestions([]);
      return;
    }
    if (problem === "ok" && typed === pickedName.current) {
      nameCheckSeq.current += 1;
      setNameState("free");
      setSuggestions([]);
      return;
    }
    if (problem !== "ok") {
      nameCheckSeq.current += 1;
      pickedName.current = null;
      setNameState(problem);
      setSuggestions([]);
      return;
    }
    setNameState("idle");
    setSuggestions([]);
    const handle = window.setTimeout(() => {
      const seq = ++nameCheckSeq.current;
      pickedName.current = null;
      setNameState("checking");
      void fetchNameCheck(typed).then((result) => {
        if (seq !== nameCheckSeq.current) return;
        if (!result || result.status === "empty") {
          setNameState("idle");
          setSuggestions([]);
          return;
        }
        setNameState(result.status === "free" || result.status === "taken" ? result.status : "symbols");
        setSuggestions(result.suggestions || []);
      });
    }, 500);
    return () => window.clearTimeout(handle);
  }, [formData.name]);

  function stopWait() {
    if (waitTimer.current != null) window.clearTimeout(waitTimer.current);
    waitTimer.current = null;
    setWaitPhase(null);
  }

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
        if (waitTimer.current != null) window.clearTimeout(waitTimer.current);
        localStorage.removeItem("telegram_auth_code");
        localStorage.removeItem("telegram_auth_code_ts");
        localStorage.setItem("barber_token", data.token);
        localStorage.setItem("barber_user", JSON.stringify(data.user));
        localStorage.setItem("zumio_device_account_id", data.user.id);
        const remembered = signupSlug(formData.name) || data.user.username;
        if (remembered) localStorage.setItem("zumio_last_slug", remembered);
        localStorage.setItem(ONBOARDING_PENDING_KEY, "1");
        localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
        sessionStorage.setItem(ONBOARDING_INTRO_KEY, "1");
        navigate("/onboarding");
      },
      onError: (err) => {
        stopWait();
        const data = err && typeof err === "object" && "data" in err ? (err as { data?: { error?: string; suggestions?: string[] } }).data : undefined;
        if (data?.error === "name_taken") {
          setNameState("taken");
          setSuggestions(data.suggestions || []);
          return;
        }
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

  const passwordsDiffer =
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= formData.password.length &&
    formData.password !== formData.confirmPassword;

  const errors: Record<FieldKey, string> = {
    name: formData.name.trim() ? "" : t("register.error.name"),
    password: formData.password.length >= 6 ? "" : t("register.error.pwd_short"),
    confirmPassword: !formData.confirmPassword
      ? t("register.error.confirm_required")
      : passwordsDiffer
        ? t("register.error.pwd_mismatch")
        : "",
  };

  function chooseName(value: string) {
    pickedName.current = value;
    nameCheckSeq.current += 1;
    update("name", value);
    setNameState("free");
    setSuggestions([]);
    const input = inputRefs.name.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const end = value.length;
    try { input.setSelectionRange(end, end); } catch { /* some mobile keyboards ignore the caret */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerMutation.isPending || waitPhase) return;
    const cleanName = formData.name.trim();
    const nameProblem = inspectSignupName(cleanName);
    if (nameProblem !== "empty" && nameProblem !== "ok") {
      setNameState(nameProblem);
      return;
    }
    if (nameState === "taken" || nameState === "checking") return;

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
    if (formData.password !== formData.confirmPassword) {
      fieldRefs.confirmPassword.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      inputRefs.confirmPassword.current?.focus({ preventScroll: true });
      return;
    }

    const fresh = await fetchNameCheck(cleanName);
    if (fresh?.status === "taken") {
      pickedName.current = null;
      setNameState("taken");
      setSuggestions(fresh.suggestions || []);
      return;
    }

    setWaitPhase("account");
    waitTimer.current = window.setTimeout(() => setWaitPhase("pages"), 1500);
    registerMutation.mutate({
      data: {
        name: cleanName,
        username: generateUsername(cleanName),
        brandName: formData.brandName.trim() || undefined,
        password: formData.password,
        mode: formData.mode,
        lang: (localStorage.getItem("barber_lang") as "uz" | "ru") || "uz",
      },
    });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-12">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/auth-shop.jpg`}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/68" />
      </div>

      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-6 text-center">
          <img
            src={`${import.meta.env.BASE_URL}images/zumio-pin.png`}
            alt=""
            width={257}
            height={321}
            className="mx-auto mb-3 h-20 w-auto object-contain"
          />
          <h1 className="mb-3 font-display text-4xl font-bold text-white">
            {t("register.title")}
          </h1>
          <div className="inline-block rounded-xl border border-amber-400/80 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
            {t("register.note")}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-5 rounded-3xl border border-white/15 bg-[#141210]/75 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
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
              below={<NameStatus lang={lang} state={nameState} suggestions={suggestions} onPick={chooseName} />}
            />

            <Field
              blockRef={fieldRefs.brandName}
              inputRef={inputRefs.brandName}
              label={t("register.brandName")}
              optionalLabel={t("register.optional")}
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
              invalid={passwordsDiffer}
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
              error={
                passwordsDiffer
                  ? t("register.error.pwd_mismatch")
                  : attempted
                    ? errors.confirmPassword
                    : ""
              }
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              onChange={(value) => {
                update("confirmPassword", value);
                if (
                  formData.password.length >= 6 &&
                  value.length >= formData.password.length &&
                  value !== formData.password
                ) {
                  setShowPassword(true);
                }
              }}
              trailing={
                <RevealButton
                  shown={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                />
              }
            />
          </div>

          <Button
            type="submit"
            disabled={waitPhase !== null}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-primary text-lg font-bold text-black transition-all hover:bg-primary/90 disabled:opacity-100"
          >
            {waitPhase && <WaitSpinner />}
            {waitPhase === "account"
              ? (lang === "ru" ? "Создаётся аккаунт..." : "Hisob yaratilmoqda...")
              : waitPhase === "pages"
                ? (lang === "ru" ? "Готовятся страницы..." : "Sahifalar tayyorlanmoqda...")
                : t("register.submit")}
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

function NameStatus({
  lang,
  state,
  suggestions,
  onPick,
}: {
  lang: string;
  state: NameState;
  suggestions: string[];
  onPick: (value: string) => void;
}) {
  if (state === "idle") return null;
  const formatError =
    state === "short"
      ? (lang === "ru" ? "Имя должно содержать не менее 3 символов." : "Ism kamida 3 ta belgidan iborat bo‘lishi kerak.")
      : state === "long"
        ? (lang === "ru" ? "Имя не должно превышать 25 символов." : "Ism 25 ta belgidan oshmasligi kerak.")
        : state === "digits"
          ? (lang === "ru" ? "Имя не может состоять только из цифр." : "Ism faqat raqamlardan iborat bo‘lishi mumkin emas.")
          : state === "symbols"
            ? (lang === "ru"
              ? "Имя не должно начинаться или заканчиваться спецсимволами (например: ‘_’, ‘-’, ‘.’) и содержать лишние знаки."
              : "Ism boshi yoki oxirida maxsus belgilar (masalan: ‘_’, ‘-’, ‘.’) hamda begona simvollar bo‘lishi mumkin emas.")
            : "";
  return (
    <div>
      {formatError && <p className="mt-2 text-sm leading-snug text-red-400">{formatError}</p>}
      {state === "checking" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-white/45">
          <WaitSpinner />
          {lang === "ru" ? "Проверка..." : "Tekshirilmoqda..."}
        </p>
      )}
      {state === "free" && (
        <p className="mt-2 text-sm text-green-400">{lang === "ru" ? "✓ Это имя свободно" : "✓ Bu ism bo‘sh"}</p>
      )}
      {state === "taken" && (
        <>
          <p className="mt-2 text-sm leading-snug text-red-400">
            {lang === "ru"
              ? "✕ Это имя занято. Введите другое или выберите из вариантов:"
              : "✕ Bu ism band. Boshqa nom yozing yoki tayyor variantlardan tanlang:"}
          </p>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => onPick(item)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  blockRef,
  inputRef,
  label,
  requiredLabel,
  optionalLabel,
  value,
  placeholder,
  error,
  invalid = false,
  hint,
  type = "text",
  autoComplete,
  onChange,
  trailing,
  below,
}: {
  blockRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  requiredLabel?: string;
  optionalLabel?: string;
  value: string;
  placeholder: string;
  error: string;
  invalid?: boolean;
  hint?: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
  below?: React.ReactNode;
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
        {optionalLabel ? (
          <>
            {" "}
            <span className="text-white/45 font-normal">{optionalLabel}</span>
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
          aria-invalid={error || invalid ? true : undefined}
          className={cn(
            "h-12 rounded-xl border-white/10 bg-[#2a2724]/85 text-white placeholder:text-white/40",
            trailing && "pr-12",
            error || invalid
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-white/10 focus-visible:ring-primary",
          )}
        />
        {trailing}
      </div>
      {hint ? <p className="text-white/40 text-xs">{hint}</p> : null}
      {error ? <p className="text-red-400 text-sm">{error}</p> : null}
      {below}
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
      {shown ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
    </button>
  );
}
