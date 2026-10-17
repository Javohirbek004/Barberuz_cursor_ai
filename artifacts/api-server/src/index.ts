import "./load-env";
import app from "./app";
import { registerWebhook, isBotConfigured, startDevPolling } from "./lib/telegram-bot";
import { startReminderJob } from "./lib/reminders";
import { normalizeStoredClientPhones } from "./lib/phone-migration";
import { moveSlugToProfileName } from "./lib/public-slug";
import { assertAuthSecrets } from "./lib/auth";

assertAuthSecrets();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Telegram webhook must hit the live API (Render), not the old Replit host.
 * Prefer APP_URL / Render hostname; skip dead Replit domains.
 */
function pickProdDomain(): string {
  if (process.env.APP_URL) {
    try {
      const host = new URL(process.env.APP_URL).hostname;
      if (host && !host.includes("replit")) return host;
    } catch { /* ignore */ }
  }

  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
  if (renderHost) return renderHost;

  const domains = (process.env.REPLIT_DOMAINS || "")
    .split(",")
    .map(d => d.trim())
    .filter(d => d && !d.includes("sisko.replit.dev") && !d.includes("replit."));
  if (domains[0]) return domains[0];

  return "barber-uz-clq6.onrender.com";
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  startReminderJob();

  normalizeStoredClientPhones()
    .then(({ renamed, merged }) => {
      if (renamed || merged) console.log(`[PhoneCleanup] standardised ${renamed} number(s), merged ${merged} duplicate card(s)`);
    })
    .catch((err) => console.error("[PhoneCleanup] failed:", err));

  moveSlugToProfileName("sardor-2000", "Javohir")
    .then((moved) => {
      if (moved) console.log("[PublicSlug] page address is now javohir");
    })
    .catch((err) => console.error("[PublicSlug] rename failed:", err));

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
    startDevPolling();
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
