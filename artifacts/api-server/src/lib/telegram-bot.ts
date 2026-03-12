import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const APP_URL = process.env.APP_URL || "https://barber.uz";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// In-memory map: Telegram chatId → barber userId (for verification flow)
const pendingVerifications = new Map<number, string>();

async function callTelegram(method: string, body: object) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err);
    return null;
  }
}

async function sendMessage(chatId: number, text: string, extra: object = {}) {
  return callTelegram("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function requestContact(chatId: number, userName: string) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: `Assalomu alaykum, <b>${userName}</b>! Ilovani to'liq foydalanish uchun telefon raqamingizni tasdiqlang.`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

export async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message) return;

  const chatId: number = message.chat.id;
  const text: string = message.text || "";

  // Handle /start command with reg_{userId}_{lang} payload
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const payload = parts[1] || "";

    if (payload.startsWith("reg_")) {
      const segments = payload.split("_");
      // payload format: reg_{uuid}_{lang} but uuid has dashes so we join properly
      // segments[0] = "reg", segments[1..5] = uuid parts, last = lang
      const lang = segments[segments.length - 1];
      const userId = segments.slice(1, segments.length - 1).join("-");

      if (userId) {
        // Check if user exists
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (user) {
          // Store pending verification
          pendingVerifications.set(chatId, userId);
          await requestContact(chatId, user.name);
          return;
        }
      }
    }

    // Generic start
    await sendMessage(chatId, "Assalomu alaykum! Barber.uz botiga xush kelibsiz. 🪒\n\nIlovaga kirish uchun: " + APP_URL);
    return;
  }

  // Handle contact message
  if (message.contact) {
    const contact = message.contact;
    const userId = pendingVerifications.get(chatId);

    if (!userId) {
      await sendMessage(chatId, "❌ Tasdiqlash sessiyasi topilmadi. Iltimos, ilovadan qayta urinib ko'ring.");
      return;
    }

    // Update user in DB: verified + store telegramId and phone
    await db.update(usersTable)
      .set({
        telegramVerified: true,
        telegramId: String(contact.user_id || chatId),
        telegramUsername: message.from?.username || null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    pendingVerifications.delete(chatId);

    // Remove contact keyboard and send confirmation
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Raqam tasdiqlandi! ✅ Endi siz ilovadan to'liq foydalanishingiz mumkin.",
      reply_markup: { remove_keyboard: true },
    });

    // Send link back to app
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Saytga qaytish uchun quyidagi tugmani bosing:",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Barber.uz ga qaytish", url: APP_URL + "/dashboard" }]],
      },
    });

    return;
  }
}

export async function registerWebhook(webhookUrl: string) {
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN not set — bot webhook not registered");
    return;
  }
  const result = await callTelegram("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  console.log("Telegram webhook registered:", result);
}
