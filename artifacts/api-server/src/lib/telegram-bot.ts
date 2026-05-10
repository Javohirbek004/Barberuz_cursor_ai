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
 *  1. /start auth_{code}_{lang} → always ask for phone number
 *  2. Contact received → match by phone in DB
 *     a) Found  → store token in pendingLoginResults → send "Sahifangiz topildi" + button
 *     b) Not found → send "ro'yxatdan o'tmagan" + registration link
 *  3. Frontend polls /api/auth/telegram-login-status/{code} → gets token → redirects
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
 * Priority: REPLIT_DEV_DOMAIN (dev only, when NODE_ENV=development)
 *           → REPLIT_DOMAINS preferred entry (non-sisko first, e.g. barberuz.replit.app)
 *           → APP_URL (manual override / custom domain fallback)
 *           → barberuz.replit.app (hardcoded last resort)
 *
 * IMPORTANT: REPLIT_DOMAINS may contain both a sisko.replit.dev entry AND the
 * clean domain. We always prefer the clean domain so that bot links sent to
 * users (login URLs, booking links) point to the correct production app.
 */
function getAppUrl(): string {
  // In development, REPLIT_DEV_DOMAIN is the live dev workspace URL (sisko.replit.dev).
  if (process.env.NODE_ENV === "development") {
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // In production, prefer the clean domain over sisko.replit.dev entries.
  const domains = (process.env.REPLIT_DOMAINS || "")
    .split(",")
    .map(d => d.trim())
    .filter(Boolean);
  const preferred = domains.find(d => !d.includes("sisko.replit.dev"));
  if (preferred) return `https://${preferred}`;
  if (domains[0]) return `https://${domains[0]}`;
  // APP_URL as a manual override fallback (e.g. custom domain).
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "https://barberuz.replit.app";
}

// ──────────────────────────────────────────────────────────────
// In-memory state maps
// ──────────────────────────────────────────────────────────────

/** Registration: chatId → userId (waiting for contact share) */
const pendingVerifications = new Map<number, string>();

/** Barber member invite: chatId → userId (waiting for contact share) */
const pendingBarberVerifications = new Map<number, { userId: string; name: string; shopName: string }>();

/** Login step 1: chatId → { code, lang, step } */
const pendingAuthLogins = new Map<number, { code: string; lang: string; step: "phone" }>();

/** Login result: code → { token, userId, expiresAt } (kept 10 min so polling doesn't miss) */
interface LoginResult {
  token: string;
  userId: string;
  expiresAt: number;
}
const pendingLoginResults = new Map<string, LoginResult>();

/** Secure login tokens: token → { userId, expiresAt } — single use, 5 min */
const loginTokens = new Map<string, { userId: string; expiresAt: number }>();

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

/**
 * Build a login URL using the tg_code polling mechanism.
 * Generates a one-time code, stores the login result in pendingLoginResults,
 * and returns a URL with ?tg_code=CODE. Login.tsx polls the API with this code
 * and auto-logs in — no token exposed in the URL.
 */
function buildLoginUrl(userId: string): string {
  const base = getAppUrl();
  const code = randomBytes(8).toString("hex"); // 16-char hex code
  const url = `${base}/login?tg_code=${code}`;
  if (!validateAppUrl(url)) return "";
  // Only store in pendingLoginResults after confirming the URL is valid
  const token = generateToken(userId);
  pendingLoginResults.set(code, {
    token,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return url;
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

async function sendVerificationSuccess(chatId: number, userId: string) {
  const profileUrl = buildLoginUrl(userId);
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

async function sendAuthPhoneRequest(chatId: number, lang: string) {
  const isUz = lang !== "ru";
  const text = isUz
    ? "Assalomu alaykum! \uD83D\uDC4B\n\nSahifangizga kirish uchun raqamingizni tasdiqlang:"
    : "Здравствуйте! \uD83D\uDC4B\n\nПодтвердите ваш номер для входа в профиль:";
  const btnText = isUz ? "\uD83D\uDCF2 Raqamni yuborish" : "\uD83D\uDCF2 Отправить номер";

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
  code: string,
  _token: string,
  firstName: string,
) {
  const base = getAppUrl();
  const loginUrl = `${base}/login?tg_code=${code}`;
  const profileUrl = validateAppUrl(loginUrl) ? loginUrl : "";
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

async function sendNotRegistered(chatId: number, lang: string) {
  const isUz = lang !== "ru";
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz
      ? "Siz hali ro\u02BByxatdan o\u02BBtmagansiz.\n\nAvval ilovada ro\u02BByxatdan o\u02BBting."
      : "Вы ещё не зарегистрированы.\n\nСначала зарегистрируйтесь в приложении.",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: isUz ? "\uD83C\uDF10 Ro\u02BByxatdan o\u02BBtish" : "\uD83C\uDF10 Зарегистрироваться", url: `${getAppUrl()}/register` }],
      ],
    },
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
  const autoLoginUrl = `${getAppUrl()}/barber-setup/${userId}?auto=1&n=${encodeURIComponent(name)}&s=${encodeURIComponent(shopName)}`;
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
      await handleRegStart(chatId, regParsed.userId, regParsed.lang, from);
      return;
    }

    // Login/auth deep-link
    const authParsed = parseAuthPayload(payload);
    if (authParsed) {
      await handleAuthStart(chatId, authParsed.code, authParsed.lang, from);
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

    // Otherwise it's the registration verification flow
    await handleRegContact(chatId, phone, tgUserId, tgUsername);
    return;
  }

  // ── Unexpected text during pending states ────────────────────
  // Telegram always shows a text input alongside the keyboard — users may
  // accidentally type instead of pressing the contact button. Re-prompt them.
  if (text && !text.startsWith("/")) {
    const authPendingText = pendingAuthLogins.get(chatId);
    if (authPendingText && authPendingText.step === "phone") {
      await sendAuthPhoneRequest(chatId, authPendingText.lang);
      return;
    }
    if (pendingVerifications.has(chatId)) {
      const userId = pendingVerifications.get(chatId)!;
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const name = user?.name || "Barber";
      await sendContactRequest(chatId, name);
      return;
    }
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

  // If an active login (auth_) flow is in progress, re-send the phone request
  // so the user doesn't see the generic welcome message mid-login.
  const authPending = pendingAuthLogins.get(chatId);
  if (authPending) {
    await sendAuthPhoneRequest(chatId, authPending.lang);
    return;
  }

  // Check if already linked
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, String(chatId)))
    .limit(1);

  if (user) {
    const profileUrl = buildLoginUrl(user.id);
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

  // Not linked — guide to app (no phone prompt, no state)
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Assalomu alaykum! \uD83D\uDC4B\n\nRo\u02BByxatdan o\u02BBtish yoki kirish uchun ilovadan foydalaning:",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [[{ text: "\uD83C\uDF10 Ilovaga o\u02BBtish", url: `${getAppUrl()}/register` }]],
    },
  });
}

