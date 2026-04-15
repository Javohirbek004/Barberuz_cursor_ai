/**
 * Telegram Bot Handler for @Barberuz_yordamchi_bot
 *
 * Deep-link formats:
 *  Registration : https://t.me/Barberuz_yordamchi_bot?start=reg_{uuid}_{lang}
 *  Login        : https://t.me/Barberuz_yordamchi_bot?start=auth_{code}_{lang}
 *
 * Registration flow:
 *  1. /start reg_{uuid}_{lang}  → look up user by uuid → ask phone
 *  2. User shares contact       → set telegramVerified=true, save phone+telegramId
 *  3. Send success + "Ilovaga kirish" button
 *  4. Frontend polls /api/auth/telegram-status/:userId → redirects
 *
 * Login flow:
 *  1. /start auth_{code}_{lang} → look up by telegramId
 *     a) Found  → send inline Yes/No confirmation
 *     b) Not found → ask phone to match by phone in DB
 *  2. callback_query auth_yes_{code} → confirm → generate token → store in pendingLoginResults
 *     callback_query auth_no_{code}  → cancel
 *  3. Contact received (phone lookup) → match by phone → update telegramId → login
 *  4. Frontend polls /api/auth/telegram-login-status/{code} → gets token → redirects
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken } from "./auth";

function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

/**
 * Returns the base URL for the frontend app.
 * Priority: REPLIT_DEV_DOMAIN (always current in Replit dev)
 *           → APP_URL (production override)
 *           → barber.uz (hardcoded production fallback)
 *
 * IMPORTANT: APP_URL can become stale when the Replit workspace domain rotates.
 * REPLIT_DEV_DOMAIN is injected fresh each run, so it always wins in dev.
 */
function getAppUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "https://barber.uz";
}

// ──────────────────────────────────────────────────────────────
// In-memory state maps
// ──────────────────────────────────────────────────────────────

/** Registration: chatId → userId (waiting for contact share) */
const pendingVerifications = new Map<number, string>();

/** Barber member invite: chatId → userId (waiting for contact share) */
const pendingBarberVerifications = new Map<number, string>();

/** Login step 1: chatId → { code, lang, step } */
type AuthStep = "confirm" | "phone";
const pendingAuthLogins = new Map<number, { code: string; lang: string; step: AuthStep }>();

/** Login result: code → { token, userId, expiresAt } (kept 10 min so polling doesn't miss) */
interface LoginResult {
  token: string;
  userId: string;
  expiresAt: number;
}
const pendingLoginResults = new Map<string, LoginResult>();

/** Exported: called by the auth route to check polling */
export function getTelegramLoginResult(code: string): LoginResult | null {
  const result = pendingLoginResults.get(code);
  if (!result) return null;
  if (Date.now() > result.expiresAt) {
    pendingLoginResults.delete(code);
    return null;
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// Telegram API helpers
// ──────────────────────────────────────────────────────────────

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const token = getToken();
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is not set");
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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
// Message senders — Registration flow
// ──────────────────────────────────────────────────────────────

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

async function sendVerificationSuccess(chatId: number, userId: string, token: string) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Raqam tasdiqlandi! \u2705 Quyidagi tugmani bosib ilovaga kiring:",
    reply_markup: { remove_keyboard: true },
  });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Profilingizga o\u02BBtish uchun tugmani bosing:",
    reply_markup: {
      inline_keyboard: [
        [{ text: "\uD83C\uDF10 Ilovaga kirish", url: `${getAppUrl()}/verify-telegram?uid=${userId}&token=${token}` }],
      ],
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Message senders — Login/Auth flow
// ──────────────────────────────────────────────────────────────

async function sendAuthConfirmation(chatId: number, userName: string, lang: string, code: string) {
  const isUz = lang !== "ru";
  const text = isUz
    ? `<b>${userName}</b>, Barber.uz tizimiga kirishni tasdiqlaysizmi?`
    : `<b>${userName}</b>, Вы подтверждаете вход в систему Barber.uz?`;
  const yesText = isUz ? "✅ Ha, kirish" : "✅ Да, войти";
  const noText  = isUz ? "❌ Yo'q" : "❌ Нет";

  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: yesText, callback_data: `auth_yes_${code}` },
          { text: noText,  callback_data: `auth_no_${code}` },
        ],
      ],
    },
  });
}

