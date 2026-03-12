import { Router } from "express";
import { handleTelegramUpdate } from "../lib/telegram-bot";

const router = Router();

// Telegram sends POST updates to this endpoint
router.post("/webhook", async (req, res) => {
  try {
    await handleTelegramUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    res.json({ ok: false });
  }
});

export default router;
