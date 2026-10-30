/**
 * Client Telegram receipts, reminders, confirm / cancel, and auto-cancel.
 * Times are Asia/Tashkent (UTC+5). Real bookings are only changed by the
 * callback handlers and the reminder cycle — the /eslatma preview does not.
 */

import { db, bookingsTable, bookingSessionsTable, clientsTable, usersTable } from "@workspace/db";
import { syncClientMetrics } from "./client-metrics";
import { getTelegramBotToken } from "./telegram-token";
import { barberEntryMarkup } from "./barber-entry-keyboard";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const OPEN_STATUSES = ["pending", "confirmed"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

interface BarberCard {
  id: string;
  name: string;
  brandName: string | null;
  address: string | null;
  mapLink: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  phoneVisible: boolean;
  username: string;
  telegramId: string | null;
  eveningConfirm?: boolean;
  quickReminder?: boolean;
  autoCancel?: boolean;
  notifyCancel?: boolean;
  cancelLimit?: number;
}

interface BookingCard {
  id: string;
  barberId: string;
  clientId: string | null;
  clientName: string;
  serviceName: string | null;
  price: string;
  date: string;
  startTime: string;
  status: string;
  clientConfirmed: boolean;
  clientTelegramId: string | null;
  reminded24h: boolean;
  reminded1h: boolean;
  remindedFollowup: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

function token(): string {
  return getTelegramBotToken();
}

const PUBLIC_SITE = process.env.RENDER_EXTERNAL_HOSTNAME
  ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME.trim()}`
  : "https://barber-uz-clq6.onrender.com";

/** Client rebook link: the barber's booking page, not the app home. */
export function rebookUrl(username: string | null | undefined): string {
  const slug = (username || "").trim();
  if (!slug) return PUBLIC_SITE;
  return `${PUBLIC_SITE}/${encodeURIComponent(slug)}?bron=1`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter((line): line is string => line != null).join("\n");
}

function digits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digits(a);
  const db = digits(b);
  if (da.length < 9 || db.length < 9) return false;
  return da === db || da.slice(-9) === db.slice(-9);
}

function formatPhone(raw: string | null | undefined): string {
  const d = digits(raw);
  if (d.length === 12 && d.startsWith("998")) {
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return (raw || "").trim();
}

function uzDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}-${MONTHS[(m || 1) - 1]}`;
}

function tashkentNow(now = Date.now()): { hour: number; minute: number; date: string } {
  const shifted = new Date(now + TASHKENT_OFFSET_MS);
  const date = shifted.toISOString().slice(0, 10);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), date };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function appointmentMs(date: string, time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const stamp = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:00`;
  return new Date(stamp).getTime();
}

function safeMap(url: string | null | undefined): string {
  const value = (url || "").trim();
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

function resolveMapUrl(barber: {
  mapLink?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}): string {
  const link = safeMap(barber.mapLink);
  if (link) return link;
  const lat = Number((barber.latitude || "").trim());
  const lng = Number((barber.longitude || "").trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";
  if (lat === 0 && lng === 0) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function addressLine(mapUrl: string, address: string): string | null {
  const link = safeMap(mapUrl);
  const place = address.trim();
  if (link && place) {
    return `📍 Manzil: <a href="${esc(link)}">🗺️ Xaritadan ko'rish</a> — ${esc(place)}`;
  }
  if (link) return `📍 Manzil: <a href="${esc(link)}">🗺️ Xaritadan ko'rish</a>`;
  if (place) return `📍 Manzil: ${esc(place)}`;
  return null;
}

function salonName(barber: BarberCard): string {
  return barber.brandName?.trim() || barber.name?.trim() || "Barber.uz";
}

function contactLine(barber: BarberCard): string | null {
  if (!barber.phoneVisible || !barber.phone?.trim()) return null;
  return `📞 Bogʻlanish: ${esc(formatPhone(barber.phone))}`;
}

