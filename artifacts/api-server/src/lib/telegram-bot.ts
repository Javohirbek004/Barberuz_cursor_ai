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

import { randomBytes } from "crypto";
import { db, usersTable, bookingSessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
const pendingBarberVerifications = new Map<number, { userId: string; name: string; shopName: string }>();

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

/** Secure login tokens: token → { userId, expiresAt } — single use, 5 min */
const loginTokens = new Map<string, { userId: string; expiresAt: number }>();

/** No-payload /start: chatId waiting for contact share to link account by phone */
const pendingPhoneLogins = new Map<number, true>();

/** Called by auth route to store a secure login token before sending deep link */
export function storeLoginToken(token: string, userId: string, ttlMs = 5 * 60 * 1000) {
  loginTokens.set(token, { userId, expiresAt: Date.now() + ttlMs });
}

function consumeLoginToken(token: string): string | null {
  const entry = loginTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { loginTokens.delete(token); return null; }
  loginTokens.delete(token); // single use
  return entry.userId;
}

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
    const json = await res.json() as Record<string, unknown>;
    if (!json["ok"]) {
      console.error(`[TelegramBot] ${method} failed:`, JSON.stringify(json));
    }
    return json;
  } catch (err) {
    console.error(`[TelegramBot] Network error calling ${method}:`, err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// URL validation + Debug logging
// ──────────────────────────────────────────────────────────────

function validateAppUrl(url: string): boolean {
  if (!url || !url.startsWith("https://")) return false;
  try { new URL(url); return true; } catch { return false; }
}

function buildProfileUrl(authToken: string): string {
  const base = getAppUrl();
  // Points to /login so the Login page can read ?authToken= and auto-sign in
  const url = `${base}/barber-uz/login?authToken=${encodeURIComponent(authToken)}`;
  return validateAppUrl(url) ? url : "";
}

type LogAction =
  | "reg_start" | "reg_contact" | "reg_verified"
  | "login_start" | "login_success" | "login_cancelled"
  | "login_token_expired"
  | "barber_invite_start" | "barber_invite_verified"
  | "booking_start" | "booking_confirmed"
  | "barber_notified" | "barber_no_telegram"
  | "notification_already_sent"
  | "cancel_confirm_prompt" | "booking_cancelled"
  | "cancel_client_notified"
  | "reminder_sent";

function log(
  action: LogAction,
  ctx: Partial<{
    chatId: number;
    telegramUserId: string;
    barberId: string;
    bookingId: string;
    sessionId: string;
    userId: string;
    url: string;
    phone: string;
    error: string;
  }>,
) {
  console.log(`[Bot:${action}]`, JSON.stringify(ctx));
}

// ──────────────────────────────────────────────────────────────
// Message senders — Registration flow
// ──────────────────────────────────────────────────────────────

async function sendContactRequest(chatId: number, userName: string) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      `Assalomu alaykum, ${userName}! \uD83D\uDC4B\n` +
      `Men sizning shaxsiy yordamchingizman.\n\n` +
      `Endi mijozlaringiz yozilsa sizga darhol xabar beraman.\n\n` +
      `\uD83D\uDCF2 Ilovadan to\u02BBliq foydalanish uchun raqamingizni tasdiqlang:`,
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
  const profileUrl = buildProfileUrl(token);
  if (!profileUrl) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Xatolik yuz berdi. Iltimos, ilovaga qo\u02BBlda kiring.",
      reply_markup: { remove_keyboard: true },
    });
    log("reg_verified", { chatId, userId, error: "invalid_url" });
    return;
  }
  log("reg_verified", { chatId, userId, url: profileUrl });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Raqamingiz tasdiqlandi! \u2705\nProfilingizga o\u02BBtish uchun quyidagi linkni bosing:",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: "\uD83C\uDF10 Ilovaga kirish", url: profileUrl }],
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

