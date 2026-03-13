import app from "./app";
import { registerWebhook, isBotConfigured } from "./lib/telegram-bot";

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

  if (!isBotConfigured()) {
    console.warn(
      "[TelegramBot] ⚠️  TELEGRAM_BOT_TOKEN is not set. " +
      "Bot will not respond until the secret is added and the server is restarted. " +
      "After adding the token, call GET /api/telegram/setup to register the webhook.",
    );
    return;
  }

  // Delay webhook registration slightly to avoid rate-limit on rapid restarts
  setTimeout(async () => {
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/telegram/webhook`;
      await registerWebhook(webhookUrl);
    } else {
      console.warn(
        "[TelegramBot] Cannot auto-register webhook — REPLIT_DEV_DOMAIN not available. " +
        "Call GET /api/telegram/setup manually.",
      );
    }
  }, 3000);
});
