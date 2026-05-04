import { Router } from "express";
import { handleTelegramUpdate, registerWebhook, getWebhookInfo, isBotConfigured } from "../lib/telegram-bot";

const router = Router();

/**
 * POST /api/telegram/webhook
 * Telegram sends all bot updates here.
 */
router.post("/webhook", async (req, res) => {
  try {
    await handleTelegramUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TelegramBot] Webhook handler error:", err);
    res.json({ ok: false });
  }
});

/**
 * GET /api/telegram/setup
 * Call this to register (or re-register) the webhook with Telegram.
 * Also shows current webhook info and bot status.
 */
router.get("/setup", async (req, res) => {
  const configured = isBotConfigured();
  if (!configured) {
    res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not set",
      hint: "Add TELEGRAM_BOT_TOKEN to your environment secrets and restart the server.",
    });
    return;
  }

  // Build webhook URL from request headers or env
  const host = req.headers["x-forwarded-host"] || req.hostname;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = (process.env.NODE_ENV === "development" && process.env.REPLIT_DEV_DOMAIN)
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : `${proto}://${host}`;

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const registerResult = await registerWebhook(webhookUrl);
  const webhookInfo = await getWebhookInfo();

  res.json({
    ok: true,
    botConfigured: configured,
    webhookUrl,
    registerResult,
    currentWebhookInfo: webhookInfo,
  });
});

/**
 * GET /api/telegram/status
 * Quick health check — shows whether the bot token is configured.
 */
router.get("/status", (_req, res) => {
  res.json({ botConfigured: isBotConfigured() });
});

export default router;