async function sendAuthPhoneRequest(chatId: number, lang: string) {
  const isUz = lang !== "ru";
  const text = isUz
    ? "Hisobingizni topish uchun telefon raqamingizni yuboring:"
    : "Для поиска вашего аккаунта отправьте номер телефона:";
  const btnText = isUz ? "\uD83D\uDCF1 Raqamni yuborish" : "\uD83D\uDCF1 Отправить номер";

  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      keyboard: [[{ text: btnText, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendLoginSuccess(chatId: number, lang: string, code: string) {
  const isUz = lang !== "ru";
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz
      ? "Muvaffaqiyatli! \u2705 Brauzeringizga qayting \u2014 sahifa avtomatik ochiladi."
      : "Успешно! \u2705 Вернитесь в браузер \u2014 страница откроется автоматически.",
    reply_markup: { remove_keyboard: true },
  });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz ? "Yoki quyidagi tugmani bosing:" : "Или нажмите кнопку ниже:",
    reply_markup: {
      inline_keyboard: [
        [{ text: isUz ? "\uD83C\uDF10 Ilovaga kirish" : "\uD83C\uDF10 Открыть приложение", url: `${getAppUrl()}/login?tg_code=${code}` }],
      ],
    },
  });
}

async function sendLoginCancelled(chatId: number, lang: string) {
  const isUz = lang !== "ru";
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz ? "Kirish bekor qilindi." : "Вход отменён.",
    reply_markup: { remove_keyboard: true },
  });
}

async function sendNotRegistered(chatId: number, lang: string) {
  const isUz = lang !== "ru";
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz
      ? "Bu raqam bilan hisob topilmadi. Iltimos, ilovadan ro\u02BByxatdan o\u02BBting:"
      : "Аккаунт с этим номером не найден. Пожалуйста, зарегистрируйтесь в приложении:",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: isUz ? "\uD83D\uDD17 Ro\u02BByxatdan o\u02BBtish" : "\uD83D\uDD17 Зарегистрироваться", url: `${getAppUrl()}/register` }],
      ],
    },
  });
}

async function sendGenericWelcome(chatId: number) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: "👋 Salom!\n\nIltimos, barber_uz ilovasidan berilgan maxsus link orqali kiring",
    reply_markup: { remove_keyboard: true },
  });
}

async function sendBarberMemberContactRequest(
  chatId: number,
  barberName: string,
  shopName: string,
) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: `👋 Salom, <b>${barberName}</b>!\n\nSiz <b>${shopName}</b> jamoasiga qo'shilyapsiz ✂️\n\n📲 Xabarlarni shu yerda olasiz:\n• Yangi bronlar\n• Bekor qilishlar\n• Eslatmalar\n\nXabarlarni olish uchun telefon raqamingizni tasdiqlang👇`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "📱 Telefon raqamni yuborish", request_contact: true }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendBarberMemberSuccess(chatId: number, _userId: string) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "✅ Muvaffaqiyatli ulandingiz!\n\nEndi barcha bronlar sizga shu yerga keladi 🔔",
    reply_markup: { remove_keyboard: true },
  });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "👇",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Ilovaga qaytish", web_app: { url: `${getAppUrl()}/dashboard` } }],
      ],
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Payload parsers
// ──────────────────────────────────────────────────────────────

function parseRegPayload(payload: string): { userId: string; lang: string } | null {
  const match = payload.match(
    /^reg_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(uz|ru)$/i,
  );
  if (!match) return null;
  return { userId: match[1]!.toLowerCase(), lang: match[2]! };
}

function parseAuthPayload(payload: string): { code: string; lang: string } | null {
  // auth_{16-char hex code}_{lang}
  const match = payload.match(/^auth_([a-f0-9]{12,32})_(uz|ru)$/i);
  if (!match) return null;
  return { code: match[1]!, lang: match[2]! };
}

function parseBarberPayload(payload: string): { userId: string } | null {
  const match = payload.match(/^barber_([a-z0-9_-]+)$/i);
  if (!match) return null;
  return { userId: match[1]!.toLowerCase() };
}

