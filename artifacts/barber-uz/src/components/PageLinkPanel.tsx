import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import QRCode from "react-qr-code";
import { APP_DISPLAY_HOST, APP_ORIGIN } from "@/lib/config";
import { useTranslation } from "@/i18n/LanguageContext";
import { monthNames, pick } from "@/i18n/pick";
import { QR_CARD, canvasToPdfBase64, canvasToPngBase64, drawQrPoster } from "@/lib/qr-poster";

const CTA_UZ = "Onlayn navbat olish uchun skanerlang";
const CTA_RU = "Отсканируйте, чтобы занять очередь онлайн";
const RESERVED = new Set(["admin", "login", "settings", "services", "barber", "register", "dashboard", "calendar", "clients", "client", "api", "b"]);

type CheckStatus = "ok" | "space" | "format" | "length" | "reserved" | "taken" | "";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("barber_token") || ""}`, "Content-Type": "application/json" };
}

function rememberSlug(next: string) {
  try {
    const stored = JSON.parse(localStorage.getItem("barber_user") || "null");
    if (!stored || typeof stored !== "object") return;
    stored.username = next;
    localStorage.setItem("barber_user", JSON.stringify(stored));
  } catch {
    // Storage can be blocked. The page still shows the new address.
  }
}

function displayAddress(slug: string) {
  return `${APP_DISPLAY_HOST}/@${slug}`;
}

function formatWhen(iso: string, lang: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  return `${day} ${monthNames(lang)[month - 1]}`;
}

function shownCta(saved: string, lang: string) {
  if (saved === CTA_UZ || saved === CTA_RU) return lang === "ru" ? CTA_RU : CTA_UZ;
  return saved;
}

function daysLeft(iso: string) {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function localProblem(raw: string): CheckStatus {
  if (/\s/.test(raw)) return "space";
  const lower = raw.toLowerCase();
  if (!/^[a-z0-9_-]*$/.test(lower)) return "format";
  if (lower.length < 3 || lower.length > 24) return "length";
  if (RESERVED.has(lower)) return "reserved";
  return "";
}

function problemText(status: CheckStatus, lang: string, suggestion?: string | null) {
  if (status === "space") return pick(lang, "❌ Probel ishlatish mumkin emas. O‘rniga '-' yoki '_' qo‘llang.", "❌ Пробел нельзя. Используйте '-' или '_'.");
  if (status === "format") return pick(lang, "❌ Faqat lotin harflari (a-z), raqamlar va '-' yoki '_' belgilaridan foydalanish mumkin.", "❌ Только латинские буквы (a-z), цифры и знаки '-' или '_'.");
  if (status === "length") return pick(lang, "❌ Manzil uzunligi 3 tadan 24 tagacha belgi bo‘lishi kerak.", "❌ Адрес должен быть от 3 до 24 символов.");
  if (status === "reserved") return pick(lang, "❌ Ushbu nom tizim tomonidan zaxiralangan.", "❌ Это имя занято системой.");
  if (status === "taken") {
    return suggestion
      ? pick(lang, `❌ Ushbu manzil allaqachon band. 💡 Taklif: ${displayAddress(suggestion)}`, `❌ Этот адрес уже занят. 💡 Вариант: ${displayAddress(suggestion)}`)
      : pick(lang, "❌ Ushbu manzil allaqachon band.", "❌ Этот адрес уже занят.");
  }
  return "";
}

export function PageLinkPanel({
  userSlug,
  displayName,
  onSlugChange,
}: {
  userSlug: string;
  displayName: string;
  onSlugChange: (slug: string) => void;
}) {
  const [slug, setSlug] = useState(userSlug);
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const { lang } = useTranslation();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [cta, setCta] = useState(CTA_UZ);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const qrReady = useRef(false);
  const onSlugChangeRef = useRef(onSlugChange);
  onSlugChangeRef.current = onSlugChange;

  useEffect(() => { setSlug(userSlug); }, [userSlug]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/profile", { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setChangedAt(data.slugChangedAt || null);
        setNextAt(data.nextChangeAt || null);
        if (typeof data.username === "string" && data.username && data.username !== slug) {
          setSlug(data.username);
          onSlugChangeRef.current(data.username);
          rememberSlug(data.username);
        }
        if (typeof data.qrCta === "string" && data.qrCta.trim()) setCta(shownCta(data.qrCta, langRef.current));
        qrReady.current = true;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  const locked = !!nextAt && new Date(nextAt).getTime() > Date.now();
  const pageUrl = `${APP_ORIGIN}/${slug}`;
  const address = displayAddress(slug);

  async function saveQr(next: { cta?: string }) {
    await fetch("/api/settings/qr", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(next),
    });
  }

  useEffect(() => {
    if (!qrReady.current) return;
    const timer = window.setTimeout(() => { void saveQr({ cta }); }, 400);
    return () => window.clearTimeout(timer);
  }, [cta]);

  useEffect(() => {
    setCta((current) => shownCta(current, lang));
  }, [lang]);

  function share() {
    const text = pick(lang, `Menga yozilish uchun:\n${pageUrl}`, `Запись ко мне:\n${pageUrl}`);
    if (navigator.share) navigator.share({ title: displayName || pick(lang, "Barber sahifasi", "Страница барбера"), text, url: pageUrl }).catch(() => {});
    else navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{pick(lang, "Sahifa manzili", "Адрес страницы")}</p>
          {!locked && (
            <button type="button" onClick={() => setEditorOpen(true)} className="text-xs text-primary font-semibold">
              {pick(lang, "Tahrirlash", "Изменить")}
            </button>
          )}
        </div>
        <div className="bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-3">
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-mono break-all">{address}</a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="h-10 rounded-xl text-xs font-semibold border border-white/8 bg-white/5">
            {copied ? pick(lang, "Nusxalandi", "Скопировано") : pick(lang, "Nusxalash", "Копировать")}
          </button>
          <button type="button" onClick={share} className="h-10 rounded-xl text-xs font-semibold border border-white/8 bg-white/5">
            {pick(lang, "Ulashish", "Поделиться")}
          </button>
        </div>
        {locked && changedAt && nextAt && (
          <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
            {pick(
              lang,
              `⛔ Manzilni o‘zgartirish cheklangan. Siz manzilingizni oxirgi marta ${formatWhen(changedAt, lang)} kuni o‘zgartirgansiz. Qayta o‘zgartirish imkoniyati ${formatWhen(nextAt, lang)} kuni (${daysLeft(nextAt)} kundan keyin) ochiladi.`,
              `⛔ Адрес пока нельзя менять. Последний раз вы меняли его ${formatWhen(changedAt, lang)}. Снова можно ${formatWhen(nextAt, lang)} (через ${daysLeft(nextAt)} дн.).`,
            )}
          </div>
        )}
      </div>

      <QrStudio slug={slug} cta={cta} onCta={setCta} />

      {editorOpen && (
        <SlugEditor
          currentSlug={slug}
          onClose={() => setEditorOpen(false)}
          onSaved={(next) => {
            setSlug(next.username);
            setChangedAt(next.slugChangedAt);
            setNextAt(next.nextChangeAt);
            onSlugChange(next.username);
            rememberSlug(next.username);
            setEditorOpen(false);
            setToast(pick(
              lang,
              `✅ Sahifa manzili yangilandi! Yangi havolangiz: ${displayAddress(next.username)} (Keyingi o‘zgartirish imkoniyati: ${formatWhen(next.nextChangeAt, lang)} kuni ochiladi)`,
              `✅ Адрес страницы обновлён! Новая ссылка: ${displayAddress(next.username)} (Следующее изменение откроется ${formatWhen(next.nextChangeAt, lang)})`,
            ));
            setTimeout(() => setToast(""), 5000);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function QrStudio({
  slug, cta, onCta,
}: {
  slug: string;
  cta: string;
  onCta: (value: string) => void;
}) {
  const { lang } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLInputElement>(null);
  const scanUrl = `${APP_ORIGIN}/${slug}?qr=1`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = qrRef.current?.querySelector("svg");
    if (!canvas || !svg) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      drawQrPoster(canvas, { cta, qrSvg: svg }).catch(() => {});
    }, 60);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [scanUrl, cta]);

  return (
    <div className="bg-card border border-white/6 rounded-2xl p-4 space-y-4">
      <canvas ref={canvasRef} data-testid="qr-canvas" className="w-full rounded-2xl bg-white" style={{ aspectRatio: `${QR_CARD.width} / ${QR_CARD.height}` }} />
      <div ref={qrRef} className="absolute h-0 w-0 overflow-hidden" aria-hidden>
        <QRCode value={scanUrl} size={680} level="H" bgColor="#ffffff" fgColor="#111111" />
      </div>
      <div className="relative">
        <input
          ref={ctaRef}
          data-testid="qr-cta"
          value={cta}
          maxLength={80}
          onChange={(event) => onCta(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2.5 pr-11 text-sm outline-none"
        />
        <button
          type="button"
          aria-label={pick(lang, "Yozuvni tahrirlash", "Изменить текст")}
          onClick={() => ctaRef.current?.focus()}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-base text-foreground"
        >
          ✎
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QrDownloadLink
          kind="png"
          slug={slug}
          canvasRef={canvasRef}
          className="h-11 rounded-xl bg-primary text-black text-xs font-bold"
          idle={pick(lang, "📥 RASM ni Yuklash", "📥 Скачать фото")}
        />
        <QrDownloadLink
          kind="pdf"
          slug={slug}
          canvasRef={canvasRef}
          className="h-11 rounded-xl bg-white/8 text-xs font-bold"
          idle={pick(lang, "🖨 PDF ni Yuklash", "🖨 Скачать PDF")}
        />
      </div>
    </div>
  );
}

function SlugEditor({
  currentSlug,
  onClose,
  onSaved,
}: {
  currentSlug: string;
  onClose: () => void;
  onSaved: (next: { username: string; slugChangedAt: string; nextChangeAt: string }) => void;
}) {
  const { lang } = useTranslation();
  const [draft, setDraft] = useState(currentSlug);
  const [status, setStatus] = useState<CheckStatus>("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const problem = localProblem(draft);
    if (problem) {
      setStatus(problem);
      setSuggestion(null);
      return;
    }
    if (draft.toLowerCase() === currentSlug) {
      setStatus("ok");
      return;
    }
    setStatus("");
    const timer = window.setTimeout(() => {
      fetch(`/api/settings/slug-check?slug=${encodeURIComponent(draft.toLowerCase())}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => {
          setStatus(data.status === "ok" ? "ok" : (data.status || "taken"));
          setSuggestion(data.suggestion || null);
        })
        .catch(() => setStatus(""));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, currentSlug]);

  const ready = status === "ok" && draft.toLowerCase() !== currentSlug;
  const nextDate = formatWhen(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), lang);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/slug", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ slug: draft.toLowerCase() }),
      });
      const data = await res.json();
      if (res.status === 429) setError(pick(lang, "⛔ Manzilni o‘zgartirish cheklangan.", "⛔ Адрес пока нельзя менять."));
      else if (res.status === 409) setError(problemText("taken", lang, data.suggestion));
      else if (!res.ok) setError(problemText(data.error, lang) || pick(lang, "Xatolik yuz berdi", "Произошла ошибка"));
      else onSaved({ username: data.username, slugChangedAt: data.slugChangedAt, nextChangeAt: data.nextChangeAt });
    } catch {
      setError(pick(lang, "Tarmoq xatosi. Qayta urinib ko‘ring.", "Нет связи. Попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={pick(lang, "Yopish", "Закрыть")} />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-card p-5">
        {step === "edit" ? (
          <>
            <h2 className="text-base font-bold mb-4">{pick(lang, "Sahifa manzilini tahrirlash", "Изменить адрес страницы")}</h2>
            <p className="text-xs text-muted-foreground mb-2">{APP_DISPLAY_HOST}/@</p>
            <input autoFocus value={draft} onChange={(event) => { setDraft(event.target.value.toLowerCase()); setError(""); }}
              className="w-full rounded-xl border border-white/12 bg-background/60 px-3 py-2.5 font-mono text-sm text-primary outline-none" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {pick(lang, "ℹ️ Manzil qoidalari: Faqat lotin harflari (a-z), raqamlar (0-9), '-' va '_' belgilaridan foydalaning (3–24 belgi). Probel va kirill harflari mumkin emas.", "ℹ️ Правила адреса: только латинские буквы (a-z), цифры (0-9), '-' и '_' (3–24 символа). Пробел и кириллица не подходят.")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {pick(lang, "💡 30 kunlik qoida: Sahifa manzilini 30 kunda 1 marta o‘zgartirish mumkin. Sahifa manzilingiz o‘zgargan taqdirda ham, chop etilgan eski QR-kod 30 kun davomida yangi havolangizga avtomatik ravishda yoʻnaltirib turadi.", "💡 Правило 30 дней: адрес страницы можно менять 1 раз в 30 дней. Старый напечатанный QR ещё 30 дней сам откроет новую ссылку.")}
            </p>
            {status === "ok" && draft.toLowerCase() !== currentSlug && (
              <p className="mt-3 text-xs text-emerald-400">{pick(lang, "✅ Ajoyib! Bu manzil bo‘sh va foydalanishga tayyor.", "✅ Отлично! Этот адрес свободен.")}</p>
            )}
            {status && status !== "ok" && <p className="mt-3 text-xs text-red-300">{problemText(status, lang, suggestion)}</p>}
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-white/6 text-sm">{pick(lang, "✕ Bekor qilish", "✕ Отмена")}</button>
              <button type="button" disabled={!ready} onClick={() => setStep("confirm")} className="h-11 flex-1 rounded-2xl bg-primary text-sm font-bold text-black disabled:opacity-40">
                {pick(lang, "Saqlash", "Сохранить")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold mb-2">{pick(lang, "⚠️ Sahifa manzilini o‘zgartirasizmi?", "⚠️ Изменить адрес страницы?")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pick(lang, "Yangi manzil:", "Новый адрес:")} {displayAddress(draft.toLowerCase())}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {pick(lang, `Diqqat! Keyingi safar manzilni faqat ${nextDate} kuni o‘zgartira olasiz.`, `Внимание! Следующий раз адрес можно изменить только ${nextDate}.`)}
            </p>
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-white/6 text-sm">{pick(lang, "✕ Bekor qilish", "✕ Отмена")}</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="h-11 flex-1 rounded-2xl bg-primary text-sm font-bold text-black disabled:opacity-50">
                {saving ? pick(lang, "Saqlanmoqda", "Сохраняется") : pick(lang, "✅ Ha, o‘zgartirish", "✅ Да, изменить")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QrDownloadLink({
  kind,
  slug,
  canvasRef,
  className,
  idle,
}: {
  kind: "png" | "pdf";
  slug: string;
  canvasRef: { current: HTMLCanvasElement | null };
  className: string;
  idle: string;
}) {
  const { lang } = useTranslation();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const lock = useRef(false);
  const name = `barber-qr-${slug}.${kind}`;

  function onClick() {
    const canvas = canvasRef.current;
    if (!canvas || lock.current) return;
    lock.current = true;
    flushSync(() => setPhase("loading"));
    try {
      const data = kind === "png" ? canvasToPngBase64(canvas) : canvasToPdfBase64(canvas);
      if (!data) throw new Error("empty");
      postQrDownload(kind, name, data);
      window.setTimeout(() => setPhase("done"), 700);
      window.setTimeout(() => {
        setPhase("idle");
        lock.current = false;
      }, 2500);
    } catch {
      setPhase("idle");
      lock.current = false;
    }
  }

  const label = phase === "loading" ? pick(lang, "Yuklanmoqda...", "Загрузка...") : phase === "done" ? pick(lang, "Yuklab olindi", "Скачано") : idle;

  return (
    <button
      type="button"
      data-testid={kind === "png" ? "qr-download-png" : "qr-download-pdf"}
      onClick={onClick}
      className={`${className} flex items-center justify-center`}
    >
      {label}
    </button>
  );
}

function postQrDownload(kind: "png" | "pdf", name: string, data: string) {
  const frame = downloadFrame();
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/qr-file";
  form.target = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "_blank" : frame.name;
  form.style.display = "none";
  for (const [key, value] of Object.entries({ kind, name, data })) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  window.setTimeout(() => form.remove(), 30000);
}

function downloadFrame(): HTMLIFrameElement {
  const existing = document.getElementById("qr-download-frame");
  if (existing instanceof HTMLIFrameElement) return existing;
  const frame = document.createElement("iframe");
  frame.id = "qr-download-frame";
  frame.name = "qr-download-frame";
  frame.hidden = true;
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  return frame;
}

