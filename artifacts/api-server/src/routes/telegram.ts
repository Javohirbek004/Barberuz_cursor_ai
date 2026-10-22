import { Router } from "express";
import {
  handleTelegramUpdate,
  registerWebhook,
  getWebhookInfo,
  isBotConfigured,
  isWebhookSignatureActive,
} from "../lib/telegram-bot";
import { productionHost, webhookSecretToken } from "../lib/telegram-token";
import { secretsEqual } from "../lib/auth";
import { adminAuth } from "../v1/middleware/adminAuth";

const router = Router();

/**
 * POST /api/telegram/webhook
 * Telegram sends all bot updates here. Once the signed registration is active,
 * anything without Telegram's secret header is a forgery and is refused.
 */
router.post("/webhook", async (req, res) => {
  if (isWebhookSignatureActive()) {
    const sent = req.headers["x-telegram-bot-api-secret-token"];
    const provided = typeof sent === "string" ? sent : "";
    if (!provided || !secretsEqual(provided, webhookSecretToken())) {
      res.status(403).json({ ok: false });
      return;
    }
  }
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
 * Owner-only: needs the X-Admin-Secret header. Registers (or re-registers) the webhook
 * on the server's own address and shows the current webhook info.
 */
router.get("/setup", adminAuth, async (_req, res) => {
  const configured = isBotConfigured();
  if (!configured) {
    res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not set",
      hint: "Add TELEGRAM_BOT_TOKEN to your environment secrets and restart the server.",
    });
    return;
  }

  // The address is never taken from the request, so nobody can point the bot elsewhere.
  const webhookUrl = `https://${productionHost()}/api/telegram/webhook`;
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
