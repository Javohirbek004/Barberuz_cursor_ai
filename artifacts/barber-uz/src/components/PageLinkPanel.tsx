import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import QRCode from "react-qr-code";
import { APP_DISPLAY_HOST, APP_ORIGIN } from "@/lib/config";
import { QR_CARD, canvasToPdf, canvasToPngBlob, drawQrPoster } from "@/lib/qr-poster";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const DEFAULT_CTA = "Onlayn navbat olish uchun skanerlang";
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

function formatUz(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  return `${day}-${MONTHS[month - 1]}`;
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

function problemText(status: CheckStatus, suggestion?: string | null) {
  if (status === "space") return "❌ Probel ishlatish mumkin emas. O‘rniga '-' yoki '_' qo‘llang.";
  if (status === "format") return "❌ Faqat lotin harflari (a-z), raqamlar va '-' yoki '_' belgilaridan foydalanish mumkin.";
  if (status === "length") return "❌ Manzil uzunligi 3 tadan 24 tagacha belgi bo‘lishi kerak.";
  if (status === "reserved") return "❌ Ushbu nom tizim tomonidan zaxiralangan.";
  if (status === "taken") {
    return suggestion
      ? `❌ Ushbu manzil allaqachon band. 💡 Taklif: ${displayAddress(suggestion)}`
      : "❌ Ushbu manzil allaqachon band.";
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
  const [cta, setCta] = useState(DEFAULT_CTA);
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
        if (typeof data.qrCta === "string" && data.qrCta.trim()) setCta(data.qrCta);
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

  function share() {
    const text = `Menga yozilish uchun:\n${pageUrl}`;
    if (navigator.share) navigator.share({ title: displayName || "Barber sahifasi", text, url: pageUrl }).catch(() => {});
    else navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sahifa manzili</p>
          {!locked && (
            <button type="button" onClick={() => setEditorOpen(true)} className="text-xs text-primary font-semibold">
              Tahrirlash
            </button>
          )}
        </div>
        <div className="bg-background/60 border border-white/8 rounded-xl px-3 py-2.5 mb-3">
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-mono break-all">{address}</a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="h-10 rounded-xl text-xs font-semibold border border-white/8 bg-white/5">
            {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <button type="button" onClick={share} className="h-10 rounded-xl text-xs font-semibold border border-white/8 bg-white/5">
            Ulashish
          </button>
        </div>
        {locked && changedAt && nextAt && (
          <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
            ⛔ Manzilni o‘zgartirish cheklangan. Siz manzilingizni oxirgi marta {formatUz(changedAt)} kuni o‘zgartirgansiz. Qayta o‘zgartirish imkoniyati {formatUz(nextAt)} kuni ({daysLeft(nextAt)} kundan keyin) ochiladi.
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
            setToast(`✅ Sahifa manzili yangilandi! Yangi havolangiz: ${displayAddress(next.username)} (Keyingi o‘zgartirish imkoniyati: ${formatUz(next.nextChangeAt)} kuni ochiladi)`);
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
          aria-label="Yozuvni tahrirlash"
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
          idle="📥 RASM ni Yuklash"
        />
        <QrDownloadLink
          kind="pdf"
          slug={slug}
          canvasRef={canvasRef}
          className="h-11 rounded-xl bg-white/8 text-xs font-bold"
          idle="🖨 PDF ni Yuklash"
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
  const nextDate = formatUz(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

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
      if (res.status === 429) setError("⛔ Manzilni o‘zgartirish cheklangan.");
      else if (res.status === 409) setError(problemText("taken", data.suggestion));
      else if (!res.ok) setError(problemText(data.error) || "Xatolik yuz berdi");
      else onSaved({ username: data.username, slugChangedAt: data.slugChangedAt, nextChangeAt: data.nextChangeAt });
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Yopish" />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-card p-5">
        {step === "edit" ? (
          <>
            <h2 className="text-base font-bold mb-4">Sahifa manzilini tahrirlash</h2>
            <p className="text-xs text-muted-foreground mb-2">{APP_DISPLAY_HOST}/@</p>
            <input autoFocus value={draft} onChange={(event) => { setDraft(event.target.value.toLowerCase()); setError(""); }}
              className="w-full rounded-xl border border-white/12 bg-background/60 px-3 py-2.5 font-mono text-sm text-primary outline-none" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              ℹ️ Manzil qoidalari: Faqat lotin harflari (a-z), raqamlar (0-9), '-' va '_' belgilaridan foydalaning (3–24 belgi). Probel va kirill harflari mumkin emas.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              💡 30 kunlik qoida: Sahifa manzilini 30 kunda 1 marta o‘zgartirish mumkin. Sahifa manzilingiz o‘zgargan taqdirda ham, chop etilgan eski QR-kod 30 kun davomida yangi havolangizga avtomatik ravishda yoʻnaltirib turadi.
            </p>
            {status === "ok" && draft.toLowerCase() !== currentSlug && (
              <p className="mt-3 text-xs text-emerald-400">✅ Ajoyib! Bu manzil bo‘sh va foydalanishga tayyor.</p>
            )}
            {status && status !== "ok" && <p className="mt-3 text-xs text-red-300">{problemText(status, suggestion)}</p>}
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-white/6 text-sm">✕ Bekor qilish</button>
              <button type="button" disabled={!ready} onClick={() => setStep("confirm")} className="h-11 flex-1 rounded-2xl bg-primary text-sm font-bold text-black disabled:opacity-40">
                Saqlash
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold mb-2">⚠️ Sahifa manzilini o‘zgartirasizmi?</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Yangi manzil: {displayAddress(draft.toLowerCase())}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Diqqat! Keyingi safar manzilni faqat {nextDate} kuni o‘zgartira olasiz.
            </p>
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-white/6 text-sm">✕ Bekor qilish</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="h-11 flex-1 rounded-2xl bg-primary text-sm font-bold text-black disabled:opacity-50">
                {saving ? "Saqlanmoqda" : "✅ Ha, o‘zgartirish"}
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
  const [href, setHref] = useState("");
  const [busy, setBusy] = useState(false);
  const name = `barber-qr-${slug}.${kind}`;

  function fileBlob(): Blob | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return kind === "png" ? canvasToPngBlob(canvas) : canvasToPdf(canvas);
  }

  function attach(anchor: HTMLAnchorElement, blob: Blob) {
    const url = URL.createObjectURL(blob);
    setHref((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    anchor.href = url;
    anchor.download = name;
  }

  return (
    <a
      href={href || undefined}
      download={name}
      data-testid={kind === "png" ? "qr-download-png" : "qr-download-pdf"}
      className={`${className} flex items-center justify-center no-underline`}
      onPointerDown={(event) => {
        const blob = fileBlob();
        if (!blob) return;
        flushSync(() => {
          attach(event.currentTarget, blob);
          setBusy(true);
        });
        event.currentTarget.href = hrefFrom(event.currentTarget) || event.currentTarget.href;
        event.currentTarget.download = name;
      }}
      onClick={(event) => {
        const anchor = event.currentTarget;
        if (!anchor.href.startsWith("blob:")) {
          event.preventDefault();
          const blob = fileBlob();
          if (blob) saveBlob(blob, name);
        }
        setBusy(false);
      }}
    >
      {busy ? "Yuklanmoqda..." : idle}
    </a>
  );
}

function hrefFrom(anchor: HTMLAnchorElement): string {
  const raw = anchor.getAttribute("href") || "";
  return raw.startsWith("blob:") ? raw : "";
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 30000);
}