// ──────────────────────────────────────────────────────────────
// Main update handler
// ──────────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: unknown) {
  const upd = update as Record<string, unknown>;

  // ── callback_query (inline button presses) ──────────────────
  const callbackQuery = upd.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    await handleCallbackQuery(callbackQuery);
    return;
  }

  const message = upd.message as Record<string, unknown> | undefined;
  if (!message) return;

  const chatId = (message.chat as Record<string, unknown>).id as number;
  const text   = (message.text as string) || "";
  const from   = message.from as Record<string, unknown> | undefined;

  console.log(`[TelegramBot] Update from chatId=${chatId} text="${text.slice(0, 80)}"`);

  // ── /start ──────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const payload = text.split(" ")[1]?.trim() || "";

    // Registration deep-link
    const regParsed = parseRegPayload(payload);
    if (regParsed) {
      await handleRegStart(chatId, regParsed.userId, regParsed.lang);
      return;
    }

    // Login/auth deep-link
    const authParsed = parseAuthPayload(payload);
    if (authParsed) {
      await handleAuthStart(chatId, authParsed.code, authParsed.lang);
      return;
    }

    // Barber member invite deep-link
    const barberParsed = parseBarberPayload(payload);
    if (barberParsed) {
      await handleBarberStart(chatId, barberParsed.userId);
      return;
    }

    // Generic welcome
    await sendGenericWelcome(chatId);
    return;
  }

  // ── Contact shared ──────────────────────────────────────────
  if (message.contact) {
    const contact  = message.contact as Record<string, unknown>;
    const phone    = (contact.phone_number as string) || null;
    const tgUserId = String((contact.user_id as number) || chatId);
    const tgUsername = (from?.username as string) || null;

    // Check if this is a login flow (auth pending)
    const authPending = pendingAuthLogins.get(chatId);
    if (authPending && authPending.step === "phone") {
      await handleAuthPhoneContact(chatId, authPending, phone, tgUserId, tgUsername);
      return;
    }

    // Check if this is a barber member invite flow
    if (pendingBarberVerifications.has(chatId)) {
      await handleBarberContact(chatId, phone, tgUserId, tgUsername);
      return;
    }

    // Otherwise it's the registration verification flow
    await handleRegContact(chatId, phone, tgUserId, tgUsername);
  }
}

// ──────────────────────────────────────────────────────────────
// Sub-handlers
// ──────────────────────────────────────────────────────────────

async function handleRegStart(chatId: number, userId: string, _lang: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    console.warn(`[TelegramBot] Reg: user not found userId=${userId}`);
    await sendGenericWelcome(chatId);
    return;
  }

  if (user.telegramVerified) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Siz allaqachon tasdiqlangansiz! \u2705",
      reply_markup: {
        inline_keyboard: [[{ text: "\uD83C\uDF10 Ilovaga kirish", url: `${getAppUrl()}/login` }]],
      },
    });
    return;
  }

  pendingVerifications.set(chatId, userId);
  console.log(`[TelegramBot] Reg: pending chatId=${chatId} → userId=${userId}`);
  await sendContactRequest(chatId, user.name);
}

async function handleBarberStart(chatId: number, userId: string) {
  let user: typeof usersTable.$inferSelect | undefined;
  try {
    [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  } catch {
    console.warn(`[TelegramBot] Barber: DB lookup failed (non-UUID token?) userId=${userId}, sending fallback`);
  }
  if (!user) {
    console.warn(`[TelegramBot] Barber: user not found userId=${userId}, sending fallback onboarding`);
    const nameSlug = userId.split("_")[0] || "barber";
    const fallbackName = nameSlug.charAt(0).toUpperCase() + nameSlug.slice(1);
    pendingBarberVerifications.set(chatId, userId);
    await sendBarberMemberContactRequest(chatId, fallbackName, "Barbershop");
    return;
  }

  if (user.telegramVerified) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "✅ Siz allaqachon ulanganmiz!\n\nEndi barcha bronlar sizga shu yerga keladi 🔔",
      reply_markup: {
        inline_keyboard: [[{ text: "Ilovaga qaytish", url: `${getAppUrl()}/dashboard` }]],
      },
    });
    return;
  }

  const shopName = user.brandName || "Barbershop";
  pendingBarberVerifications.set(chatId, userId);
  console.log(`[TelegramBot] Barber invite: pending chatId=${chatId} → userId=${userId}`);
  await sendBarberMemberContactRequest(chatId, user.name, shopName);
}

async function handleBarberContact(
  chatId: number,
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  const userId = pendingBarberVerifications.get(chatId);
  if (!userId) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Tasdiqlash sessiyasi topilmadi. Iltimos, ilovadan qayta harakat qiling.",
    });
    return;
  }

  console.log(`[TelegramBot] Barber contact: chatId=${chatId} userId=${userId} phone=${phone}`);

  try {
    await db.update(usersTable).set({
      telegramVerified: true,
      telegramId: tgUserId,
      telegramUsername: tgUsername,
      phone: phone || undefined,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));
    console.log(`[TelegramBot] Barber invite verified: userId=${userId} ✅`);
  } catch (err) {
    console.warn(`[TelegramBot] Barber DB update skipped (non-UUID userId): userId=${userId}`, (err as Error).message);
  }

  pendingBarberVerifications.delete(chatId);
  await sendBarberMemberSuccess(chatId, userId);
}

