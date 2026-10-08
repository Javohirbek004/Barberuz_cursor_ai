export function deviceKey(): string {
  let key = localStorage.getItem("barber_device_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("barber_device_key", key);
  }
  return key;
}

export function deviceLabel(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const android = ua.match(/Android\s[\d.]+;\s*([^;)]+)/i);
  if (android) {
    const model = android[1].replace(/\s+Build.*/i, "").trim();
    if (model && !/linux/i.test(model)) return model;
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Brauzer";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /Linux/i.test(ua)
          ? "Linux"
          : "Qurilma";
  return `${browser} / ${os}`;
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
