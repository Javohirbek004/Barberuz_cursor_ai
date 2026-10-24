import { Router } from "express";
import { authenticate, getUser } from "../lib/auth";
import { resolveFeedbackBot } from "../lib/feedback-destination";

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

function telegramErrorText(description: string, botUsername: string): string {
  const text = description.toLowerCase();
  const bot = botUsername ? `@${botUsername}` : "feedback botini";
  if (text.includes("bot was blocked")) {
    return `Xabar ketmadi. ${bot} sizda bloklangan. Chat ochiq bo'lsa ham, bot profilida "Blokdan chiqarish" ni bosing, keyin Start.`;
  }
  if (text.includes("chat not found") || text.includes("user is deactivated")) {
    return "Xabar ketmadi. Feedback botini ochib Start ni bosing, keyin qayta yuboring.";
  }
  if (text.includes("unauthorized") || text.includes("token")) {
    return "Xabar ketmadi. Bot kaliti noto'g'ri saqlangan.";
  }
  if (text.includes("can't send messages to bots") || text.includes("bots can't")) {
    return "Xabar ketmadi. Yozilgan raqam botning o'zi. Sizning shaxsiy Telegram raqamingiz kerak.";
  }
  return "Yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.";
}

router.get("/who", async (_req, res) => {
  const resolved = await resolveFeedbackBot();
  res.json({
    wanted: resolved.wanted,
    chosen: resolved.username,
    found: resolved.found,
    hasChat: Boolean(resolved.chatId),
  });
});

// POST /api/feedback
router.post("/", authenticate, async (req, res) => {
  const user = getUser(req);
  const { text, category } = req.body as { text?: string; category?: string };

  if (!text || !text.trim()) {
    res.status(400).json({ error: "bad_request", message: "text is required" });
    return;
  }

  const resolved = await resolveFeedbackBot();
  const botToken = resolved.token;
  const chatId = resolved.chatId;
  const botUsername = resolved.username;

  if (!botToken || !chatId) {
    console.warn("[Feedback] Bot token or destination chat is missing — message was not sent");
    res.status(503).json({
      ok: false,
      sent: false,
      error: "bot_not_configured",
      message: "Xabar ketmadi. Server feedback botini ko'rmayapti.",
    });
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
      const description = typeof (tgJson as { description?: unknown }).description === "string"
        ? (tgJson as { description: string }).description
        : "";
      console.error("[Feedback] Telegram sendMessage failed:", description || "rejected");
      res.status(502).json({
        error: "telegram_error",
        message: telegramErrorText(description, botUsername),
      });
      return;
    }

    res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[Feedback] Network error sending to Telegram:", err);
    res.status(502).json({ error: "network_error" });
  }
});

export default router;
