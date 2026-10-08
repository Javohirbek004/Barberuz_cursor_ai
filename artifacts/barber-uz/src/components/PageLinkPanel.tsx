import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { APP_DISPLAY_HOST, APP_ORIGIN } from "@/lib/config";
import { canvasToPdf, drawQrPoster } from "@/lib/qr-poster";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const DEFAULT_CTA = "Onlayn navbat olish uchun skanerlang";
const CTA_PRESETS = [
  "Onlayn navbat olish uchun skanerlang",
  "Bron qilish uchun skanerlang",
  "Navbatingizni oldindan band qiling",
];
const RESERVED = new Set(["admin", "login", "settings", "services", "barber", "register", "dashboard", "calendar", "clients", "client", "api", "b"]);
const DEFAULT_LOGO = "/images/logo.png";

type CheckStatus = "ok" | "space" | "format" | "length" | "reserved" | "taken" | "";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("barber_token") || ""}`, "Content-Type": "application/json" };
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
  const [logo, setLogo] = useState<string | null>(null);
  const [scans, setScans] = useState<number | null>(null);
  const [bookings, setBookings] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const qrReady = useRef(false);

  useEffect(() => { setSlug(userSlug); }, [userSlug]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/profile", { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setChangedAt(data.slugChangedAt || null);
        setNextAt(data.nextChangeAt || null);
        if (typeof data.qrCta === "string" && data.qrCta.trim()) setCta(data.qrCta);
        if (typeof data.qrLogo === "string" && data.qrLogo) setLogo(data.qrLogo);
        qrReady.current = true;
      })
      .catch(() => {});
    fetch("/api/settings/page-stats", { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setScans(Number(data.scans || 0));
        setBookings(Number(data.bookings || 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  const locked = !!nextAt && new Date(nextAt).getTime() > Date.now();
  const pageUrl = `${APP_ORIGIN}/${slug}`;
  const address = displayAddress(slug);

  async function saveQr(next: { cta?: string; logo?: string | null }) {
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

      <QrStudio
        slug={slug}
        address={address}
        cta={cta}
        logo={logo}
        onCta={setCta}
        onLogo={(value) => { setLogo(value); void saveQr({ logo: value }); }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-primary mb-1">{scans ?? "—"}</p>
          <p className="text-xs text-muted-foreground">QR skanerlashlar</p>
        </div>
        <div className="bg-card border border-white/6 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-400 mb-1">{bookings ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Bronlar</p>
        </div>
      </div>

      {editorOpen && (
        <SlugEditor
          currentSlug={slug}
          onClose={() => setEditorOpen(false)}
          onSaved={(next) => {
            setSlug(next.username);
            setChangedAt(next.slugChangedAt);
            setNextAt(next.nextChangeAt);
            onSlugChange(next.username);
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
  slug, address, cta, logo, onCta, onLogo,
}: {
  slug: string;
  address: string;
  cta: string;
  logo: string | null;
  onCta: (value: string) => void;
  onLogo: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const logoUrl = logo || DEFAULT_LOGO;
  const scanUrl = `${APP_ORIGIN}/${slug}?qr=1`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = qrRef.current?.querySelector("svg");
    if (!canvas || !svg) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      drawQrPoster(canvas, { url: scanUrl, address, cta, logoUrl, qrSvg: svg }).catch(() => {});
      if (cancelled) return;
    }, 60);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [scanUrl, address, cta, logoUrl]);

  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    saveBlob(blob, `barber-qr-${slug}.png`);
  }

  async function downloadPdf() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToPdf(canvas);
    saveBlob(blob, `barber-qr-${slug}.pdf`);
  }

  async function pickLogo(file: File) {
    const data = await resizeLogo(file);
    onLogo(data);
  }

  return (
    <div className="bg-card border border-white/6 rounded-2xl p-4 space-y-4">
      <canvas ref={canvasRef} className="w-full rounded-2xl bg-white" />
      <div ref={qrRef} className="absolute h-0 w-0 overflow-hidden" aria-hidden>
        <QRCode value={scanUrl} size={680} level="H" bgColor="#ffffff" fgColor="#111111" />
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">QR ostidagi yozuv</label>
      <input value={cta} maxLength={80} onChange={(event) => onCta(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2.5 text-sm outline-none" />
      <div className="flex flex-wrap gap-2">
        {CTA_PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onCta(preset)}
            className={`rounded-full border px-3 py-1.5 text-xs ${cta === preset ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground"}`}>
            {preset}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold flex items-center justify-center cursor-pointer">
          Logo yuklash
          <input type="file" accept="image/*" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pickLogo(file);
          }} />
        </label>
        {logo && (
          <button type="button" onClick={() => onLogo(null)} className="h-10 px-3 rounded-xl border border-white/10 text-xs">
            Asl belgi
          </button>
        )}
      </div>
      <p className="text-xs text-amber-200/80 leading-relaxed">
        💡 Eslatma: Sahifa manzilingizni o‘zgartirsangiz ham, chop etilgan ushbu QR-kod 30 kun davomida avtomatik ravishda yangi havolangizga yo‘naltirib turiladi.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void downloadPng()} className="h-11 rounded-xl bg-primary text-black text-xs font-bold">📥 PNG Yuklash</button>
        <button type="button" onClick={() => void downloadPdf()} className="h-11 rounded-xl bg-white/8 text-xs font-bold">🖨 PDF Yuklash</button>
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
              {" "}💡 30 kunlik qoida: Sahifa manzilini 30 kunda 1 marta o‘zgartirish mumkin. Eski manzil yangisiga 30 kun yo‘naltirib turiladi (Redirect).
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

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("image"));
    img.src = URL.createObjectURL(file);
  });
}
