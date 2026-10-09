export function deviceKey(): string {
  let key = localStorage.getItem("barber_device_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("barber_device_key", key);
  }
  return key;
}

type TelegramWebApp = {
  platform?: string;
};

function cleanModel(raw: string): string | null {
  const model = raw.replace(/\s+Build\b.*/i, "").trim();
  if (!model || /^(linux|android|k|mobile|wv)$/i.test(model)) return null;
  return model;
}

export function telegramPlatform(): string {
  if (typeof window === "undefined") return "";
  const webApp = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  return webApp?.platform || "";
}

/** Phone or computer name from the browser string, a model hint, and Telegram's platform. */
export function deviceTitle(ua = "", platform = "", modelHint = ""): string {
  const hinted = cleanModel(modelHint);
  if (hinted) return hinted;

  const android = ua.match(/Android(?:\s[\d.]+)?;\s*([^;)]+)/i);
  if (android) {
    const model = cleanModel(android[1]);
    if (model) return model;
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac OS|Macintosh/i.test(ua)) return "Mac";
  if (platform === "ios") return "iPhone";
  if (platform === "macos") return "Mac";
  if (platform === "android" || /Android/i.test(ua)) return "Android Smartphone";
  if (/Linux/i.test(ua)) return "Linux";
  if (platform === "tdesktop") return "Windows PC";
  return "Qurilma";
}

export function deviceLabel(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  return deviceTitle(ua, telegramPlatform());
}

type AgentData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string }>;
};

/** Prefer the real phone model when the browser is allowed to share it. */
export async function resolveDeviceName(): Promise<string> {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const platform = telegramPlatform();
  let modelHint = "";
  try {
    const data = (navigator as Navigator & { userAgentData?: AgentData }).userAgentData;
    if (data?.getHighEntropyValues) {
      const hints = await data.getHighEntropyValues(["model", "platform"]);
      modelHint = hints.model || "";
      if (!modelHint && /android/i.test(hints.platform || "")) {
        return deviceTitle(ua, platform || "android");
      }
    }
  } catch {
    // The plain browser string is enough.
  }
  return deviceTitle(ua, platform, modelHint);
}

export function deviceHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem("barber_token") || ""}`,
    "Content-Type": "application/json",
    "X-Device-Key": deviceKey(),
    "X-Device-Label": deviceLabel(),
  };
}

/** Remember this phone on the account. Safe to call often; it waits a minute between tries. */
export function touchThisDevice() {
  const token = localStorage.getItem("barber_token") || "";
  if (!token || token.startsWith("barber_token_")) return;
  const last = Number(sessionStorage.getItem("barber_device_touch") || 0);
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem("barber_device_touch", String(Date.now()));
  fetch("/api/settings/security", { headers: deviceHeaders() }).catch(() => {});
}
