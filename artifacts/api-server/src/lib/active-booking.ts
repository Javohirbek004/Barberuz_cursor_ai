/**
 * A client may keep only one upcoming booking.
 * This file finds that booking and moves or cancels it.
 * Reminder texts are not changed here.
 */

import { db, bookingsTable, bookingSessionsTable, clientsTable, usersTable } from "@workspace/db";
import { and, asc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { normalizeCancelLimit } from "./client-notifications";
import { syncClientMetrics } from "./client-metrics";
import { findBookingConflict, minsToTime, parseClockTime, timeToMins } from "./booking-conflicts";
import { phoneKey } from "./phone";
import { slotOutsideWorkingHours } from "./schedule-guard";
import { getTelegramBotToken } from "./telegram-token";

const OPEN = ["pending", "confirmed"] as const;

export type ActiveBookingCard = {
  id: string;
  master: string;
  service: string;
  date: string;
  time: string;
  price: number;
  canCancel: boolean;
  canMove: boolean;
  contactPhone: string | null;
  phone: string | null;
};

type ActiveRow = {
  id: string;
  barberId: string;
  clientId: string | null;
  serviceName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  price: string;
  clientTelegramId: string | null;
  notes: string | null;
  clientName: string;
  clientPhone: string | null;
  clientTelegram: string | null;
  barberTelegram: string | null;
  masterName: string;
  brandName: string | null;
  barberPhone: string | null;
  phoneVisible: boolean;
  cancelLimit: number;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  scheduleJson: string | null;
  lunchBreakEnabled: boolean;
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
  bufferTime: number;
};

function tashkentToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

function appointmentMs(date: string, time: string): number {
  const clock = parseClockTime(time) || "00:00";
  return new Date(`${date}T${clock}:00+05:00`).getTime();
}

function personOwns(row: ActiveRow, phone: string | null, telegramId: string | null): boolean {
  const tg = (telegramId || "").replace(/\D/g, "");
  if (tg && (row.clientTelegramId === tg || row.clientTelegram === tg)) return true;
  const key = phoneKey(phone);
  if (!key) return false;
  return phoneKey(row.clientPhone) === key || phoneKey(row.notes) === key;
}

function toCard(row: ActiveRow): ActiveBookingCard {
  const time = (parseClockTime(row.startTime) || row.startTime).slice(0, 5);
  const minutesLeft = (appointmentMs(row.date, time) - Date.now()) / 60000;
  const canCancel = minutesLeft > normalizeCancelLimit(row.cancelLimit);
  const phone = row.phoneVisible !== false && row.barberPhone?.trim() ? row.barberPhone.trim() : null;
  const contactPhone = !canCancel ? phone : null;
  return {
    id: row.id,
    master: row.brandName?.trim() || row.masterName?.trim() || "Usta",
    service: row.serviceName?.trim() || "Xizmat",
    date: row.date,
    time,
    price: Math.round(Number(row.price) || 0),
    canCancel,
    canMove: minutesLeft >= 60,
    contactPhone,
    phone,
  };
}

const activeSelect = {
  id: bookingsTable.id,
  barberId: bookingsTable.barberId,
  clientId: bookingsTable.clientId,
  serviceName: bookingsTable.serviceName,
  date: bookingsTable.date,
  startTime: bookingsTable.startTime,
  endTime: bookingsTable.endTime,
  price: bookingsTable.price,
  clientTelegramId: bookingsTable.clientTelegramId,
  notes: bookingsTable.notes,
  clientName: bookingsTable.clientName,
  clientPhone: clientsTable.phone,
  clientTelegram: clientsTable.telegramId,
  barberTelegram: usersTable.telegramId,
  masterName: usersTable.name,
  brandName: usersTable.brandName,
  barberPhone: usersTable.phone,
  phoneVisible: usersTable.phoneVisible,
  cancelLimit: usersTable.clientCancelLimit,
  workingHoursStart: usersTable.workingHoursStart,
  workingHoursEnd: usersTable.workingHoursEnd,
  scheduleJson: usersTable.scheduleJson,
  lunchBreakEnabled: usersTable.lunchBreakEnabled,
  lunchBreakStart: usersTable.lunchBreakStart,
  lunchBreakEnd: usersTable.lunchBreakEnd,
  bufferTime: usersTable.bufferTime,
};

export async function findUpcomingBooking(input: {
  phone: string | null;
  telegramId: string | null;
}): Promise<ActiveBookingCard | null> {
  const key = phoneKey(input.phone);
  const tg = (input.telegramId || "").replace(/\D/g, "");
  if (!key && !tg) return null;

  const matchers = [];
  if (tg) {
    matchers.push(eq(bookingsTable.clientTelegramId, tg));
    matchers.push(eq(clientsTable.telegramId, tg));
  }
  if (key) {
    matchers.push(sql`right(regexp_replace(coalesce(${clientsTable.phone}, ''), '[^0-9]', '', 'g'), 9) = ${key}`);
    matchers.push(sql`right(regexp_replace(coalesce(${bookingsTable.notes}, ''), '[^0-9]', '', 'g'), 9) = ${key}`);
  }

  const rows = await db
    .select(activeSelect)
    .from(bookingsTable)
    .leftJoin(clientsTable, eq(bookingsTable.clientId, clientsTable.id))
    .innerJoin(usersTable, eq(bookingsTable.barberId, usersTable.id))
    .where(and(
      isNull(bookingsTable.deletedAt),
      isNull(usersTable.deletedAt),
      inArray(bookingsTable.status, [...OPEN]),
      gte(bookingsTable.date, tashkentToday()),
      or(...matchers),
    ))
    .orderBy(asc(bookingsTable.date), asc(bookingsTable.startTime))
    .limit(12);

  const now = Date.now();
  const upcoming = rows.find((row: ActiveRow) => appointmentMs(row.date, row.startTime) > now);
  return upcoming ? toCard(upcoming) : null;
}

async function loadOwned(bookingId: string, phone: string | null, telegramId: string | null): Promise<ActiveRow | null> {
  const [row] = await db
    .select(activeSelect)
    .from(bookingsTable)
    .leftJoin(clientsTable, eq(bookingsTable.clientId, clientsTable.id))
    .innerJoin(usersTable, eq(bookingsTable.barberId, usersTable.id))
    .where(and(
      eq(bookingsTable.id, bookingId),
      isNull(bookingsTable.deletedAt),
      inArray(bookingsTable.status, [...OPEN]),
    ))
    .limit(1);
  if (!row || !personOwns(row, phone, telegramId)) return null;
  if (appointmentMs(row.date, row.startTime) <= Date.now()) return null;
  return row;
}

export async function assertClientMayReplace(input: {
  bookingId: string;
  phone: string | null;
  telegramId: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const row = await loadOwned(input.bookingId, input.phone, input.telegramId);
  if (!row) return { ok: false, status: 404, message: "Faol bron topilmadi" };
  const card = toCard(row);
  if (!card.canCancel) {
    const phoneLine = card.contactPhone ? ` Aloqa: ${card.contactPhone}` : "";
    return { ok: false, status: 403, message: `Bekor qilish vaqti tugagan.${phoneLine}` };
  }
  return { ok: true };
}

export async function cancelBookingRecord(bookingId: string): Promise<void> {
  const [row] = await db
    .select({ clientId: bookingsTable.clientId, barberId: bookingsTable.barberId })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  await db.update(bookingsTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, bookingId));
  await db.update(bookingSessionsTable).set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.bookingId, bookingId));
  if (row) await syncClientMetrics(row.clientId, row.barberId);
}

