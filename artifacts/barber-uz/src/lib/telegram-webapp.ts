type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  phone_number?: string;
};

type TgWebApp = {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  initDataUnsafe?: { user?: TgUser };
  requestContact?: (cb?: (shared: boolean, extra?: unknown) => void) => void;
  onEvent?: (event: string, cb: (data: unknown) => void) => void;
  offEvent?: (event: string, cb: (data: unknown) => void) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function getTelegramWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

export function wakeTelegramWebApp() {
  const tg = getTelegramWebApp();
  try {
    tg?.ready?.();
    tg?.expand?.();
  } catch {
    // Not inside Telegram.
  }
}

/** Leave the booking page and land back in the bot chat. */
export function closeTelegramWebApp(): boolean {
  const tg = getTelegramWebApp();
  if (!tg?.close) return false;
  try {
    tg.close();
    return true;
  } catch {
    return false;
  }
}

export function telegramWebAppUser(): TgUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function extractPhoneNumber(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return "";
  const direct = rec.phone_number ?? rec.phone;
  if (typeof direct === "string" && direct.replace(/\D/g, "").length >= 9) return direct;
  const nested = [
    rec.contact,
    rec.user,
    rec.responseUnsafe,
    asRecord(rec.responseUnsafe)?.user,
    asRecord(rec.responseUnsafe)?.contact,
  ];
  for (const item of nested) {
    const found = extractPhoneNumber(item);
    if (found) return found;
  }
  return "";
}

/** Ask Telegram for the visitor's phone. Resolves empty if they cancel or the app is not a Mini App. */
export function requestTelegramContact(timeoutMs = 20_000): Promise<string> {
  const tg = getTelegramWebApp();
  if (!tg?.requestContact) return Promise.resolve("");

  return new Promise((resolve) => {
    let done = false;
    const finish = (phone: string) => {
      if (done) return;
      done = true;
      try { tg.offEvent?.("contactRequested", onEvent); } catch { /* ignore */ }
      resolve(phone);
    };
    const onEvent = (data: unknown) => {
      const rec = asRecord(data);
      if (rec?.status === "cancelled") {
        finish("");
        return;
      }
      finish(extractPhoneNumber(data) || extractPhoneNumber(tg.initDataUnsafe));
    };
    try { tg.onEvent?.("contactRequested", onEvent); } catch { /* older clients */ }
    try {
      tg.requestContact?.((shared, extra) => {
        if (!shared) {
          finish("");
          return;
        }
        finish(extractPhoneNumber(extra) || extractPhoneNumber(tg.initDataUnsafe));
      });
    } catch {
      finish("");
    }
    window.setTimeout(() => finish(""), timeoutMs);
  });
}