async function handleRegStart(chatId: number, userId: string, _lang: string, from?: Record<string, unknown>) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    // Stale deep-link (e.g. user deleted their account) — fall back to the
    // no-payload /start flow: check by Telegram ID, or ask for phone number.
    console.warn(`[TelegramBot] Reg: user not found userId=${userId}, falling back to no-payload flow`);
    await handleNoPayloadStart(chatId, from);
    return;
  }

  if (user.telegramVerified) {
    const profileUrl = buildLoginUrl(user.id);
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

  // Clear any stale auth state so phone share routes to reg flow, not auth flow
  pendingAuthLogins.delete(chatId);

  // Persist chatId on user record so we can recover the session after a server restart
  await db.update(usersTable)
    .set({ telegramId: String(chatId), updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

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
    const profileUrl = buildLoginUrl(user.id);
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

  const profileUrl = buildLoginUrl(user.id);

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

async function handleAuthStart(chatId: number, code: string, lang: string, _from?: Record<string, unknown>) {
  console.log(`[TelegramBot] Auth start: chatId=${chatId} code=${code} lang=${lang}`);
  // Always verify by phone — skipping telegramId fast-path so every login is phone-confirmed
  pendingAuthLogins.delete(chatId); // clear any stale pending state
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
  const isUz = pending.lang !== "ru";
  const loginUrl = `${getAppUrl()}/login?tg_code=${pending.code}`;
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: isUz
      ? "Sahifangiz topildi \u2705\n\nProfilingizga o\u02BBtish uchun quyidagi tugmani bosing:"
      : "Ваш профиль найден \u2705\n\nНажмите кнопку ниже, чтобы перейти в профиль:",
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: isUz ? "\uD83C\uDF10 Sahifaga qaytish" : "\uD83C\uDF10 Перейти в профиль", url: loginUrl }],
      ],
    },
  });
}

async function handleRegContact(
  chatId: number,
  phone: string | null,
  tgUserId: string,
  tgUsername: string | null,
) {
  // Primary: in-memory session (normal flow)
  let userId = pendingVerifications.get(chatId);

  // Fallback: server may have restarted — recover via telegramId written in handleRegStart
  if (!userId) {
    const [recovered] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.telegramId, String(chatId)),
          eq(usersTable.telegramVerified, false),
        ),
      )
      .limit(1);
    if (recovered) {
      userId = recovered.id;
      console.log(`[TelegramBot] Reg contact: recovered session from DB chatId=${chatId} userId=${userId}`);
    }
  }

  if (!userId) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Ro\u02BByxatdan o\u02BBtish uchun ilovadan maxsus havola oling:",
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard: [[{ text: "\uD83C\uDF10 Ilovaga o\u02BBtish", url: `${getAppUrl()}/register` }]],
      },
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
    await sendVerificationSuccess(chatId, userId);
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
  const reBookUrl = `${getAppUrl()}?barberId=${encodeURIComponent(session.barberId)}${serviceParam}`;

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
  const returnUrl = `${appUrl}?session_confirmed=${sessionId}&tg_id=${tgUserId}`;

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