export const CLIENT_CANCEL_LIMITS = [30, 60, 120, 180] as const;

export function normalizeCancelLimit(value: unknown): number {
  const n = Number(value);
  return (CLIENT_CANCEL_LIMITS as readonly number[]).includes(n) ? n : 60;
}

function limitPhrase(minutes: number): string {
  if (minutes <= 30) return "30 daqiqadan kam";
  if (minutes <= 60) return "1 soatdan kam";
  if (minutes <= 120) return "2 soatdan kam";
  return "3 soatdan kam";
}

export function clientCancelKeyboard(bookingId: string) {
  return {
    inline_keyboard: [[
      { text: "❌ Bronni bekor qilish", callback_data: `cancel_${bookingId}` },
    ]],
  };
}

export function clientMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "📅 Mening bronlarim" }],
      [{ text: "✂️ Qayta bron" }, { text: "📞 Aloqa" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function mapLinkLine(barber: BarberCard): string | null {
  const link = resolveMapUrl(barber);
  if (!link) return null;
  return `📍 Manzil: <a href="${esc(link)}">Xaritadan ko'rish</a>`;
}

function phoneLine(barber: BarberCard): string | null {
  if (barber.phoneVisible === false || !barber.phone?.trim()) return null;
  return `📞 Aloqa: ${esc(formatPhone(barber.phone))}`;
}

function botNote(): string {
  return lines(
    "🤖 <b>Bot haqida eslatma:</b>",
    "Ushbu bot sizning shaxsiy yordamchingiz:",
    "• Navbatingizga oz qolganda eslatma yuboradi",
    "• Istalgan vaqtda qayta bron qilishga yordam beradi",
    "",
    "Chatni o'chirmang, qulaylikdan foydalaning!",
  );
}

function moneyAmount(price: string | number | null | undefined): string {
  const n = Number(price ?? 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString("ru-RU") : "0";
}

export function clientReceiptMessage(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  price: string | number | null | undefined;
  date: string;
  time: string;
  minutesLeft: number;
  bookingId?: string | null;
}): { text: string; reply_markup: ReturnType<typeof clientMenuKeyboard> } {
  void input.minutesLeft;
  const text = lines(
    `🥳 <b>Broningiz qabul qilindi, ${esc(input.clientName)}!</b>`,
    "",
    `👤 Usta: ${esc(salonName(input.barber))}`,
    `✂️ Xizmat: ${esc(input.service)}`,
    `💵 Narx: ${esc(moneyAmount(input.price))} so'm`,
    `📅 Sana: ${esc(uzDate(input.date))}`,
    `⏰ Vaqt: ${esc(input.time)}`,
    phoneLine(input.barber),
    mapLinkLine(input.barber),
    "",
    "ℹ️ <b>Eslatma:</b> Iltimos, 5-10 daqiqa ertaroq keling.",
    "",
    "ℹ️ <b>Eslatma:</b> Bronni bekor qilish uchun cheklov vaqti mavjud. Cheklov vaqti o'tgach, faqat usta bilan bog'lanib bekor qilishingiz mumkin.",
    "",
    botNote(),
  );
  return { text, reply_markup: clientMenuKeyboard() };
}

export function reminder24Message(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  time: string;
  bookingId: string;
}): { text: string; reply_markup: ReturnType<typeof clientCancelKeyboard> } {
  return {
    text: lines(
      `⏰ <b>Ertaga navbatingiz bor, ${esc(input.clientName)}!</b>`,
      "",
      `👤 Usta: ${esc(salonName(input.barber))}`,
      `✂️ Xizmat: ${esc(input.service)}`,
      `⏰ Vaqt: Ertaga ${esc(input.time)} da`,
      mapLinkLine(input.barber),
      "",
      "💡 Iltimos, belgilangan vaqtda keling.",
    ),
    reply_markup: clientCancelKeyboard(input.bookingId),
  };
}

export function reminder1hMessage(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  time: string;
  bookingId: string;
}): { text: string; reply_markup?: ReturnType<typeof clientCancelKeyboard> } {
  const limit = normalizeCancelLimit(input.barber.cancelLimit);
  const text = lines(
    `🚨 <b>Diqqat, ${esc(input.clientName)}! 1 soatdan keyin navbatingiz bor!</b>`,
    "",
    `👤 Usta: ${esc(salonName(input.barber))}`,
    `✂️ Xizmat: ${esc(input.service)}`,
    `⏰ Vaqt: ${esc(input.time)} (1 soat qoldi)`,
    mapLinkLine(input.barber),
    "",
    "💡 Iltimos, belgilangan vaqtda keling. Agarda kechikishingiz mumkin bo‘lsa yoki qandaydir sababga ko‘ra kela olmasangiz, darhol barber bilan aloqaga chiqing!",
  );
  return limit === 30
    ? { text, reply_markup: clientCancelKeyboard(input.bookingId) }
    : { text };
}