async function sendLoginSuccess(
  chatId: number,
  _lang: string,
  _code: string,
  token: string,
  firstName: string,
) {
  const profileUrl = buildProfileUrl(token);
  if (!profileUrl) {
    log("login_success", { chatId, error: "invalid_url" });
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Xatolik yuz berdi. Iltimos, ilovaga qo\u02BBlda kiring.",
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  log("login_success", { chatId, url: profileUrl });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      `Assalomu alaykum, <b>${firstName}</b>! \uD83D\uDC4B\n\n` +
      `Sahifangizga kirish tasdiqlandi! \u2705\n` +
      `Profilingizga o\u02BBtish uchun quyidagi tugmani bosing:`,
    parse_mode: "HTML",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: "\uD83C\uDF10 Sahifaga qaytish", url: profileUrl }],
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

async function sendBarberMemberSuccess(chatId: number, userId: string, name: string, shopName: string) {
  const autoLoginUrl = `${getAppUrl()}/barber-uz/barber-setup/${userId}?auto=1&n=${encodeURIComponent(name)}&s=${encodeURIComponent(shopName)}`;
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
        [{ text: "Ilovaga qaytish", url: autoLoginUrl }],
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

function parseLoginPayload(payload: string): { token: string } | null {
  const match = payload.match(/^login_([a-zA-Z0-9_-]{8,128})$/);
  if (!match) return null;
  return { token: match[1]! };
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

    // Secure login deep-link
    const loginParsed = parseLoginPayload(payload);
    if (loginParsed) {
      await handleLoginStart(chatId, loginParsed.token, from);
      return;
    }

    // Barber member invite deep-link
    const barberParsed = parseBarberPayload(payload);
    if (barberParsed) {
      await handleBarberStart(chatId, barberParsed.userId);
      return;
    }

    // Customer booking deep-link
    const bookingParsed = parseBookingPayload(payload);
    if (bookingParsed) {
      await handleBookingStart(chatId, bookingParsed.sessionId, from);
      return;
    }

    // No-payload /start: check if barber is already linked by Telegram ID
    await handleNoPayloadStart(chatId, from);
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

    // No-payload /start flow: look up by phone, link account
    if (pendingPhoneLogins.has(chatId)) {
      await handlePhoneLoginContact(chatId, phone, tgUserId, tgUsername);
      return;
    }

    // Otherwise it's the registration verification flow
    await handleRegContact(chatId, phone, tgUserId, tgUsername);
  }
}

// ──────────────────────────────────────────────────────────────
// Sub-handlers
// ──────────────────────────────────────────────────────────────

