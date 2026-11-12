import crypto from "crypto";

/**
 * Telegram repeats this value in a header on every update it sends us, so we can
 * tell real updates from forged ones. It is derived from a secret the server already
 * has, so nothing new has to be set. Allowed characters: letters, digits, _ and -.
 */
export function webhookSecretToken(): string {
  const seed = process.env.TELEGRAM_BOT_SECRET?.trim() || "";
  if (!seed) return "";
  return crypto.createHmac("sha256", seed).update("telegram-webhook-v1").digest("base64url");
}

/**
 * The server's own public host. Telegram talks to the server directly, not through the website.
 */
export function productionHost(): string {
  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
  if (renderHost) return renderHost;

  if (process.env.APP_URL) {
    try {
      const host = new URL(process.env.APP_URL).hostname;
      if (host && !host.includes("replit") && !host.endsWith("vercel.app")) return host;
    } catch { /* ignore */ }
  }

  return "barber-uz-clq6.onrender.com";
}

/** Render and other hosted runtimes own the live bot. Local dev must not. */
export function isRenderHost(): boolean {
  return Boolean(
    process.env.RENDER ||
      process.env.RENDER_EXTERNAL_HOSTNAME ||
      process.env.RENDER_SERVICE_ID,
  );
}

export function isProductionRuntime(): boolean {
  return isRenderHost() || process.env.NODE_ENV === "production";
}

const DEFAULT_BOT_USERNAME = "BARBERUZ_YORDAMCHI_BOT";

let learnedUsername = "";

function cleanBotUsername(raw: string): string {
  let name = raw.trim();
  if (!name) return "";
  const link = name.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{4,})/i);
  if (link?.[1]) name = link[1];
  name = name.replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  if (!/^[A-Za-z0-9_]{4,32}$/.test(name)) return "";
  return name;
}

/** Remember the @name Telegram itself reports for the saved bot key. */
export function rememberBotUsername(name: string): void {
  const clean = cleanBotUsername(name);
  if (clean) learnedUsername = clean;
}

export function hasLearnedBotUsername(): boolean {
  return Boolean(learnedUsername);
}

/** Public @name of the live bot. The saved key's own name wins over a typed name. */
export function getTelegramBotUsername(): string {
  if (learnedUsername) return learnedUsername;
  const fromEnv = cleanBotUsername(process.env.TELEGRAM_BOT_USERNAME || "");
  return fromEnv || DEFAULT_BOT_USERNAME;
}

export function getTelegramBotToken(): string {
  if (!isProductionRuntime()) {
    return (
      process.env.TELEGRAM_BOT_TOKEN_TEST?.trim() ||
      process.env.TELEGRAM_TEST_BOT_TOKEN?.trim() ||
      ""
    );
  }
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function shouldRegisterTelegramWebhook(): boolean {
  return isProductionRuntime();
}

export function shouldPollTelegram(): boolean {
  if (isProductionRuntime()) return false;
  return Boolean(getTelegramBotToken());
}