export function receiptText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🎉 <b>Broningiz qabul qilindi!</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "⚠️ Iltimos, kelishingizni tasdiqlang.",
  );
}

export function publicConfirmedReceiptText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "✅ <b>Broningiz muvaffaqiyatli tasdiqlandi!</b>",
    "",
    `💈 Usta: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "⏰ <b>Eslatmalar</b> (Telegram orqali):",
    "• 1 kun oldin",
    "• Vaqt yaqinlashganda",
    "• 1 soat oldin",
    "",
    "Kutilgan vaqtda kutamiz! 💈",
  );
}

export function reminder24Text(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🚨 <b>Eslatma! Ertaga navbatingiz bor</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: Ertaga (${esc(uzDate(date))})`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "Kelishingizni tasdiqlaysizmi?",
  );
}

export function followupText(): string {
  return [
    "⏳ Sizning navbatingizga oz vaqt qoldi.",
    "Iltimos, kelishingizni tasdiqlang.",
  ].join("\n");
}

export function reminder1hText(barber: BarberCard, time: string): string {
  return lines(
    "⏰ <b>1 soatdan keyin uchrashamiz!</b>",
    "",
    `Soat ${esc(time)} da sizni ${esc(salonName(barber))} salonida kutib qolamiz ✂️`,
    "",
    addressLine(resolveMapUrl(barber), barber.address || ""),
    contactLine(barber),
    "",
    "Xush kayfiyat bilan kutamiz! 💈",
    "Iltimos oʻz vaqtida keling!",
  );
}

function confirmedText(): string {
  return [
    "✨ <b>Ajoyib! Navbatingiz tasdiqlandi.</b>",
    "",
    "Sizni belgilangan vaqtda kutapmiz.",
    "Iltimos belgilangan vaqtdan 5 daqiqa oldin keling!",
  ].join("\n");
}

function tooLateText(barber: BarberCard, limit = normalizeCancelLimit(barber.cancelLimit)): string {
  const phone = barber.phone?.trim()
    ? `\n📞 Telefon: ${esc(formatPhone(barber.phone))}`
    : "";
  return [
    "🚫 <b>Bekor qilish vaqti o'tdi!</b>",
    "",
    `Navbatga ${limitPhrase(limit)} vaqt qolgani sababli bot orqali bekor qilib bo'lmaydi.`,
    `Iltimos, usta bilan bevosita bog'laning:${phone}`,
  ].join("\n");
}

export async function handleClientCancelNo(chatId: number, messageId?: number): Promise<void> {
  await editOrSend(String(chatId), messageId, "Bron saqlanib qoldi.", {
    reply_markup: { inline_keyboard: [] },
  });
}

function cancelledText(): string {
  return [
    "🗑️ <b>Navbatingiz bekor qilindi.</b>",
    "",
    "Boshqa qulay vaqtda koʻrishguncha! Qayta bron qilish uchun quyidagi tugmani bosing 👇",
  ].join("\n");
}

