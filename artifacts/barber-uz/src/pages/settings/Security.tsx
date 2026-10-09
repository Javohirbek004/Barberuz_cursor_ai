import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { useUpdatePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deviceHeaders, deviceTitle, resolveDeviceName, telegramPlatform } from "@/lib/device";

function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  testId,
  autoComplete,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  testId: string;
  autoComplete: string;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          data-testid={testId}
          type={shown ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`bg-background/50 h-12 pr-12 focus-visible:ring-primary ${invalid ? "border-red-500 focus-visible:ring-red-500" : "border-white/10"}`}
        />
        <button
          type="button"
          data-testid={`${testId}-eye`}
          aria-label={shown ? "Yashirish" : "Ko'rsatish"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShown((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
        >
          {shown ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

function accountRole(mode: string | undefined): string {
  if (mode === "team") return "Admin";
  if (mode === "member") return "Usta";
  return "Yakka barber";
}

export default function SecuritySettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const updatePasswordMutation = useUpdatePassword();
  const oldRef = useRef("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [oldState, setOldState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [deviceName, setDeviceName] = useState(() => deviceTitle(
    typeof navigator === "undefined" ? "" : navigator.userAgent,
    telegramPlatform(),
  ));

  oldRef.current = oldPassword;

  const longEnough = newPassword.length >= 6;
  const mixed = /\p{L}/u.test(newPassword) && /\d/.test(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const passwordsMatch = newPassword.length > 0 && confirmPassword === newPassword;
  const canSave = oldState === "ok" && longEnough && mixed && passwordsMatch;

  useEffect(() => {
    localStorage.removeItem("barber_quick_pin");
    localStorage.removeItem("barber_quick_cred");
    let cancelled = false;
    resolveDeviceName().then((name) => {
      if (!cancelled && name) setDeviceName(name);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [confirmLogout]);

  const checkOldPassword = async () => {
    const value = oldRef.current;
    if (!value) {
      setOldState("idle");
      return;
    }
    setOldState("checking");
    let ok = false;
    try {
      const res = await fetch("/api/settings/verify-password", {
        method: "POST",
        headers: deviceHeaders(),
        body: JSON.stringify({ password: value }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (oldRef.current !== value) return;
    setOldState(ok ? "ok" : "bad");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updatePasswordMutation.mutate({
      data: { oldPassword, newPassword },
    }, {
      onSuccess: () => {
        toast({ title: "Parol yangilandi" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOldState("idle");
      },
      onError: () => {
        setOldState("bad");
        toast({ title: "Eski parol noto'g'ri", variant: "destructive" });
      },
    });
  };

  const logoutOthers = async () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    try {
      const res = await fetch("/api/settings/devices/logout-others", {
        method: "POST",
        headers: deviceHeaders(),
      });
      if (!res.ok) throw new Error("logout");
      const data = await res.json() as { token?: string };
      if (data.token) localStorage.setItem("barber_token", data.token);
      toast({ title: "Boshqa qurilmalardan chiqildi" });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">{t("security.title")}</h1>
      </div>

      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shrink-0">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-sm text-muted-foreground">{t("security.protected_msg")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-card/50 p-5 rounded-3xl border border-white/5 space-y-4">
          <h3 className="font-bold text-lg">{t("security.pwd_update")}</h3>
          <div>
            <PasswordField
              label={t("security.old_pwd")}
              value={oldPassword}
              onChange={(value) => {
                setOldPassword(value);
                setOldState("idle");
              }}
              onBlur={() => { void checkOldPassword(); }}
              invalid={oldState === "bad"}
              testId="security-old"
              autoComplete="current-password"
            />
            {oldState === "bad" && (
              <p data-testid="security-old-error" className="text-red-400 text-xs mt-2">❌ Eski parol noto'g'ri</p>
            )}
          </div>
          <PasswordField
            label={t("security.new_pwd")}
            value={newPassword}
            onChange={setNewPassword}
            placeholder={t("security.new_pwd_placeholder")}
            testId="security-new"
            autoComplete="new-password"
          />
          <ul className="space-y-1 px-1">
            <li data-testid="security-rule-len" className={`text-xs ${longEnough ? "text-emerald-400" : "text-muted-foreground"}`}>
              {longEnough ? "✓" : "•"} Kamida 6 ta belgi
            </li>
            <li data-testid="security-rule-mix" className={`text-xs ${mixed ? "text-emerald-400" : "text-muted-foreground"}`}>
              {mixed ? "✓" : "•"} Raqam va harflar
            </li>
          </ul>
          <PasswordField
            label="Yangi parolni qayta kiriting"
            value={confirmPassword}
            onChange={setConfirmPassword}
            testId="security-confirm"
            autoComplete="new-password"
          />
          {mismatch && <p data-testid="security-mismatch" className="text-red-400 text-xs">Parollar mos kelmadi</p>}
        </div>

        <Button
          type="submit"
          data-testid="security-save"
          disabled={updatePasswordMutation.isPending || !canSave}
          className="w-full h-14 text-lg font-bold rounded-xl bg-[#FACC15] hover:bg-[#FDE047] text-black transition-all shadow-lg shadow-[#FACC15]/20 disabled:opacity-40"
        >
          {updatePasswordMutation.isPending && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
          Parolni yangilash
        </Button>
      </form>

      <section className="mt-8" data-testid="active-devices">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
          Faol qurilmalar
        </p>
        <div data-testid="device-current" className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            <p data-testid="device-name" className="font-semibold text-sm">📱 {deviceName}</p>
            <span
              data-testid="device-badge"
              className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]"
            >
              🟢 Bu sizning telefoningiz
            </span>
          </div>
          <p data-testid="device-identity" className="text-xs text-foreground/90 mt-2">
            {(user?.name || "").trim() || "Barber"} • {accountRole(user?.mode)}
          </p>
          <p data-testid="device-place" className="text-xs text-muted-foreground mt-1">
            Toshkent, O'zbekiston • Hozir faol
          </p>
        </div>
        <button
          type="button"
          data-testid="device-logout-others"
          disabled={loggingOut}
          onClick={() => setConfirmLogout(true)}
          className="w-full h-12 mt-3 rounded-2xl border border-red-500/40 bg-transparent text-red-400 text-sm font-semibold disabled:opacity-40"
        >
          {loggingOut ? "Chiqilmoqda..." : "Barcha boshqa qurilmalardan chiqish"}
        </button>
      </section>

      {confirmLogout && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" data-testid="device-logout-confirm">
          <button
            type="button"
            aria-label="Bekor qilish"
            className="absolute inset-0 bg-black/70"
            onClick={() => setConfirmLogout(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground text-center mb-2">⚠️ Barcha seanslardan chiqasizmi?</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-6">
              Ushbu qurilmadan tashqari barcha boshqa telefon va kompyuterlardagi hisobingiz yakunlanadi.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                data-testid="device-logout-cancel"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                data-testid="device-logout-submit"
                onClick={() => { void logoutOthers(); }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm"
              >
                Ha, chiqilsin
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Layout>
  );
}
