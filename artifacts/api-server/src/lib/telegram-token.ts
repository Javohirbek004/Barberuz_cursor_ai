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