function barberCancelledText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🗑️ <b>Navbatingiz bekor qilindi</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    "",
    "Noqulaylik uchun uzr so'raymiz. Qulay boshqa vaqtni tanlash uchun quyidagi tugmani bosing 👇",
    contactLine(barber),
  );
}

function barberRescheduledText(
  barber: BarberCard,
  service: string,
  from: { date: string; time: string },
  to: { date: string; time: string },
): string {
  return lines(
    "🔄 <b>Navbatingiz vaqti o'zgartirildi</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `❌ Avvalgi vaqt: ${esc(uzDate(from.date))}, ${esc(from.time)}`,
    `✅ Yangi vaqt: ${esc(uzDate(to.date))}, ${esc(to.time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    contactLine(barber),
  );
}

function clientCancelledBarberText(clientName: string, phone: string | null, service: string, date: string, time: string): string {
  return lines(
    "⚠️ <b>Bron bekor qilindi!</b>",
    "",
    `👤 Mijoz: ${esc(clientName)}`,
    phone ? `📞 Telefon: ${esc(formatPhone(phone))}` : null,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana va vaqt: ${esc(uzDate(date))}, ${esc(time)}`,
    "",
    "Mijoz botdan bekor qildi. Bu vaqt kalendaringizda bo'shatildi.",
  );
}

