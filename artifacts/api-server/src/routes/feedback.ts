import { Router } from "express";
import { authenticate, getUser } from "../lib/auth";
import { feedbackDestination } from "../lib/feedback-destination";

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

function telegramErrorText(description: string): string {
  const text = description.toLowerCase();
  if (text.includes("chat not found") || text.includes("bot was blocked") || text.includes("user is deactivated")) {
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

router.get("/setup", async (_req, res) => {
  const { token, chatId } = feedbackDestination();
  const report: Record<string, unknown> = {
    hasToken: Boolean(token),
    hasChat: Boolean(chatId),
  };
  if (!token) {
    res.json(report);
    return;
  }
  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()) as { ok?: boolean; description?: string };
    report.tokenOk = Boolean(me.ok);
    if (!me.ok) report.tokenError = (me.description || "rejected").slice(0, 160);
    if (me.ok && chatId) {
      const chat = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      }).then((r) => r.json()) as { ok?: boolean; description?: string };
      report.chatOk = Boolean(chat.ok);
      if (!chat.ok) report.chatError = (chat.description || "rejected").slice(0, 160);
      if (chat.ok && _req.query.send === "1") {
        const sent = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "Sinov. Feedback xabarlari endi shu yerga keladi." }),
        }).then((r) => r.json()) as { ok?: boolean; description?: string };
        report.sent = Boolean(sent.ok);
        if (!sent.ok) report.sendError = (sent.description || "rejected").slice(0, 160);
      }
    }
  } catch {
    report.network = true;
  }
  res.json(report);
});

// POST /api/feedback
router.post("/", authenticate, async (req, res) => {
  const user = getUser(req);
  const { text, category } = req.body as { text?: string; category?: string };

  if (!text || !text.trim()) {
    res.status(400).json({ error: "bad_request", message: "text is required" });
    return;
  }

  const { token: botToken, chatId } = feedbackDestination();

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
        message: telegramErrorText(description),
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