async function handleNoPayloadStart(
  chatId: number,
  from: Record<string, unknown> | undefined,
) {
  const firstName = (from?.first_name as string) || "Barber";
  log("reg_start", { chatId, telegramUserId: String(from?.id || chatId) });

  // Check if already linked
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, String(chatId)))
    .limit(1);

  if (user) {
    const loginToken = generateToken(user.id);
    const profileUrl = buildProfileUrl(loginToken);
    log("reg_verified", { chatId, userId: user.id, url: profileUrl || "invalid" });
    if (profileUrl) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: `Xush kelibsiz, <b>${firstName}</b>! \uD83D\uDC4B\nProfilingizga o\u02BBtish uchun quyidagi tugmani bosing:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "\uD83C\uDF10 Ilovaga kirish", url: profileUrl }]],
        },
      });
    } else {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "Xush kelibsiz! Iltimos, ilovaga qo\u02BBlda kiring.",
      });
    }
    return;
  }

  // Not linked — ask for phone
  pendingPhoneLogins.set(chatId, true);
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      `Assalomu alaykum, <b>${firstName}</b>! \uD83D\uDC4B\n\n` +
      `Men sizning shaxsiy yordamchingizman.\n\n` +
      `Endi mijozlaringiz yozilsa sizga darhol xabar beraman.\n\n` +
      `\uD83D\uDCF2 Ilovadan to\u02BBliq foydalanish uchun raqamingizni tasdiqlang:`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [[{ text: "\uD83D\uDCF1 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function handlePhoneLoginContact(
  chatId: number,
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  pendingPhoneLogins.delete(chatId);

  if (!phone) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Telefon raqam olinmadi. Iltimos, qayta urinib ko\u02BBring.",
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  log("reg_contact", { chatId, telegramUserId: tgUserId, phone });

  // Build all phone variants to maximise match rate regardless of storage format
  const noSpaces   = phone.replace(/\s+/g, "");
  const noPlus     = noSpaces.replace(/^\+/, "");
  const withPlus   = `+${noPlus}`;
  const phonesToTry = [...new Set([phone, noSpaces, noPlus, withPlus])];

  let foundUser: typeof usersTable.$inferSelect | undefined;
  for (const variant of phonesToTry) {
    const [match] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, variant))
      .limit(1);
    if (match) { foundUser = match; break; }
  }

  if (!foundUser) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text:
        "Bu raqam bilan hisob topilmadi. \uD83D\uDE4F\n\n" +
        "Iltimos, ilovadan ro\u02BByxatdan o\u02BBting:",
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard: [[{ text: "\uD83D\uDD17 Ro\u02BByxatdan o\u02BBtish", url: `${getAppUrl()}/barber-uz/register` }]],
      },
    });
    return;
  }

  await db.update(usersTable).set({
    telegramVerified: true,
    telegramId: tgUserId,
    telegramUsername: tgUsername,
    phone,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, foundUser.id));

  log("reg_verified", { chatId, userId: foundUser.id, telegramUserId: tgUserId });
  const loginToken = generateToken(foundUser.id);
  await sendVerificationSuccess(chatId, foundUser.id, loginToken);
}

async function handleRegStart(chatId: number, userId: string, _lang: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    console.warn(`[TelegramBot] Reg: user not found userId=${userId}`);
    await sendGenericWelcome(chatId);
    return;
  }

  if (user.telegramVerified) {
    const loginToken = generateToken(user.id);
    const profileUrl = buildProfileUrl(loginToken);
    log("reg_start", { chatId, userId, url: profileUrl || "invalid" });
    if (profileUrl) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "Siz allaqachon tasdiqlangansiz! \u2705\nProfilingizga o\u02BBtish uchun quyidagi tugmani bosing:",
        reply_markup: {
          inline_keyboard: [[{ text: "\uD83C\uDF10 Ilovaga kirish", url: profileUrl }]],
        },
      });
    } else {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "Siz allaqachon tasdiqlangansiz! \u2705 Iltimos, ilovaga qo\u02BBlda kiring.",
      });
    }
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
    pendingBarberVerifications.set(chatId, { userId, name: fallbackName, shopName: "Barbershop" });
    await sendBarberMemberContactRequest(chatId, fallbackName, "Barbershop");
    return;
  }

  if (user.telegramVerified) {
    const loginToken = generateToken(user.id);
    const profileUrl = buildProfileUrl(loginToken);
    log("barber_invite_start", { chatId, userId, url: profileUrl || "invalid" });
    if (profileUrl) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "\u2705 Siz allaqachon ulanganmiz!\n\nEndi barcha bronlar sizga shu yerga keladi \uD83D\uDD14",
        reply_markup: {
          inline_keyboard: [[{ text: "Ilovaga qaytish", url: profileUrl }]],
        },
      });
    } else {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "\u2705 Siz allaqachon ulanganmiz! Iltimos, ilovaga qo\u02BBlda kiring.",
      });
    }
    return;
  }

  const shopName = user.brandName || "Barbershop";
  pendingBarberVerifications.set(chatId, { userId, name: user.name, shopName });
  console.log(`[TelegramBot] Barber invite: pending chatId=${chatId} → userId=${userId}`);
  await sendBarberMemberContactRequest(chatId, user.name, shopName);
}

async function handleBarberContact(
  chatId: number,
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  const pending = pendingBarberVerifications.get(chatId);
  if (!pending) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Tasdiqlash sessiyasi topilmadi. Iltimos, ilovadan qayta harakat qiling.",
    });
    return;
  }

  const { userId, name, shopName } = pending;
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
  await sendBarberMemberSuccess(chatId, userId, name, shopName);
}

async function handleLoginStart(
  chatId: number,
  token: string,
  from: Record<string, unknown> | undefined,
) {
  const firstName = (from?.first_name as string) || "Foydalanuvchi";
  log("login_start", { chatId, telegramUserId: String(from?.id || chatId) });

  const userId = consumeLoginToken(token);
  if (!userId) {
    log("login_token_expired", { chatId });
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Xatolik yuz berdi. Iltimos, ilovaga qo\u02BBlda kiring.",
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Foydalanuvchi topilmadi. Iltimos, qayta urinib ko\u02BBring.",
    });
    return;
  }

  // Backend generates auth token (not bot)
  const authToken = generateToken(user.id);
  const profileUrl = buildProfileUrl(authToken);

  if (!profileUrl) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Xatolik yuz berdi. Iltimos, ilovaga qo\u02BBlda kiring.",
    });
    log("login_success", { chatId, userId, error: "invalid_url" });
    return;
  }

  log("login_success", { chatId, userId, url: profileUrl });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: `Assalomu alaykum, <b>${firstName}</b>! \uD83D\uDC4B\n\nSahifangizga kirish tasdiqlandi! \u2705\nProfilingizga o\u02BBtish uchun quyidagi tugmani bosing:`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "\uD83C\uDF10 Sahifaga qaytish", url: profileUrl }],
      ],
    },
  });
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

    const firstName = (from.first_name as string) || user.name;
    console.log(`[TelegramBot] Auth confirmed: userId=${user.id} code=${code}`);
    await sendLoginSuccess(chatId, pending.lang, code, token, firstName);
    return;
  }

  if (callbackData.startsWith("auth_no_")) {
    const code    = callbackData.slice("auth_no_".length);
    const pending = pendingAuthLogins.get(chatId);
    const lang    = pending?.lang || "uz";
    pendingAuthLogins.delete(chatId);
    console.log(`[TelegramBot] Auth cancelled: chatId=${chatId} code=${code}`);
    await sendLoginCancelled(chatId, lang);
    return;
  }

  if (callbackData.startsWith("book_confirm_")) {
    const sessionId = callbackData.slice("book_confirm_".length);
    const firstName  = (from.first_name as string) || "Mijoz";
    const tgUserId   = String(from.id);
    const tgUsername = (from.username as string) || null;
    log("booking_confirmed", { chatId, telegramUserId: tgUserId, sessionId });
    await confirmBookingSession(chatId, sessionId, tgUserId, firstName, tgUsername);
    return;
  }

  // ── Barber: cancel booking (first click — show confirmation) ────────────
  if (callbackData.startsWith("cancel_booking_")) {
    const sessionId = callbackData.slice("cancel_booking_".length);
    log("cancel_confirm_prompt", { chatId, sessionId, telegramUserId: String(from.id) });
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Bronni bekor qilasizmi?",
      reply_markup: {
        inline_keyboard: [[
          { text: "\u2705 Bekor qilish", callback_data: `confirm_cancel_${sessionId}` },
          { text: "\u21A9\uFE0F Orqaga",  callback_data: `abort_cancel_${sessionId}` },
        ]],
      },
    });
    return;
  }

  // ── Barber: confirmed cancel ─────────────────────────────────────────────
  if (callbackData.startsWith("confirm_cancel_")) {
    const sessionId = callbackData.slice("confirm_cancel_".length);
    await handleConfirmCancel(chatId, sessionId);
    return;
  }

  // ── Barber: aborted cancel ───────────────────────────────────────────────
  if (callbackData.startsWith("abort_cancel_")) {
    await callTelegram("sendMessage", { chat_id: chatId, text: "Bekor qilish to\u02BBxtatildi." });
    return;
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
  await sendLoginSuccess(chatId, pending.lang, pending.code, token, foundUser.name);
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
// Cancel flow handler
// ──────────────────────────────────────────────────────────────

async function handleConfirmCancel(chatId: number, sessionId: string) {
  const [session] = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) {
    await callTelegram("sendMessage", { chat_id: chatId, text: "Bron topilmadi." });
    return;
  }

  let data: BookingData;
  try { data = JSON.parse(session.bookingData) as BookingData; } catch {
    await callTelegram("sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi." });
    return;
  }

  await db
    .update(bookingSessionsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.sessionId, sessionId));

  log("booking_cancelled", {
    sessionId,
    barberId: session.barberId,
    telegramUserId: session.clientTelegramId || undefined,
  });

  await callTelegram("sendMessage", { chat_id: chatId, text: "Bron bekor qilindi \u274C" });

  if (!session.clientTelegramId || session.cancelNotificationSent) return;

  const clientFirstName = session.clientName?.split(" ")[0] || "Mijoz";
  const serviceParam = data.services[0]
    ? `&serviceId=${encodeURIComponent(data.services[0].name)}`
    : "";
  const reBookUrl = `${getAppUrl()}/barber-uz?barberId=${encodeURIComponent(session.barberId)}${serviceParam}`;

  if (!validateAppUrl(reBookUrl)) {
    await callTelegram("sendMessage", {
      chat_id: Number(session.clientTelegramId),
      text: `Uzr, <b>${clientFirstName}</b>! \uD83D\uDE4F\n\nSizning ${formatDateLabel(data.date)}, <b>${data.time}</b> dagi navbatingiz bekor qilindi.\n\nXatolik yuz berdi. Iltimos, ilovaga qo\u02BBlda kiring.`,
      parse_mode: "HTML",
    });
  } else {
    await callTelegram("sendMessage", {
      chat_id: Number(session.clientTelegramId),
      text: `Uzr, <b>${clientFirstName}</b>! \uD83D\uDE4F\n\nSizning ${formatDateLabel(data.date)}, <b>${data.time}</b> dagi navbatingiz bekor qilindi.\n\nQulay boshqa vaqtni tanlash uchun quyidagi tugmani bosing:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "\uD83D\uDCC5 Qayta bron qilish", url: reBookUrl }]],
      },
    });
  }

  await db
    .update(bookingSessionsTable)
    .set({ cancelNotificationSent: true })
    .where(eq(bookingSessionsTable.sessionId, sessionId));

  log("cancel_client_notified", { sessionId, telegramUserId: session.clientTelegramId });
}

