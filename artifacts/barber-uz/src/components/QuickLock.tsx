import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { deviceHeaders } from "@/lib/device";
import {
  clearQuickPin,
  hasFingerprint,
  markQuickUnlocked,
  pinMatches,
  quickLocked,
  unlockWithFingerprint,
} from "@/lib/quick-login";

export function QuickLock() {
  const [open, setOpen] = useState(quickLocked);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const unlock = () => {
    markQuickUnlocked();
    setOpen(false);
  };

  const submitPin = async () => {
    if (pin.length !== 4) return;
    if (await pinMatches(pin)) {
      unlock();
      return;
    }
    setWrong(true);
    setPin("");
  };

  const submitPassword = async (forgetPin: boolean) => {
    setBusy(true);
    setPasswordError("");
    try {
      const res = await fetch("/api/settings/verify-password", {
        method: "POST",
        headers: deviceHeaders(),
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setPasswordError("Parol noto'g'ri");
        return;
      }
      if (forgetPin) {
        clearQuickPin();
        await fetch("/api/settings/quick-login", {
          method: "PUT",
          headers: deviceHeaders(),
          body: JSON.stringify({ enabled: false }),
        }).catch(() => {});
      }
      unlock();
    } catch {
      setPasswordError("Parol noto'g'ri");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md flex items-center justify-center px-6" data-testid="quick-lock">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-2xl">
          🔒
        </div>
        <h2 className="text-xl font-bold mb-1">Tezkor kirish</h2>
        <p className="text-sm text-muted-foreground mb-5">Davom etish uchun PIN kiriting</p>
        <input
          data-testid="quick-pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setWrong(false); }}
          className="w-full h-12 text-center tracking-[0.6em] text-lg rounded-2xl bg-card border border-white/10"
        />
        {wrong && <p className="text-red-400 text-xs mt-2">PIN noto'g'ri</p>}
        <button
          type="button"
          data-testid="quick-enter"
          onClick={() => { void submitPin(); }}
          disabled={pin.length !== 4}
          className="w-full h-12 mt-3 rounded-2xl bg-[#FACC15] text-black font-bold disabled:opacity-40"
        >
          Kirish
        </button>
        {hasFingerprint() && (
          <button
            type="button"
            data-testid="quick-fingerprint"
            onClick={() => { void unlockWithFingerprint().then((ok) => { if (ok) unlock(); }); }}
            className="w-full h-12 mt-2 rounded-2xl border border-white/10 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Fingerprint className="w-4 h-4" /> Barmoq izi
          </button>
        )}
        <button
          type="button"
          data-testid="quick-password-open"
          onClick={() => setAskPassword((v) => !v)}
          className="mt-4 text-xs text-muted-foreground underline"
        >
          Parol bilan kirish
        </button>
        {askPassword && (
          <div className="mt-3 space-y-2 text-left">
            <input
              data-testid="quick-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hisob paroli"
              className="w-full h-12 px-4 rounded-2xl bg-card border border-white/10 text-sm"
            />
            {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="quick-password-submit"
                disabled={busy || !password}
                onClick={() => { void submitPassword(false); }}
                className="flex-1 h-11 rounded-2xl bg-white/10 text-sm font-semibold disabled:opacity-40"
              >
                Kirish
              </button>
              <button
                type="button"
                data-testid="quick-forget-pin"
                disabled={busy || !password}
                onClick={() => { void submitPassword(true); }}
                className="flex-1 h-11 rounded-2xl border border-white/10 text-sm font-semibold disabled:opacity-40"
              >
                PIN ni unutdim
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
