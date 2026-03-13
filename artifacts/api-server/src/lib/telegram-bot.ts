/**
 * Telegram Bot Handler for @Barberuz_yordamchi_bot
 *
 * Deep-link format: https://t.me/Barberuz_yordamchi_bot?start=reg_{uuid}_{lang}
 *   uuid = standard UUID-v4 (hex + dashes, 36 chars)
 *   lang = "uz" | "ru"
 *
 * Flow:
 *  1. User clicks deep link → /start reg_{uuid}_{lang}
 *  2. Bot looks up user by UUID, stores chatId → userId in memory
 *  3. Bot sends greeting + ReplyKeyboard with "📱 Raqamni yuborish"
 *  4. User shares contact → bot updates telegramVerified = true in DB
 *  5. Bot sends confirmation + inline "🌐 Ilovaga kirish" button
 *  6. Frontend polls /api/auth/telegram-status/:userId every 3 s → redirects
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// BOT_TOKEN is read lazily so it works even if the env var is injected
// after the module is first imported (e.g. dotenv loaded late).
function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function getTelegramApi(): string {
  const token = getToken();
  return `https://api.telegram.org/bot${token}`;
}

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://barber.uz";
}

// In-memory map: Telegram chatId → barber userId (lives for the session)
const pendingVerifications = new Map<number, string>();

// ──────────────────────────────────────────────────────────────
// Telegram API helpers
// ──────────────────────────────────────────────────────────────

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const token = getToken();
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is not set — cannot call API");
    return null;
  }
  try {
    const res = await fetch(`${getTelegramApi()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`[TelegramBot] ${method} failed:`, JSON.stringify(json));
    }
    return json;
  } catch (err) {
    console.error(`[TelegramBot] Network error calling ${method}:`, err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Message senders
// ──────────────────────────────────────────────────────────────

/** Send greeting (with user's name) + ReplyKeyboard with contact-request button */
async function sendContactRequest(chatId: number, userName: string) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: `Assalomu alaykum, <b>${userName}</b>! Ilovani to\u02BBliq foydalanish uchun telefon raqamingizni tasdiqlang.`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "\uD83D\uDCF1 Raqamni yuborish", request_contact: true }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Send confirmation + remove keyboard + inline "Open app" button */
async function sendVerificationSuccess(chatId: number) {
  // Step 1: confirmation with keyboard removal
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Raqam tasdiqlandi! \u2705 Endi siz ilovadan to\u02BBliq foydalanishingiz mumkin.",
    reply_markup: { remove_keyboard: true },
  });

  // Step 2: inline button back to dashboard
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Ilovaga qaytish:",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "\uD83C\uDF10 Ilovaga kirish",
            url: `${getAppUrl()}/dashboard`,
          },
        ],
      ],
    },
  });
}

/** Generic /start without a valid deep-link payload */
async function sendGenericWelcome(chatId: number) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Assalomu alaykum! Barber.uz botiga xush kelibsiz. \uD83E\uDE92\n\nRo\u02BByxatdan o\u02BBtish uchun ilovani oching:",
    reply_markup: {
      inline_keyboard: [
        [{ text: "\uD83C\uDF10 Barber.uz", url: getAppUrl() }],
      ],
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Start payload parser
// ──────────────────────────────────────────────────────────────

/**
 * Parse "reg_{uuid}_{lang}" from the /start deep-link parameter.
 * UUID is standard format: 8-4-4-4-12 hex chars with dashes.
 * Lang is 2-letter code (uz|ru).
 */
function parseStartPayload(
  payload: string,
): { userId: string; lang: string } | null {
  // UUID-v4 regex: 8-4-4-4-12 hex groups separated by dashes
  const match = payload.match(
    /^reg_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(uz|ru)$/i,
  );
  if (!match) return null;
  return { userId: match[1]!.toLowerCase(), lang: match[2]! };
}

// ──────────────────────────────────────────────────────────────
// Main update handler
// ──────────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: unknown) {
  const upd = update as Record<string, unknown>;
  const message = upd.message as Record<string, unknown> | undefined;
  if (!message) return;

  const chatId = (message.chat as Record<string, unknown>).id as number;
  const text = (message.text as string) || "";
  const from = message.from as Record<string, unknown> | undefined;

  console.log(`[TelegramBot] Update from chatId=${chatId} text="${text.slice(0, 80)}"`);

  // ── /start ──────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const payload = parts[1]?.trim() || "";
    const parsed = parseStartPayload(payload);

    if (parsed) {
      const { userId } = parsed;
      console.log(`[TelegramBot] Deep-link: userId=${userId} lang=${parsed.lang}`);

      // Look up user
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (user) {
        if (user.telegramVerified) {
          // Already verified — just send the link
          await callTelegram("sendMessage", {
            chat_id: chatId,
            text: "Siz allaqachon tasdiqlangansiz! \u2705",
            reply_markup: {
              inline_keyboard: [
                [{ text: "\uD83C\uDF10 Ilovaga kirish", url: `${getAppUrl()}/dashboard` }],
              ],
            },
          });
          return;
        }

        // Store pending verification
        pendingVerifications.set(chatId, userId);
        console.log(`[TelegramBot] Stored pending verification chatId=${chatId} → userId=${userId}`);
        await sendContactRequest(chatId, user.name);
        return;
      }

      console.warn(`[TelegramBot] User not found: userId=${userId}`);
    }

    // Fallback generic welcome
    await sendGenericWelcome(chatId);
    return;
  }

  // ── Contact shared ──────────────────────────────────────────
  if (message.contact) {
    const contact = message.contact as Record<string, unknown>;
    const userId = pendingVerifications.get(chatId);

    if (!userId) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "Tasdiqlash sessiyasi topilmadi. Iltimos, ilovadan qayta harakat qiling.",
      });
      return;
    }

    const phoneNumber = (contact.phone_number as string) || null;
    const telegramUserId = String(
      (contact.user_id as number) || chatId,
    );
    const telegramUsername = (from?.username as string) || null;

    console.log(
      `[TelegramBot] Contact received: chatId=${chatId} userId=${userId} phone=${phoneNumber}`,
    );

    try {
      await db
        .update(usersTable)
        .set({
          telegramVerified: true,
          telegramId: telegramUserId,
          telegramUsername,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      pendingVerifications.delete(chatId);
      console.log(`[TelegramBot] Verified userId=${userId} ✅`);

      await sendVerificationSuccess(chatId);
    } catch (err) {
      console.error("[TelegramBot] DB update failed:", err);
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "Xatolik yuz berdi. Iltimos, qayta harakat qiling.",
      });
    }

    return;
  }
}

// ──────────────────────────────────────────────────────────────
// Webhook management
// ──────────────────────────────────────────────────────────────

export async function registerWebhook(webhookUrl: string) {
  const token = getToken();
  if (!token) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN is not set — webhook not registered");
    return { ok: false, description: "Token missing" };
  }

  console.log(`[TelegramBot] Registering webhook: ${webhookUrl}`);
  const result = await callTelegram("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  console.log("[TelegramBot] setWebhook result:", JSON.stringify(result));
  return result;
}

export async function getWebhookInfo() {
  const token = getToken();
  if (!token) return { ok: false, description: "Token missing" };
  return callTelegram("getWebhookInfo", {});
}

export function isBotConfigured(): boolean {
  return !!getToken();
}