// ──────────────────────────────────────────────────────────────
// Barber notification (exported — called when session confirmed)
// ──────────────────────────────────────────────────────────────

export async function sendBarberBookingNotification(
  barberId: string,
  sessionId: string,
  data: BookingData,
  clientName: string,
  clientPhone: string | null,
) {
  const [barber] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, barberId))
    .limit(1);

  if (!barber?.telegramId) {
    log("barber_no_telegram", { barberId, sessionId });
    return;
  }

  const [session] = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.sessionId, sessionId))
    .limit(1);

  if (session?.notificationSent) {
    log("notification_already_sent", { barberId, sessionId });
    return;
  }

  const serviceNames = data.services.map(s => s.name).join(", ");
  const phoneLine = clientPhone ? `\uD83D\uDCDE ${clientPhone}\n` : "";
  const text =
    `\uD83D\uDD14 <b>Yangi bron!</b>\n\n` +
    `\uD83D\uDC64 ${clientName}\n` +
    `${phoneLine}` +
    `\u23F0 ${formatDateLabel(data.date)}, ${data.time}\n` +
    `\u2702\uFE0F ${serviceNames}\n` +
    `\uD83D\uDCB0 ${data.totalPrice.toLocaleString()} so\u02BCm`;

  const buttons: { text: string; callback_data?: string; url?: string }[][] = [];
  const row: { text: string; callback_data?: string; url?: string }[] = [];
  if (clientPhone) {
    const telUrl = `tel:${clientPhone.replace(/[\s\-()]/g, "")}`;
    row.push({ text: "\uD83D\uDCDE Qo\u02BBng\u02BBiroq", url: telUrl });
  }
  row.push({ text: "\u274C Bekor qilish", callback_data: `cancel_booking_${sessionId}` });
  buttons.push(row);

  await callTelegram("sendMessage", {
    chat_id: Number(barber.telegramId),
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });

  await db
    .update(bookingSessionsTable)
    .set({ notificationSent: true })
    .where(eq(bookingSessionsTable.sessionId, sessionId));

  log("barber_notified", {
    barberId,
    sessionId,
    telegramUserId: barber.telegramId,
  });
}

