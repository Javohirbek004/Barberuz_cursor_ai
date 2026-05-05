import app from "./app";
import { registerWebhook, isBotConfigured } from "./lib/telegram-bot";
import { startReminderJob } from "./lib/reminders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Pick the best production domain from REPLIT_DOMAINS.
 * Prefers the clean domain (e.g. barberuz.replit.app) over sisko.replit.dev.
 * Falls back to APP_URL or the hardcoded production domain.
 */
function pickProdDomain(): string {
  const domains = (process.env.REPLIT_DOMAINS || "")
    .split(",")
    .map(d => d.trim())
    .filter(Boolean);

  const preferred = domains.find(d => !d.includes("sisko.replit.dev"));
  if (preferred) return preferred;

  if (domains[0]) return domains[0];

  if (process.env.APP_URL) {
    try { return new URL(process.env.APP_URL).hostname; } catch { /* ignore */ }
  }

  return "barberuz.replit.app";
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  startReminderJob();

  if (!isBotConfigured()) {
    console.warn(
      "[TelegramBot] ⚠️  TELEGRAM_BOT_TOKEN is not set. " +
      "Bot will not respond until the secret is added and the server is restarted. " +
      "After adding the token, call GET /api/telegram/setup to register the webhook.",
    );
    return;
  }

  // In development: never auto-register the webhook.
  // Doing so would overwrite the production webhook URL and break bot flows
  // for real users (their pending state lives in the prod server's memory).
  if (process.env.NODE_ENV === "development") {
    console.log(
      "[TelegramBot] Dev mode — skipping webhook auto-registration to avoid " +
      "overwriting the production webhook. Use GET /api/telegram/setup to " +
      "register a dev webhook manually if needed.",
    );
    return;
  }

  // In production: register using the clean domain (prefer barberuz.replit.app
  // over any sisko.replit.dev entry that Replit may include in REPLIT_DOMAINS).
  setTimeout(async () => {
    const domain = pickProdDomain();
    const webhookUrl = `https://${domain}/api/telegram/webhook`;
    console.log(`[TelegramBot] Registering webhook: ${webhookUrl}`);
    await registerWebhook(webhookUrl);
  }, 3000);
});
