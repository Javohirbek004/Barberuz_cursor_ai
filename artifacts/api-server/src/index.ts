import "./load-env";
import app from "./app";
import { registerWebhook, isBotConfigured, startDevPolling } from "./lib/telegram-bot";
import { productionHost, shouldPollTelegram, shouldRegisterTelegramWebhook } from "./lib/telegram-token";
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
    if (shouldRegisterTelegramWebhook()) {
      console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN is not set on this server.");
    } else {
      console.warn(
        "[TelegramBot] Local test bot is off. Production bot stays on Render. " +
        "Set TELEGRAM_BOT_TOKEN_TEST to use a separate test bot locally.",
      );
    }
    return;
  }

  // Local: poll only a TEST bot. Never getUpdates on the live token.
  if (shouldPollTelegram()) {
    startDevPolling();
    return;
  }

  if (!shouldRegisterTelegramWebhook()) return;

  setTimeout(async () => {
    const domain = productionHost();
    const webhookUrl = `https://${domain}/api/telegram/webhook`;
    console.log(`[TelegramBot] Registering webhook: ${webhookUrl}`);
    await registerWebhook(webhookUrl);
  }, 3000);
});