// ──────────────────────────────────────────────────────────────
// Booking flow — customer-facing booking verification
// ──────────────────────────────────────────────────────────────

interface BookingData {
  barberName:     string;
  barberAddress:  string;
  mapLink:        string;
  barberPageLink: string;
  isTeam:         boolean;
  teamBarberName: string | null;
  date:           string;
  time:           string;
  totalPrice:     number;
  services:       { name: string; price: number; duration: number }[];
}

function parseBookingPayload(payload: string): { sessionId: string } | null {
  const match = payload.match(/^booking_([a-f0-9]{8,20})$/i);
  if (!match) return null;
  return { sessionId: match[1]! };
}

function formatDateLabel(dateStr: string): string {
  if (dateStr === "today" || dateStr === "bugun") return "Bugun";
  if (dateStr === "tomorrow" || dateStr === "ertaga") return "Ertaga";
  return dateStr;
}

async function sendBookingWelcome(
  chatId: number,
  firstName: string,
  sessionId: string,
  data: BookingData,
) {
  const barberLine = data.isTeam && data.teamBarberName
    ? `\n🧑‍🦱 Usta: <b>${data.teamBarberName}</b>`
    : "";
  const serviceNames = data.services.map((s: { name: string }) => s.name).join(", ");

  const text = `Xush kelibsiz! 💈\n\nBu bot orqali siz:\n• Online navbatga yozilasiz\n• Bronlaringizni tasdiqlaysiz\n• Eslatmalarni olasiz\n• Chegirmalar va aksiyalar haqida xabardor bo'lasiz\n\n💈 Sahifamiz:\n${data.barberPageLink}\n\n━━━━━━━━━━━━━━\n<b>Bron ma'lumotlari:</b>${barberLine}\n✂️ Xizmat: <b>${serviceNames}</b>\n🕒 Vaqt: <b>${formatDateLabel(data.date)}, ${data.time}</b>\n━━━━━━━━━━━━━━\n\n👇 Bronni tasdiqlash uchun tugmani bosing`;

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Tasdiqlash", callback_data: `book_confirm_${sessionId}` }],
      ],
    },
  });
}