async function handleAuthStart(chatId: number, code: string, lang: string) {
  console.log(`[TelegramBot] Auth start: chatId=${chatId} code=${code} lang=${lang}`);

  // Look up by Telegram ID
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, String(chatId)))
    .limit(1);

  if (user) {
    // Found — send confirmation inline keyboard
    pendingAuthLogins.set(chatId, { code, lang, step: "confirm" });
    await sendAuthConfirmation(chatId, user.name, lang, code);
    return;
  }

  // Not found by telegramId — try to match by phone
  pendingAuthLogins.set(chatId, { code, lang, step: "phone" });
  await sendAuthPhoneRequest(chatId, lang);
}

async function handleCallbackQuery(callbackQuery: Record<string, unknown>) {
  const callbackData = (callbackQuery.data as string) || "";
  const from         = callbackQuery.from as Record<string, unknown>;
  const callbackId   = callbackQuery.id as string;
  const chatId       = from.id as number;

  // Always answer the callback to remove the loading spinner
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackId });

  if (callbackData.startsWith("auth_yes_")) {
    const code    = callbackData.slice("auth_yes_".length);
    const pending = pendingAuthLogins.get(chatId);

    // Verify the code matches what we stored for this chatId
    if (!pending || pending.code !== code) {
      console.warn(`[TelegramBot] auth_yes: code mismatch for chatId=${chatId}`);
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, String(chatId)))
      .limit(1);

    if (!user) {
      console.warn(`[TelegramBot] auth_yes: user not found for chatId=${chatId}`);
      return;
    }

    const token = generateToken(user.id);
    pendingLoginResults.set(code, {
      token,
      userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    pendingAuthLogins.delete(chatId);

    console.log(`[TelegramBot] Auth confirmed: userId=${user.id} code=${code}`);
    await sendLoginSuccess(chatId, pending.lang, code);
    return;
  }

  if (callbackData.startsWith("auth_no_")) {
    const code    = callbackData.slice("auth_no_".length);
    const pending = pendingAuthLogins.get(chatId);
    const lang    = pending?.lang || "uz";
    pendingAuthLogins.delete(chatId);
    console.log(`[TelegramBot] Auth cancelled: chatId=${chatId} code=${code}`);
    await sendLoginCancelled(chatId, lang);
  }
}

async function handleAuthPhoneContact(
  chatId: number,
  pending: { code: string; lang: string; step: AuthStep },
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  if (!phone) {
    console.warn(`[TelegramBot] Auth phone: no phone for chatId=${chatId}`);
    return;
  }

  // Normalise phone for matching (strip leading + or spaces)
  const normPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1)
    .catch(() => [] as typeof usersTable.$inferSelect[]);

  // Also try without leading +
  const [userAlt] = !user
    ? await db.select().from(usersTable).where(eq(usersTable.phone, `+${normPhone}`)).limit(1)
    : [];

  const foundUser = user || userAlt;

  if (!foundUser) {
    console.warn(`[TelegramBot] Auth phone: no user for phone=${phone}`);
    pendingAuthLogins.delete(chatId);
    await sendNotRegistered(chatId, pending.lang);
    return;
  }

  // Update telegramId so future logins by Telegram ID work
  await db.update(usersTable).set({
    telegramId: tgUserId,
    telegramUsername: tgUsername,
    phone,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, foundUser.id));

  const token = generateToken(foundUser.id);
  pendingLoginResults.set(pending.code, {
    token,
    userId: foundUser.id,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  pendingAuthLogins.delete(chatId);

  console.log(`[TelegramBot] Auth by phone: userId=${foundUser.id} code=${pending.code}`);
  await sendLoginSuccess(chatId, pending.lang, pending.code);
}

async function handleRegContact(
  chatId: number,
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  const userId = pendingVerifications.get(chatId);
  if (!userId) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Tasdiqlash sessiyasi topilmadi. Iltimos, ilovadan qayta harakat qiling.",
    });
    return;
  }

  console.log(`[TelegramBot] Reg contact: chatId=${chatId} userId=${userId} phone=${phone}`);

  try {
    await db.update(usersTable).set({
      telegramVerified: true,
      telegramId: tgUserId,
      telegramUsername: tgUsername,
      phone: phone || undefined,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    pendingVerifications.delete(chatId);
    console.log(`[TelegramBot] Reg verified: userId=${userId} ✅`);
    const loginToken = generateToken(userId);
    await sendVerificationSuccess(chatId, userId, loginToken);
  } catch (err) {
    console.error("[TelegramBot] DB update failed:", err);
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Xatolik yuz berdi. Iltimos, qayta harakat qiling.",
    });
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
    allowed_updates: ["message", "callback_query"],
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
