import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { useUpdatePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Eye, EyeOff, Fingerprint, Loader2, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deviceHeaders, deviceLabel } from "@/lib/device";
import { clearQuickPin, hasQuickPin, registerFingerprint, saveQuickPin } from "@/lib/quick-login";

type DeviceRow = {
  id: string;
  label: string;
  ip: string | null;
  lastSeen: string;
  current: boolean;
};

function seenLabel(row: DeviceRow): string {
  if (row.current) return "Hozir faol";
  const then = new Date(row.lastSeen).getTime();
  if (!Number.isFinite(then)) return row.ip ? `IP: ${row.ip}` : "Oldinroq";
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  const when = mins < 60 ? `${mins} daqiqa oldin` : mins < 60 * 24 ? `${Math.round(mins / 60)} soat oldin` : `${Math.round(mins / 1440)} kun oldin`;
  return row.ip ? `${when} · IP: ${row.ip}` : when;
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  testId,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId: string;
  autoComplete: string;
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
          placeholder={placeholder}
          className="bg-background/50 h-12 border-white/10 focus-visible:ring-primary pr-12"
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

export default function SecuritySettings() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();
  const updatePasswordMutation = useUpdatePassword();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [quickOn, setQuickOn] = useState(hasQuickPin);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [pinError, setPinError] = useState("");

  const longEnough = newPassword.length >= 6;
  const mixed = /\p{L}/u.test(newPassword) && /\d/.test(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSave = !!oldPassword && longEnough && mixed && confirmPassword === newPassword;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/security", { headers: deviceHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error("security");
        return res.json() as Promise<{ quickLogin?: boolean; devices?: DeviceRow[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data.devices) && data.devices.length
          ? data.devices
          : [{ id: "local", label: deviceLabel(), ip: null, lastSeen: new Date().toISOString(), current: true }];
        setDevices(rows);
        setQuickOn(data.quickLogin === true || hasQuickPin());
      })
      .catch(() => {
        if (cancelled) return;
        setDevices([{ id: "local", label: deviceLabel(), ip: null, lastSeen: new Date().toISOString(), current: true }]);
      })
      .finally(() => {
        if (!cancelled) setDevicesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
      },
      onError: () => {
        toast({ title: "Eski parol noto'g'ri", variant: "destructive" });
      },
    });
  };

  const logoutOthers = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/settings/devices/logout-others", {
        method: "POST",
        headers: deviceHeaders(),
      });
      if (!res.ok) throw new Error("logout");
      const data = await res.json() as { token?: string };
      if (data.token) localStorage.setItem("barber_token", data.token);
      setDevices((rows) => rows.filter((row) => row.current));
      toast({ title: "Boshqa qurilmalardan chiqildi" });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setLoggingOut(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin) || pin !== pinAgain) {
      setPinError("PIN mos kelmadi");
      return;
    }
    await saveQuickPin(pin);
    const finger = await registerFingerprint();
    await fetch("/api/settings/quick-login", {
      method: "PUT",
      headers: deviceHeaders(),
      body: JSON.stringify({ enabled: true }),
    }).catch(() => {});
    setQuickOn(true);
    setPinOpen(false);
    setPin("");
    setPinAgain("");
    setPinError("");
    toast({ title: finger ? "PIN va barmoq izi yoqildi" : "Tezkor kirish yoqildi" });
  };

  const disableQuick = async () => {
    clearQuickPin();
    setQuickOn(false);
    await fetch("/api/settings/quick-login", {
      method: "PUT",
      headers: deviceHeaders(),
      body: JSON.stringify({ enabled: false }),
    }).catch(() => {});
    toast({ title: "Tezkor kirish o'chirildi" });
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
          <PasswordField
            label={t("security.old_pwd")}
            value={oldPassword}
            onChange={setOldPassword}
            testId="security-old"
            autoComplete="current-password"
          />
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
        <div className="space-y-2">
          {devicesLoading && <p className="text-sm text-muted-foreground px-1">Yuklanmoqda...</p>}
          {devices.map((row) => {
            const phone = /iphone|ipad|android|redmi|samsung|pixel/i.test(row.label);
            return (
              <div key={row.id} data-testid="device-row" className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  {phone ? <Smartphone className="w-4 h-4 text-[#FACC15]" /> : <Monitor className="w-4 h-4 text-[#FACC15]" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{row.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{seenLabel(row)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="device-logout-others"
          disabled={loggingOut}
          onClick={() => { void logoutOthers(); }}
          className="w-full h-12 mt-3 rounded-2xl border border-red-500/30 text-red-300 text-sm font-semibold disabled:opacity-40"
        >
          {loggingOut ? "Chiqilmoqda..." : "Barcha boshqa qurilmalardan chiqish"}
        </button>
      </section>

      <section className="mt-8" data-testid="quick-access">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
          Tezkor kirish
        </p>
        <div className="bg-card/50 px-4 py-4 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
              <Fingerprint className="w-4 h-4 text-[#FACC15]" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">PIN-kod yoki Barmoq izi bilan kirish</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ilovani ochganda shu telefonda PIN so'raladi. Barmoq izi bo'lsa, u ham ishlaydi.
              </p>
            </div>
          </div>
          <Switch
            data-testid="quick-login"
            checked={quickOn}
            onCheckedChange={(on) => {
              if (on) {
                setPin("");
                setPinAgain("");
                setPinError("");
                setPinOpen(true);
                return;
              }
              void disableQuick();
            }}
          />
        </div>
      </section>

      {pinOpen && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" data-testid="pin-dialog">
          <button type="button" aria-label="Ortga" className="absolute inset-0 bg-black/70" onClick={() => setPinOpen(false)} />
          <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-center mb-1">PIN o'rnating</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">4 ta raqam. Keyingi safar shu PIN so'raladi.</p>
            <input
              data-testid="pin-first"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN"
              className="w-full h-12 mb-2 px-4 text-center tracking-[0.5em] rounded-2xl bg-background/50 border border-white/10"
            />
            <input
              data-testid="pin-second"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pinAgain}
              onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN ni qayta kiriting"
              className="w-full h-12 px-4 text-center tracking-[0.5em] rounded-2xl bg-background/50 border border-white/10"
            />
            {pinError && <p className="text-red-400 text-xs text-center mt-2">{pinError}</p>}
            <div className="flex gap-3 mt-5">
              <button type="button" data-testid="pin-back" onClick={() => setPinOpen(false)} className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-sm font-semibold">
                Ortga
              </button>
              <button type="button" data-testid="pin-save" onClick={() => { void savePin(); }} className="flex-1 py-3 rounded-2xl bg-[#FACC15] text-black text-sm font-semibold">
                Saqlash
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Layout>
  );
}