async function sendBookingAlreadyDone(chatId: number, data: BookingData) {
  const barberLine = data.isTeam && data.teamBarberName
    ? `\n🧑‍🦱 Usta: ${data.teamBarberName}` : "";
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: `✅ Bu bron allaqachon tasdiqlangan!\n${barberLine}\n🕒 ${formatDateLabel(data.date)}, ${data.time}`,
    reply_markup: {
      inline_keyboard: [[{ text: "🌐 Ilovaga qaytish", url: data.barberPageLink }]],
    },
  });
}

async function sendExpiredSession(chatId: number) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "❗ Bu bron allaqachon yakunlangan yoki eskirgan.\n\nYangi bron qilish uchun barber sahifasiga qayting.",
  });
}

async function confirmBookingSession(
  chatId: number,
  sessionId: string,
  tgUserId: string,
  firstName: string,
  tgUsername: string | null,
) {
  const [session] = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) {
    await sendExpiredSession(chatId);
    return;
  }

  if (session.status === "expired") {
    await sendExpiredSession(chatId);
    return;
  }

  if (session.status === "confirmed") {
    let data: BookingData;
    try { data = JSON.parse(session.bookingData) as BookingData; } catch { return; }
    await sendBookingAlreadyDone(chatId, data);
    return;
  }

  let data: BookingData;
  try { data = JSON.parse(session.bookingData) as BookingData; } catch {
    await callTelegram("sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi. Iltimos qayta urining." });
    return;
  }

  await db
    .update(bookingSessionsTable)
    .set({
      status: "confirmed",
      clientTelegramId: tgUserId,
      clientName: firstName,
      clientTelegramUsername: tgUsername,
    })
    .where(eq(bookingSessionsTable.sessionId, sessionId));

  log("booking_confirmed", { sessionId, telegramUserId: tgUserId, barberId: session.barberId });

  const barberLine = data.isTeam && data.teamBarberName
    ? `\n🧑‍🦱 Usta: <b>${data.teamBarberName}</b>` : "";
  const mapLine = data.mapLink
    ? `\n📍 <a href="${data.mapLink}">Manzilni ko'rish</a>`
    : data.barberAddress ? `\n📍 ${data.barberAddress}` : "";

  const confirmText = `${firstName}, sizning navbatingiz tasdiqlandi ✅${barberLine}\n🕒 Vaqt: <b>${formatDateLabel(data.date)}, ${data.time}</b>${mapLine}\n\n💈 Qayta bron qilish:\n${data.barberPageLink}\n\n⏰ Iltimos, belgilangan vaqtdan 5-10 daqiqa oldin keling.`;

  const appUrl = getAppUrl();
  const returnUrl = `${appUrl}/barber-uz?session_confirmed=${sessionId}&tg_id=${tgUserId}`;

  const replyMarkup = validateAppUrl(returnUrl)
    ? { inline_keyboard: [[{ text: "🌐 Ilovaga qaytish", url: returnUrl }]] }
    : { inline_keyboard: [] };

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: confirmText,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });

  // Notify barber (fire-and-forget, non-blocking)
  const [fresh] = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.sessionId, sessionId))
    .limit(1);

  if (fresh && !fresh.notificationSent) {
    sendBarberBookingNotification(
      session.barberId,
      sessionId,
      data,
      firstName,
      fresh.clientPhone || null,
    ).catch(err => console.error("[Bot] barber notification failed:", err));
  }
}

async function handleBookingStart(
  chatId: number,
  sessionId: string,
  from: Record<string, unknown> | undefined,
) {
  const firstName = (from?.first_name as string) || "Mijoz";
  const tgUserId = String(from?.id || chatId);
  const tgUsername = (from?.username as string) || null;

  const [session] = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session || session.status === "expired" || new Date() > session.expiresAt) {
    await sendExpiredSession(chatId);
    return;
  }

  if (session.status === "confirmed") {
    let data: BookingData;
    try { data = JSON.parse(session.bookingData) as BookingData; } catch { return; }
    await sendBookingAlreadyDone(chatId, data);
    return;
  }

  let data: BookingData;
  try { data = JSON.parse(session.bookingData) as BookingData; } catch {
    await sendExpiredSession(chatId);
    return;
  }

  const existingUser = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.clientTelegramId, tgUserId))
    .limit(1);

  if (existingUser.length > 0 && existingUser[0]?.status === "confirmed") {
    await confirmBookingSession(chatId, sessionId, tgUserId, firstName, tgUsername);
    return;
  }

  await sendBookingWelcome(chatId, firstName, sessionId, data);
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
