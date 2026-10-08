/**
 * Client Telegram receipts, reminders, confirm / cancel, and auto-cancel.
 * Times are Asia/Tashkent (UTC+5). Real bookings are only changed by the
 * callback handlers and the reminder cycle — the /eslatma preview does not.
 */

import { db, bookingsTable, bookingSessionsTable, clientsTable, usersTable } from "@workspace/db";
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
  phone: string | null;
  phoneVisible: boolean;
  username: string;
  telegramId: string | null;
}

interface BookingCard {
  id: string;
  barberId: string;
  clientId: string | null;
  clientName: string;
  serviceName: string | null;
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
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function appBase(): string {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env && /^https?:\/\//i.test(env)) return env;
  return "https://barberuz-lovat.vercel.app";
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

function confirmKeyboard(bookingId: string, yesLabel: string) {
  return {
    inline_keyboard: [[
      { text: yesLabel, callback_data: `confirm_${bookingId}` },
      { text: "❌ Bekor qilish", callback_data: `cancel_${bookingId}` },
    ]],
  };
}

export function receiptText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🎉 <b>Broningiz qabul qilindi!</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(barber.mapLink || "", barber.address || ""),
    "",
    "⚠️ Iltimos, kelishingizni tasdiqlang! Agar eslatmalarga javob berilmasa, broningiz avtomatik bekor qilinishi mumkin.",
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
    addressLine(barber.mapLink || "", barber.address || ""),
    "",
    "Kelishingizni tasdiqlaysizmi?",
  );
}

export function followupText(): string {
  return [
    "⏳ Sizning navbatingizga oz vaqt qoldi.",
    "Iltimos, kelishingizni tasdiqlang! Javob berilmasa, broningiz avtomatik bekor qilinadi.",
  ].join("\n");
}

export function reminder1hText(barber: BarberCard, time: string): string {
  return lines(
    "⏰ <b>1 soatdan keyin uchrashamiz!</b>",
    "",
    `Soat ${esc(time)} da sizni ${esc(salonName(barber))} salonida kutib qolamiz ✂️`,
    "",
    addressLine(barber.mapLink || "", barber.address || ""),
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

function tooLateText(barber: BarberCard): string {
  const phone = barber.phone?.trim()
    ? `\n📞 Telefon: ${esc(formatPhone(barber.phone))}`
    : "";
  return [
    "🚫 <b>Bekor qilish vaqti o'tdi!</b>",
    "",
    "Navbatga 1 soatdan kam vaqt qolgani sababli bot orqali bekor qilib bo'lmaydi.",
    `Iltimos, usta bilan bevosita bog'laning:${phone}`,
  ].join("\n");
}

function cancelledText(): string {
  return [
    "🗑️ <b>Navbatingiz bekor qilindi.</b>",
    "",
    "Boshqa qulay vaqtda koʻrishguncha! Qayta bron qilish uchun quyidagi tugmani bosing 👇",
  ].join("\n");
}

function autoClientText(): string {
  return "🗑️ Tasdiqlanmagani sababli navbatingiz avtomatik bekor qilindi.";
}

function autoBarberText(time: string, clientName: string): string {
  return `⚠️ Soat ${esc(time)} dagi ${esc(clientName)} broni tasdiqlanmagani uchun avtomatik bekor qilindi va vaqt bo'shatildi.`;
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
      phone: usersTable.phone,
      phoneVisible: usersTable.phoneVisible,
      username: usersTable.username,
      telegramId: usersTable.telegramId,
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
  const url = `${appBase()}/${encodeURIComponent(username)}`;
  return { inline_keyboard: [[{ text: "📱 Qayta bron qilish", url }]] };
}

export async function deliverBookingReceipt(
  bookingId: string,
  hint?: { telegramId?: string | null; phone?: string | null },
): Promise<boolean> {
  const booking = await loadBooking(bookingId);
  if (!booking || booking.deletedAt) return false;
  if (booking.status === "cancelled" || booking.status === "auto_cancelled" || booking.status === "completed") {
    return false;
  }
  if (booking.clientTelegramId) return true;

  const barber = await loadBarber(booking.barberId);
  if (!barber) return false;

  let chat = hint?.telegramId || booking.clientTelegramId;
  if (!chat) chat = await findTelegram(booking.barberId, hint?.phone ?? null, booking.clientId);
  if (!chat) return false;

  const service = booking.serviceName?.trim() || "Xizmat";
  const ok = await send(chat, receiptText(barber, service, booking.date, booking.startTime.slice(0, 5)), {
    reply_markup: confirmKeyboard(booking.id, "✅ Tasdiqlash"),
  });
  if (!ok) return false;

  await db.update(bookingsTable).set({
    clientTelegramId: chat,
    clientConfirmed: false,
    status: "pending",
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
  if (minutesLeft <= 60) {
    await editOrSend(String(chatId), messageId, tooLateText(barber), { reply_markup: { inline_keyboard: [] } });
    return;
  }

  await db.update(bookingsTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));
  await db.update(bookingSessionsTable).set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.bookingId, booking.id));

  await editOrSend(String(chatId), messageId, cancelledText(), {
    reply_markup: rebookMarkup(barber.username),
  });
}

async function cancelUnconfirmed(booking: BookingCard, barber: BarberCard): Promise<void> {
  const updated = await db.update(bookingsTable).set({
    status: "auto_cancelled",
    updatedAt: new Date(),
  }).where(and(
    eq(bookingsTable.id, booking.id),
    eq(bookingsTable.clientConfirmed, false),
    inArray(bookingsTable.status, [...OPEN_STATUSES]),
  )).returning();
  if (!updated.length) return;
  await db.update(bookingSessionsTable).set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.bookingId, booking.id));

  if (booking.clientTelegramId) {
    await send(booking.clientTelegramId, autoClientText());
  }
  if (barber.telegramId) {
    await send(barber.telegramId, autoBarberText(booking.startTime.slice(0, 5), booking.clientName));
  }
  console.log(`[ClientNotify] auto-cancelled ${booking.id}`);
}

