import app from "./app";
import { registerWebhook } from "./lib/telegram-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);

  // Register Telegram bot webhook if token and public domain are set
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (process.env.TELEGRAM_BOT_TOKEN && domains) {
    const webhookUrl = `https://${domains}/api/telegram/webhook`;
    await registerWebhook(webhookUrl);
  }
});