async function telegram(method: string, body: Record<string, unknown>): Promise<boolean> {
  const key = token();
  if (!key) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${key}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok?: boolean };
    if (!json.ok) {
      console.error(`[ClientNotify] ${method} failed`, JSON.stringify(json));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[ClientNotify] ${method} error`, err);
    return false;
  }
}

async function sendToBarber(chatId: string, text: string): Promise<boolean> {
  const entryMarkup = await barberEntryMarkup(chatId);
  return send(chatId, text, entryMarkup ? { reply_markup: entryMarkup } : {});
}

async function send(chatId: string, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editOrSend(
  chatId: string,
  messageId: number | undefined,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (messageId) {
    const edited = await telegram("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
    if (edited) return;
  }
  await send(chatId, text, extra);
}

async function loadBarber(barberId: string): Promise<BarberCard | null> {
  const [row] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      brandName: usersTable.brandName,
      address: usersTable.address,
      mapLink: usersTable.mapLink,
      latitude: usersTable.latitude,
      longitude: usersTable.longitude,
      phone: usersTable.phone,
      phoneVisible: usersTable.phoneVisible,
      username: usersTable.username,
      telegramId: usersTable.telegramId,
      eveningConfirm: usersTable.notifClientEvening,
      quickReminder: usersTable.notifClientQuick,
      autoCancel: usersTable.notifClientAutoCancel,
      notifyCancel: usersTable.notifCancellation,
      cancelLimit: usersTable.clientCancelLimit,
    })
    .from(usersTable)
    .where(eq(usersTable.id, barberId))
    .limit(1);
  return row ?? null;
}

async function loadBooking(bookingId: string): Promise<BookingCard | null> {
  const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  return row ?? null;
}

async function findTelegram(barberId: string, phone: string | null, clientId: string | null): Promise<string | null> {
  if (clientId) {
    const [client] = await db
      .select({ telegramId: clientsTable.telegramId, phone: clientsTable.phone })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);
    if (client?.telegramId) return client.telegramId;
    if (!phone && client?.phone) phone = client.phone;
  }
  if (!phone) return null;

  const clients = await db
    .select({ telegramId: clientsTable.telegramId, phone: clientsTable.phone })
    .from(clientsTable)
    .where(and(eq(clientsTable.barberId, barberId), isNotNull(clientsTable.telegramId)));
  const clientHit = clients.find((row) => row.telegramId && phonesMatch(row.phone, phone));
  if (clientHit?.telegramId) return clientHit.telegramId;

  const sessions = await db
    .select({
      clientTelegramId: bookingSessionsTable.clientTelegramId,
      clientPhone: bookingSessionsTable.clientPhone,
    })
    .from(bookingSessionsTable)
    .where(and(eq(bookingSessionsTable.barberId, barberId), isNotNull(bookingSessionsTable.clientTelegramId)));
  const sessionHit = sessions.find((row) => row.clientTelegramId && phonesMatch(row.clientPhone, phone));
  return sessionHit?.clientTelegramId ?? null;
}

function rebookMarkup(username: string) {
  return { inline_keyboard: [[{ text: "📱 Qayta bron qilish", url: rebookUrl(username) }]] };
}

export async function deliverBookingReceipt(
  bookingId: string,
  hint?: { telegramId?: string | null; phone?: string | null; keepConfirmed?: boolean },
): Promise<boolean> {
  const booking = await loadBooking(bookingId);
  if (!booking || booking.deletedAt) return false;
  if (booking.status === "cancelled" || booking.status === "auto_cancelled" || booking.status === "completed") {
    return false;
  }
  if (booking.clientTelegramId && !hint?.keepConfirmed) return true;

  const barber = await loadBarber(booking.barberId);
  if (!barber) return false;

  let chat = hint?.telegramId || booking.clientTelegramId;
  if (!chat) chat = await findTelegram(booking.barberId, hint?.phone ?? null, booking.clientId);
  if (!chat) return false;

  const service = booking.serviceName?.trim() || "Xizmat";
  const time = booking.startTime.slice(0, 5);
  const minutesLeft = (appointmentMs(booking.date, time) - Date.now()) / 60000;
  const message = clientReceiptMessage({
    barber,
    clientName: booking.clientName,
    service,
    price: booking.price,
    date: booking.date,
    time,
    minutesLeft,
    bookingId: booking.id,
  });
  const ok = await send(chat, message.text, message.reply_markup
    ? { reply_markup: message.reply_markup }
    : {});
  if (!ok) return false;

  await db.update(bookingsTable).set({
    clientTelegramId: chat,
    clientConfirmed: true,
    status: "confirmed",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));

  if (booking.clientId) {
    await db.update(clientsTable)
      .set({ telegramId: chat, updatedAt: new Date() })
      .where(and(eq(clientsTable.id, booking.clientId), isNull(clientsTable.telegramId)));
  }
  return true;
}

function ownsChat(booking: BookingCard, chatId: number): boolean {
  return !!booking.clientTelegramId && booking.clientTelegramId === String(chatId);
}

export async function handleClientConfirm(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), "Bron topilmadi.");
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await send(String(chatId), "Bu navbat allaqachon bekor qilingan.");
    return;
  }
  await db.update(bookingsTable).set({
    status: "confirmed",
    clientConfirmed: true,
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));
  await editOrSend(String(chatId), messageId, confirmedText(), { reply_markup: { inline_keyboard: [] } });
}

export async function handleClientCancel(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), "Bron topilmadi.");
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await send(String(chatId), "Bu navbat allaqachon bekor qilingan.");
    return;
  }
  const barber = await loadBarber(booking.barberId);
  if (!barber) return;

  const minutesLeft = (appointmentMs(booking.date, booking.startTime) - Date.now()) / 60000;
  const limit = normalizeCancelLimit(barber.cancelLimit);
  if (minutesLeft <= limit) {
    await editOrSend(String(chatId), messageId, tooLateText(barber, limit), { reply_markup: { inline_keyboard: [] } });
    return;
  }

  await send(String(chatId), "Haqiqatan ham ushbu bronni bekor qilmoqchimisiz?", {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Ha, bekor qilish", callback_data: `clyes_${booking.id}` },
        { text: "🛑 Bekor qilmaslik", callback_data: `clno_${booking.id}` },
      ]],
    },
  });
}

export async function handleClientCancelYes(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), "Bron topilmadi.");
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await editOrSend(String(chatId), messageId, "Bu navbat allaqachon bekor qilingan.", { reply_markup: { inline_keyboard: [] } });
    return;
  }
  const barber = await loadBarber(booking.barberId);
  if (!barber) return;

  const minutesLeft = (appointmentMs(booking.date, booking.startTime) - Date.now()) / 60000;
  const limit = normalizeCancelLimit(barber.cancelLimit);
  if (minutesLeft <= limit) {
    await editOrSend(String(chatId), messageId, tooLateText(barber, limit), { reply_markup: { inline_keyboard: [] } });
    return;
  }

  await db.update(bookingsTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));
  await syncClientMetrics(booking.clientId, booking.barberId);
  await db.update(bookingSessionsTable).set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.bookingId, booking.id));

  await editOrSend(String(chatId), messageId, cancelledText(), {
    reply_markup: rebookMarkup(barber.username),
  });

  if (barber.telegramId && barber.notifyCancel !== false) {
    let phone: string | null = null;
    if (booking.clientId) {
      const [client] = await db
        .select({ phone: clientsTable.phone })
        .from(clientsTable)
        .where(eq(clientsTable.id, booking.clientId))
        .limit(1);
      phone = client?.phone ?? null;
    }
    await sendToBarber(
      barber.telegramId,
      clientCancelledBarberText(
        booking.clientName,
        phone,
        booking.serviceName?.trim() || "Xizmat",
        booking.date,
        booking.startTime.slice(0, 5),
      ),
    );
  }
}

export type BarberBookingChange =
  | { kind: "cancelled" }
  | { kind: "rescheduled"; from: { date: string; time: string } };

/**
 * The barber cancelled or moved a booking in the app: tell the client on Telegram at once.
 * Returns false when the client has no Telegram chat or the message could not be sent.
 */
export async function notifyClientOfBarberChange(bookingId: string, change: BarberBookingChange): Promise<boolean> {
  const booking = await loadBooking(bookingId);
  if (!booking || booking.deletedAt) return false;

  let chat = booking.clientTelegramId;
  if (!chat && booking.clientId) {
    const [client] = await db
      .select({ telegramId: clientsTable.telegramId })
      .from(clientsTable)
      .where(eq(clientsTable.id, booking.clientId))
      .limit(1);
    chat = client?.telegramId ?? null;
  }
  if (!chat) return false;

  const barber = await loadBarber(booking.barberId);
  if (!barber) return false;

  const service = booking.serviceName?.trim() || "Xizmat";
  const time = booking.startTime.slice(0, 5);

  if (change.kind === "cancelled") {
    return send(chat, barberCancelledText(barber, service, booking.date, time), {
      reply_markup: rebookMarkup(barber.username),
    });
  }
  return send(chat, barberRescheduledText(barber, service, change.from, { date: booking.date, time }));
}

export async function runClientNotificationCycle(now = Date.now()): Promise<void> {
  if (!token()) return;

  const rows = await db.select().from(bookingsTable).where(and(
    inArray(bookingsTable.status, [...OPEN_STATUSES]),
    isNull(bookingsTable.deletedAt),
    isNotNull(bookingsTable.clientTelegramId),
  ));

  const barbers = new Map<string, BarberCard | null>();
  async function barberOf(id: string): Promise<BarberCard | null> {
    if (!barbers.has(id)) barbers.set(id, await loadBarber(id));
    return barbers.get(id) ?? null;
  }

  for (const booking of rows) {
    if (!booking.clientTelegramId) continue;
    const barber = await barberOf(booking.barberId);
    if (!barber) continue;
    const service = booking.serviceName?.trim() || "Xizmat";
    const time = booking.startTime.slice(0, 5);
    const minutesLeft = (appointmentMs(booking.date, time) - now) / 60000;
    if (minutesLeft < 0) continue;

    if (barber.eveningConfirm !== false && !booking.reminded24h && minutesLeft <= 1440 && minutesLeft > 1430) {
      const message = reminder24Message({
        barber,
        clientName: booking.clientName,
        service,
        time,
        bookingId: booking.id,
      });
      const ok = await send(booking.clientTelegramId, message.text, { reply_markup: message.reply_markup });
      if (ok) {
        await db.update(bookingsTable).set({ reminded24h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }

    if (barber.quickReminder !== false && !booking.reminded1h && minutesLeft <= 65 && minutesLeft >= 55) {
      const message = reminder1hMessage({
        barber,
        clientName: booking.clientName,
        service,
        time,
        bookingId: booking.id,
      });
      const ok = await send(booking.clientTelegramId, message.text, message.reply_markup
        ? { reply_markup: message.reply_markup }
        : {});
      if (ok) {
        await db.update(bookingsTable).set({ reminded1h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }
  }
}

export function isClientCallback(data: string): "confirm" | "cancel" | "cancel_yes" | "cancel_no" | null {
  if (/^clyes_[0-9a-f-]{36}$/i.test(data)) return "cancel_yes";
  if (/^clno_[0-9a-f-]{36}$/i.test(data)) return "cancel_no";
  const confirm = data.match(/^confirm_([0-9a-f-]{36})$/i);
  if (confirm?.[1] && UUID_RE.test(confirm[1])) return "confirm";
  const cancel = data.match(/^cancel_([0-9a-f-]{36})$/i);
  if (cancel?.[1] && UUID_RE.test(cancel[1])) return "cancel";
  return null;
}

export function callbackBookingId(data: string): string {
  return data.slice(data.indexOf("_") + 1);
}

/** Sample messages for /eslatma. Does not read or change bookings. */
export async function sendReminderPreview(chatId: string | number): Promise<void> {
  const id = String(chatId);
  let barber: BarberCard = {
    id: "preview",
    name: "Barber.uz",
    brandName: "Barber.uz",
    address: "Chilonzor, 9-kvartal (Moʻljal: Metro yonida)",
    mapLink: "https://maps.google.com/?q=Chilonzor",
    latitude: null,
    longitude: null,
    phone: "+998901234567",
    phoneVisible: true,
    username: "barber",
    telegramId: null,
  };
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        brandName: usersTable.brandName,
        address: usersTable.address,
        mapLink: usersTable.mapLink,
        latitude: usersTable.latitude,
        longitude: usersTable.longitude,
        phone: usersTable.phone,
        phoneVisible: usersTable.phoneVisible,
        username: usersTable.username,
        telegramId: usersTable.telegramId,
      })
      .from(usersTable)
      .where(eq(usersTable.telegramId, id))
      .limit(1);
    if (user) {
      barber = {
        ...barber,
        ...user,
        address: user.address || barber.address,
        mapLink: user.mapLink || (user.latitude && user.longitude ? null : barber.mapLink),
        latitude: user.latitude,
        longitude: user.longitude,
        phone: user.phone || barber.phone,
      };
    }
  } catch {
    // Sample salon details are enough.
  }

  const sample = {
    barber: { ...barber, cancelLimit: 60 },
    clientName: "Ali",
    service: "Soch olish",
    time: "15:00",
    bookingId: "00000000-0000-4000-8000-000000000000",
  };
  const receipt = clientReceiptMessage({
    ...sample,
    price: 50000,
    date: tashkentNow().date,
    minutesLeft: 180,
  });
  const dayBefore = reminder24Message(sample);
  const soon = reminder1hMessage(sample);

  await send(id, "Bu sinov. Haqiqiy mijozga xabar ketmadi va hech qanday bron o'zgarmaydi.");
  await send(id, receipt.text, receipt.reply_markup ? { reply_markup: receipt.reply_markup } : {});
  await send(id, dayBefore.text, { reply_markup: dayBefore.reply_markup });
  await send(id, soon.text, soon.reply_markup ? { reply_markup: soon.reply_markup } : {});
}