export async function moveOwnedBooking(input: {
  bookingId: string;
  phone: string | null;
  telegramId: string | null;
  date: string;
  time: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const row = await loadOwned(input.bookingId, input.phone, input.telegramId);
  if (!row) return { ok: false, status: 404, message: "Faol bron topilmadi" };
  const minutesLeft = (appointmentMs(row.date, row.startTime) - Date.now()) / 60000;
  if (minutesLeft < 60) {
    return {
      ok: false,
      status: 403,
      message: "Belgilangan vaqtga 1 soatdan kam qolgani sababli vaqtni o‘zgartirib bo‘lmaydi. Iltimos, usta bilan bog‘laning.",
    };
  }

  const startTime = parseClockTime(input.time);
  if (!startTime || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, status: 400, message: "Vaqt noto'g'ri" };
  }

  const duration = Math.max(timeToMins(row.endTime) - timeToMins(row.startTime), 1);
  const endTime = minsToTime(Math.min(timeToMins(startTime) + duration, 24 * 60 - 1));
  const hoursError = slotOutsideWorkingHours({
    isoDate: input.date,
    startTime,
    durationMins: duration,
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    scheduleJson: row.scheduleJson,
    lunchBreakEnabled: row.lunchBreakEnabled,
    lunchBreakStart: row.lunchBreakStart,
    lunchBreakEnd: row.lunchBreakEnd,
  });
  if (hoursError) return { ok: false, status: 400, message: hoursError };

  const clash = await findBookingConflict({
    barberId: row.barberId,
    date: input.date,
    startTime,
    endTime,
    bufferMins: typeof row.bufferTime === "number" ? row.bufferTime : 10,
    exceptBookingId: row.id,
  });
  if (clash) return { ok: false, status: 409, message: "Tanlangan vaqt allaqachon band" };

  const previous = { date: row.date, time: (parseClockTime(row.startTime) || row.startTime).slice(0, 5) };
  await db.update(bookingsTable).set({
    date: input.date,
    startTime,
    endTime,
    reminded24h: false,
    reminded1h: false,
    remindedFollowup: false,
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, row.id));

  notifyMove(row, previous, { date: input.date, time: startTime }).catch((err) => {
    console.error("[ActiveBooking] move notice failed:", err);
  });

  return { ok: true };
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function uzWhen(date: string, time: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day}-${MONTHS[(month || 1) - 1]}, ${time}`;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = getTelegramBotToken();
  if (!token || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error("[ActiveBooking] telegram send failed:", res.status);
  }
}

async function notifyMove(
  row: ActiveRow,
  previous: { date: string; time: string },
  next: { date: string; time: string },
): Promise<void> {
  const master = row.brandName?.trim() || row.masterName?.trim() || "Usta";
  const service = row.serviceName?.trim() || "Xizmat";
  const price = Math.round(Number(row.price) || 0).toLocaleString("ru-RU");
  const oldWhen = uzWhen(previous.date, previous.time);
  const newWhen = uzWhen(next.date, next.time);
  const clientChat = row.clientTelegramId || row.clientTelegram;
  if (clientChat) {
    await sendTelegram(clientChat, [
      "🔄 <b>Broningiz vaqti o‘zgartirildi!</b>",
      "",
      `👤 Usta: ${esc(master)}`,
      `✂️ Xizmat: ${esc(service)}`,
      `💵 Narx: ${esc(price)} so'm`,
      `📅 Eski vaqt: ${esc(oldWhen)}`,
      `📅 Yangi vaqt: ${esc(newWhen)}`,
    ].join("\n"));
  }
  if (row.barberTelegram) {
    await sendTelegram(row.barberTelegram, [
      "🔄 <b>Mijoz bron vaqtini o‘zgartirdi</b>",
      "",
      `👤 Mijoz: ${esc(row.clientName || "Mijoz")}`,
      `✂️ Xizmat: ${esc(service)}`,
      `📅 Eski vaqt: ${esc(oldWhen)}`,
      `📅 Yangi vaqt: ${esc(newWhen)}`,
    ].join("\n"));
  }
}
