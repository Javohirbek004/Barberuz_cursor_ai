import { Router } from "express";
import { authenticate } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function uzDateTime(): string {
  return new Date().toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// POST /api/feedback
router.post("/", authenticate, async (req, res) => {
  const userId = (req as any).userId as string;
  const { text, category } = req.body as { text?: string; category?: string };

  if (!text || !text.trim()) {
    res.status(400).json({ error: "bad_request", message: "text is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const botToken = process.env.FEEDBACK_BOT_TOKEN;
  const chatId   = process.env.ADMIN_TELEGRAM_ID;

  if (!botToken || !chatId) {
    console.warn("[Feedback] FEEDBACK_BOT_TOKEN or ADMIN_TELEGRAM_ID not set — skipping Telegram send");
    res.json({ ok: true, sent: false, reason: "bot_not_configured" });
    return;
  }

  const userName  = user.name || user.username || "Noma'lum";
  const userPhone = user.phone ? `+${user.phone}` : "Ko'rsatilmagan";
  const catLabel  = category || "💡 Taklif";
  const time      = uzDateTime();

  const message = [
    "📩 Yangi fikr",
    "",
    `👤 User: ${userName}`,
    `📱 Telefon: ${userPhone}`,
    "",
    `📂 Kategoriya: ${catLabel}`,
    `💬 Matn:`,
    `"${text.trim()}"`,
    "",
    `📅 Vaqt: ${time}`,
  ].join("\n");

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      }
    );

    const tgJson = await tgRes.json() as { ok: boolean };

    if (!tgJson.ok) {
      console.error("[Feedback] Telegram sendMessage failed:", tgJson);
      res.status(502).json({ error: "telegram_error", detail: tgJson });
      return;
    }

    res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[Feedback] Network error sending to Telegram:", err);
    res.status(502).json({ error: "network_error" });
  }
});

export default router;