export async function runClientNotificationCycle(now = Date.now()): Promise<void> {
  if (!token()) return;
  const clock = tashkentNow(now);
  const tomorrow = addDays(clock.date, 1);

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
    const ageMin = (now - new Date(booking.createdAt).getTime()) / 60000;

    if (!booking.clientConfirmed && minutesLeft <= 60 && minutesLeft > -180 && ageMin >= 5) {
      await cancelUnconfirmed(booking, barber);
      continue;
    }

    if (
      clock.hour === 20 &&
      booking.date === tomorrow &&
      !booking.reminded24h
    ) {
      const ok = await send(booking.clientTelegramId, reminder24Text(barber, service, booking.date, time), {
        reply_markup: confirmKeyboard(booking.id, "✅ Ha, boraman"),
      });
      if (ok) {
        await db.update(bookingsTable).set({ reminded24h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }

    if (
      !booking.clientConfirmed &&
      !booking.remindedFollowup &&
      ageMin >= 5 &&
      minutesLeft <= 180 &&
      minutesLeft > 65
    ) {
      const ok = await send(booking.clientTelegramId, followupText(), {
        reply_markup: confirmKeyboard(booking.id, "✅ Ha, boraman"),
      });
      if (ok) {
        await db.update(bookingsTable).set({ remindedFollowup: true }).where(eq(bookingsTable.id, booking.id));
      }
    }

    if (booking.clientConfirmed && !booking.reminded1h && minutesLeft <= 65 && minutesLeft >= 55) {
      const ok = await send(booking.clientTelegramId, reminder1hText(barber, time));
      if (ok) {
        await db.update(bookingsTable).set({ reminded1h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }
  }
}

export function isClientCallback(data: string): "confirm" | "cancel" | null {
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
        mapLink: user.mapLink || barber.mapLink,
        phone: user.phone || barber.phone,
      };
    }
  } catch {
    // Sample salon details are enough.
  }

  const previewButtons = {
    inline_keyboard: [[
      { text: "✅ Ha, boraman", callback_data: "client_reminder_preview_confirm" },
      { text: "❌ Bekor qilish", callback_data: "client_reminder_preview_cancel" },
    ]],
  };
  const receiptButtons = {
    inline_keyboard: [[
      { text: "✅ Tasdiqlash", callback_data: "client_reminder_preview_confirm" },
      { text: "❌ Bekor qilish", callback_data: "client_reminder_preview_cancel" },
    ]],
  };

  await send(id, "Bu sinov. Haqiqiy mijozga xabar ketmadi va hech qanday bron o'zgarmaydi.");
  await send(id, receiptText(barber, "Soch olish", tashkentNow().date, "15:00"), {
    reply_markup: receiptButtons,
  });
  await send(id, reminder24Text(barber, "Soch olish", addDays(tashkentNow().date, 1), "15:00"), {
    reply_markup: previewButtons,
  });
  await send(id, followupText(), { reply_markup: previewButtons });
  await send(id, reminder1hText(barber, "15:00"));
}
