import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetClientQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { useBotUsername } from "@/lib/bot-link";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick } from "@/i18n/pick";

type PhoneState = "free" | "unlinked" | "linked";

type PhoneHit = {
  ready: boolean;
  state?: PhoneState;
  clientId?: string;
  name?: string;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("barber_token") || "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function inviteText(barberName: string, botUsername: string, clientId: string): string {
  return `Salom! Sartaroshingiz ${barberName} qabuliga yozildingiz. Broningizni boshqarish, eslatmalar olish va keyingi safar 24/7 navbatga yozilish uchun quyidagi havola orqali botga o‘ting: https://t.me/${botUsername}?start=client_${clientId}`;
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function openSms(phone: string, body: string) {
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const href = isiOS
    ? `sms:${phone}&body=${encodeURIComponent(body)}`
    : `sms:${phone}?body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

export function ClientBotConnect({
  clientId,
  clientName,
  phone,
  barberName,
}: {
  clientId: string;
  clientName: string;
  phone?: string | null;
  barberName: string;
}) {
  const botUsername = useBotUsername();
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const [knownPhone, setKnownPhone] = useState((phone || "").trim());
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const [checking, setChecking] = useState(false);
  const [hit, setHit] = useState<PhoneHit | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetId, setTargetId] = useState(clientId);
  const [toastOn, setToastOn] = useState(false);
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    setKnownPhone((phone || "").trim());
  }, [phone]);

  useEffect(() => {
    if (!phoneOpen) return;
    if (digits.length !== 9) {
      setChecking(false);
      setHit(null);
      return;
    }
    let live = true;
    setChecking(true);
    setHit(null);
    const timer = window.setTimeout(() => {
      void fetch(`/api/clients/phone-check?phone=${encodeURIComponent(`+998${digits}`)}`, {
        headers: authHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PhoneHit | null) => {
          if (!live) return;
          setHit(data && data.ready ? data : null);
        })
        .catch(() => {
          if (live) setHit(null);
        })
        .finally(() => {
          if (live) setChecking(false);
        });
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [digits, phoneOpen]);

  useEffect(() => {
    if (!toastOn) return;
    setToastShown(true);
    const fade = window.setTimeout(() => setToastShown(false), 3500);
    const gone = window.setTimeout(() => setToastOn(false), 3900);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, [toastOn]);

  function start() {
    setTargetId(clientId);
    if (knownPhone) {
      setChannelOpen(true);
      return;
    }
    setDigits("");
    setHit(null);
    setChecking(false);
    setPhoneOpen(true);
  }

  function closePhone() {
    if (saving) return;
    setPhoneOpen(false);
  }

  function closeChannel() {
    setSmsOpen(false);
    setChannelOpen(false);
  }

  async function savePhone() {
    if (digits.length !== 9 || checking || !hit || saving) return;
    const typed = `+998${digits}`;
    if (hit.state === "linked") {
      if (hit.clientId === clientId) {
        setSaving(true);
        try {
          await fetch(`/api/clients/${clientId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ phone: typed }),
          });
        } finally {
          setSaving(false);
        }
      }
      setKnownPhone(typed);
      setPhoneOpen(false);
      return;
    }
    const nextId = hit.state === "unlinked" && hit.clientId ? hit.clientId : clientId;
    if (hit.state === "free") {
      setSaving(true);
      try {
        const res = await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ phone: typed }),
        });
        if (!res.ok) return;
      } finally {
        setSaving(false);
      }
      setKnownPhone(typed);
      void queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
      void queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    }
    setTargetId(nextId);
    setPhoneOpen(false);
    setChannelOpen(true);
  }

  async function sendTelegram() {
    const text = inviteText(barberName || "usta", botUsername, targetId);
    await copyText(text);
    setToastOn(true);
    const number = knownPhone || `+998${digits}`;
    window.location.href = `tg://resolve?phone=${encodeURIComponent(number)}`;
  }

  function sendSms() {
    const text = inviteText(barberName || "usta", botUsername, targetId);
    const number = knownPhone || `+998${digits}`;
    setSmsOpen(false);
    setChannelOpen(false);
    setPhoneOpen(false);
    openSms(number, text);
  }

  const saveDisabled = digits.length !== 9 || checking || !hit || saving;
  const linked = hit?.state === "linked";
  const foundName = hit?.name?.trim() || clientName;

  return (
    <>
      <div
        data-testid="bot-link-box"
        className="mt-3 rounded-2xl border border-primary/45 bg-primary/10 px-3 py-3"
      >
        <p className="mb-2 text-xs text-muted-foreground">{pick(lang, "Bot holati", "Статус бота")}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-primary">{pick(lang, "⚠️ Botga ulanmagan", "⚠️ Не подключён к боту")}</span>
          <button
            type="button"
            data-testid="bot-link-button"
            onClick={start}
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-extrabold text-primary-foreground"
          >
            {pick(lang, "Botga ulash", "Подключить к боту")}
          </button>
        </div>
        <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">
          {pick(lang, "Mijozga eslatmalar borishi uchun botga ulang", "Подключите к боту, чтобы клиент получал напоминания")}
        </p>
      </div>

      {phoneOpen && (
        <div className="fixed inset-0 z-[230] flex items-end bg-black/70 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl bg-[#1a1a1f] border border-white/10 p-4 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-foreground">⚠️ Telefon raqami kiritilmagan</h2>
              <button type="button" aria-label="Yopish" onClick={closePhone} className="h-9 w-9 shrink-0 rounded-xl bg-white/8 text-muted-foreground">
                <X className="mx-auto h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-snug text-muted-foreground">
              Mijozni botga ulash uchun uning telefon raqami kiritilgan bo‘lishi kerak. Iltimos, avval raqamni kiriting.
            </p>
            <div className="relative mt-4">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground">+998</span>
              <input
                value={digits}
                inputMode="numeric"
                autoFocus
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
                className="h-12 w-full rounded-xl border border-white/10 bg-background pl-14 pr-10 text-sm"
              />
              {checking && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {hit?.state === "unlinked" && (
              <p className="mt-2 text-sm font-medium leading-snug text-yellow-400">
                ⚠️ Ushbu raqam {foundName} profilida bor, lekin botga ulanmagan.
              </p>
            )}
            {hit?.state === "linked" && (
              <p className="mt-2 text-sm font-medium leading-snug text-green-400">
                ✅ Bu raqam bazada mavjud va botga ulangan: {foundName}
              </p>
            )}
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void savePhone()}
              className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-extrabold text-black disabled:opacity-40"
            >
              {linked ? "✅ Botga ulangan" : "Saqlash"}
            </button>
          </div>
        </div>
      )}

      {channelOpen && (
        <div className="fixed inset-0 z-[230] flex items-end bg-black/70 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl bg-[#1a1a1f] border border-white/10 p-4 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-foreground">⚠️ Botga ulash</h2>
              <button type="button" aria-label="Yopish" onClick={closeChannel} className="h-9 w-9 shrink-0 rounded-xl bg-white/8 text-muted-foreground">
                <X className="mx-auto h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-snug text-muted-foreground">
              Mijozni botga ulash va bron tafsilotlarini yuborish uchun qaysi aloqa turini tanlaysiz?
            </p>
            <button type="button" onClick={() => void sendTelegram()} className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-extrabold text-black">
              ✈️ Telegram orqali
            </button>
            <button type="button" onClick={() => setSmsOpen(true)} className="mt-2 h-12 w-full rounded-xl border border-white/15 text-sm font-semibold text-foreground">
              💬 SMS orqali
            </button>
            <p className="mt-3 text-center text-xs leading-snug text-muted-foreground">
              (Agar mijozda Telegram topilmasa, ilovaga qaytib SMS orqali yuborishingiz mumkin!)
            </p>
            <button type="button" onClick={closeChannel} className="mt-3 h-11 w-full rounded-xl text-sm text-muted-foreground">
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {smsOpen && (
        <div className="fixed inset-0 z-[240] flex items-end bg-black/70 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl bg-[#1a1a1f] border border-white/10 p-4 sm:rounded-3xl">
            <h2 className="text-base font-bold text-foreground">💬 SMS orqali yuborish</h2>
            <p className="mt-3 text-sm leading-snug text-muted-foreground">
              ℹ️ Eslatma: Xabar sizning mobil aloqa tarifingiz hisobidagi SMS paketingiz orqali yuboriladi.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSmsOpen(false)} className="h-12 flex-1 rounded-xl border border-white/15 text-sm font-semibold">
                Bekor qilish
              </button>
              <button type="button" onClick={sendSms} className="h-12 flex-1 rounded-xl bg-primary text-sm font-extrabold text-black">
                Davom etish
              </button>
            </div>
          </div>
        </div>
      )}

      {toastOn && (
        <div
          className={`fixed left-1/2 z-[250] w-[min(92vw,22rem)] -translate-x-1/2 rounded-[12px] bg-[#1E1E1E] px-4 py-3 text-center text-sm leading-snug text-white shadow-lg transition-opacity duration-300 ${toastShown ? "opacity-100" : "opacity-0"}`}
          style={{ bottom: "calc(5.5rem + 24px)" }}
        >
          <p>✅ Mijozga yuboriladigan xabar matni nusxalandi!</p>
          <p className="mt-1">Chat ochilgach bu nusxalangan xabarni yuborishingiz mumkin. Telegram ochilmoqda...</p>
        </div>
      )}
    </>
  );
}
