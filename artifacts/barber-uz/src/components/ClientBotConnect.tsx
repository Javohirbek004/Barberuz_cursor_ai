import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetClientQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { useBotUsername } from "@/lib/bot-link";
import { isTelegramWebApp, openTelegramPhone } from "@/lib/telegram-webapp";
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

const NOTICE_KEY = "zumio_bot_link_notice";

function accountId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("barber_user") || "null") as { id?: string } | null;
    if (user?.id) return String(user.id);
  } catch { /* the saved account can be unreadable */ }
  return localStorage.getItem("zumio_device_account_id") || "account";
}

function noticeSeen(): boolean {
  try {
    return localStorage.getItem(`${NOTICE_KEY}:${accountId()}`) === "1";
  } catch {
    return false;
  }
}

function markNoticeSeen() {
  try {
    localStorage.setItem(`${NOTICE_KEY}:${accountId()}`, "1");
  } catch { /* a private browser can refuse storage */ }
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
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeHiding, setNoticeHiding] = useState(false);
  const [infoPulse, setInfoPulse] = useState(false);
  const infoRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const telegramWait = useRef<number | null>(null);
  const telegramVis = useRef<(() => void) | null>(null);
  const [webWait, setWebWait] = useState(false);
  const [webNote, setWebNote] = useState<null | "missing" | "copied">(null);
  const [digits, setDigits] = useState("");
  const [checking, setChecking] = useState(false);
  const [hit, setHit] = useState<PhoneHit | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetId, setTargetId] = useState(clientId);

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

  function stopTelegramWait() {
    if (telegramWait.current != null) window.clearTimeout(telegramWait.current);
    telegramWait.current = null;
    if (telegramVis.current) {
      document.removeEventListener("visibilitychange", telegramVis.current);
      telegramVis.current = null;
    }
    setWebWait(false);
  }

  function watchTelegramOpen() {
    stopTelegramWait();
    setWebNote(null);
    setWebWait(true);
    const onHidden = () => {
      if (document.hidden) stopTelegramWait();
    };
    telegramVis.current = onHidden;
    document.addEventListener("visibilitychange", onHidden);
    telegramWait.current = window.setTimeout(() => {
      telegramWait.current = null;
      if (telegramVis.current) {
        document.removeEventListener("visibilitychange", telegramVis.current);
        telegramVis.current = null;
      }
      if (!document.hidden) {
        setWebWait(false);
        setWebNote("missing");
      }
    }, 2500);
  }

  useEffect(() => () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    if (telegramWait.current != null) window.clearTimeout(telegramWait.current);
    if (telegramVis.current) document.removeEventListener("visibilitychange", telegramVis.current);
  }, []);

  function openUnderSheet() {
    if (knownPhone) {
      setPhoneOpen(false);
      setChannelOpen(true);
      return;
    }
    setChannelOpen(false);
    setDigits("");
    setHit(null);
    setChecking(false);
    setPhoneOpen(true);
  }

  function start() {
    setTargetId(clientId);
    stopTelegramWait();
    setWebNote(null);
    openUnderSheet();
    if (noticeSeen()) return;
    setNoticeHiding(false);
    setNoticeOpen(true);
  }

  function finishNotice() {
    setNoticeOpen(false);
    setNoticeHiding(false);
    const card = cardRef.current;
    if (card) {
      card.style.transition = "";
      card.style.transform = "";
      card.style.opacity = "";
    }
    setInfoPulse(true);
    window.setTimeout(() => setInfoPulse(false), 900);
  }

  function continueAfterNotice() {
    if (noticeHiding) return;
    markNoticeSeen();
    if (!phoneOpen && !channelOpen) openUnderSheet();
    const info = infoRef.current;
    const card = cardRef.current;
    if (!info || !card) {
      finishNotice();
      return;
    }
    const infoBox = info.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const dx = infoBox.left + infoBox.width / 2 - (cardBox.left + cardBox.width / 2);
    const dy = infoBox.top + infoBox.height / 2 - (cardBox.top + cardBox.height / 2);
    setNoticeHiding(true);
    card.style.transition = "transform 520ms cubic-bezier(.22,.8,.2,1), opacity 520ms ease";
    card.style.transform = `translate(${dx}px, ${dy}px) scale(0.06)`;
    card.style.opacity = "0";
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(finishNotice, 540);
  }

  function closePhone() {
    if (saving) return;
    setPhoneOpen(false);
  }

  function closeChannel() {
    stopTelegramWait();
    setWebNote(null);
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
    if (webWait) return;
    const text = inviteText(barberName || "usta", botUsername, targetId);
    await copyText(text);
    const number = knownPhone || `+998${digits}`;
    if (isTelegramWebApp()) {
      watchTelegramOpen();
      openTelegramPhone(number);
      return;
    }
    window.location.href = `tg://resolve?phone=${encodeURIComponent(number)}`;
  }

  async function sendSms() {
    const text = inviteText(barberName || "usta", botUsername, targetId);
    const number = knownPhone || `+998${digits}`;
    if (isTelegramWebApp()) {
      stopTelegramWait();
      await copyText(text);
      setWebNote("copied");
      return;
    }
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 flex-1 text-base font-bold text-foreground">⚠️ Telefon raqami kiritilmagan</h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  ref={infoRef}
                  type="button"
                  aria-label={pick(lang, "Eslatma", "Напоминание")}
                  onClick={() => setNoticeOpen(true)}
                  className={`h-9 w-9 rounded-full border border-white/20 text-sm font-bold text-foreground ${infoPulse ? "ring-2 ring-primary" : ""}`}
                >
                  i
                </button>
                <button type="button" aria-label="Yopish" onClick={closePhone} className="h-9 w-9 rounded-xl bg-white/8 text-muted-foreground">
                  <X className="mx-auto h-4 w-4" />
                </button>
              </div>
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="pl-6 text-base font-bold text-foreground">{pick(lang, "Botga ulash", "Подключить к боту")}</h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  ref={infoRef}
                  type="button"
                  aria-label={pick(lang, "Eslatma", "Напоминание")}
                  onClick={() => setNoticeOpen(true)}
                  className={`h-9 w-9 rounded-full border border-white/20 text-sm font-bold text-foreground ${infoPulse ? "ring-2 ring-primary" : ""}`}
                >
                  i
                </button>
                <button type="button" aria-label="Yopish" onClick={closeChannel} className="h-9 w-9 rounded-xl bg-white/8 text-muted-foreground">
                  <X className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-snug text-muted-foreground">
              {pick(lang, "Mijozni botga ulash va bron tafsilotlarini yuborish uchun qaysi aloqa turini tanlaysiz?", "Как отправить клиенту подключение к боту и детали записи?")}
            </p>
            {webNote === "missing" && (
              <p className="mt-3 text-sm font-medium leading-snug text-yellow-400">
                {pick(
                  lang,
                  "Bu raqamda Telegram topilmadi yoki profil sozlamalari yopiq. Endi SMS orqali yuborib ko‘ring.",
                  "В этом номере Telegram не найден или профиль закрыт. Попробуйте отправить через SMS.",
                )}
              </p>
            )}
            {webNote === "copied" && (
              <p className="mt-3 text-sm font-medium leading-snug text-green-400">
                {pick(
                  lang,
                  "Xabar matni nusxalandi. Endi o‘zingizning SMS ilovangizga kirib, ushbu matnni mijoz raqamiga  yuborishingiz mumkun.",
                  "Текст сообщения скопирован. Теперь откройте своё SMS-приложение и отправьте этот текст на номер клиента.",
                )}
              </p>
            )}
            <button type="button" disabled={webWait} onClick={() => void sendTelegram()} className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-extrabold text-black disabled:opacity-40">
              {webWait
                ? pick(lang, "Tekshirilmoqda...", "Проверка...")
                : pick(lang, "✈️ Telegram orqali", "✈️ Через Telegram")}
            </button>
            <button type="button" disabled={webWait} onClick={() => void sendSms()} className="mt-2 h-12 w-full rounded-xl border border-white/15 text-sm font-semibold text-foreground disabled:opacity-40">
              {pick(lang, webNote === "missing" ? "💬 SMS orqali yuborish" : "💬 SMS orqali", webNote === "missing" ? "💬 Отправить по SMS" : "💬 Через SMS")}
            </button>
            <button type="button" onClick={closeChannel} className="mt-3 h-11 w-full rounded-xl text-sm text-muted-foreground">
              {pick(lang, "Bekor qilish", "Отмена")}
            </button>
          </div>
        </div>
      )}

      {noticeOpen && (
        <div className={`fixed inset-0 z-[260] flex items-center justify-center p-4 transition-colors duration-300 ${noticeHiding ? "pointer-events-none bg-transparent" : "bg-black/70"}`}>
          <div ref={cardRef} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1a1f] p-5">
            <h2 className="text-xl font-bold text-foreground">{pick(lang, "Eslatma!", "Напоминание!")}</h2>
            <p className="mt-4 text-sm leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground">{pick(lang, "Telegram orqali: ", "Через Telegram: ")}</span>
              {pick(
                lang,
                "Yuborish tanlanganda mijoz raqami bo‘yicha Telegram qidiriladi. Profil topilsa, chat avtomatik ochiladi va yuboriladigan xabar nusxalanadi — siz shunchaki shu xabarni chatga joylab yuborishingiz kerak. Agar chat ochilmasa yoki profil topilmasa, SMS xizmatidan foydalanishingiz mumkin.",
                "При выборе отправки Telegram ищется по номеру клиента. Если профиль найден, чат откроется сам, а текст сообщения скопируется — вам останется вставить его в чат и отправить. Если чат не открылся или профиль не найден, можно воспользоваться SMS.",
              )}
            </p>
            <p className="mt-3 text-sm leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground">{pick(lang, "SMS orqali: ", "Через SMS: ")}</span>
              {pick(
                lang,
                "Yuboriladigan xabar telefoningizdagi aloqa paketi yoki SMS hisobingizdan ketadi.",
                "Сообщение спишется с пакета связи или SMS-баланса вашего телефона.",
              )}
            </p>
            <button
              type="button"
              onClick={continueAfterNotice}
              className="mt-5 h-12 w-full rounded-xl bg-primary text-sm font-extrabold text-black"
            >
              {pick(lang, "Tushunarli", "Понятно")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
