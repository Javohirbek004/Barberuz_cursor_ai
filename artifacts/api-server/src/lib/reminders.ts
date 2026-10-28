/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and dispatches:
 *
 *  BARBER:
 *   — Today's schedule, one hour before that day's opening time
 *
 *  CLIENT:
 *   Handled in client-notifications.ts (receipt, 20:00 reminder, follow-up, 1h).
 *
 * The morning schedule is stored on the barber, so a restart does not send it twice.
 * It goes only to that barber's Telegram chat, never to a client.
 */

import { db, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, isNull, or, ne } from "drizzle-orm";
import { expirePendingHolds } from "./booking-conflicts";
import { runClientNotificationCycle } from "./client-notifications";
import { getTelegramBotToken } from "./telegram-token";
import { barberEntryMarkup } from "./barber-entry-keyboard";
import { buildBarberMorningSummary, dayWorkStartMinutes, isHourBeforeWork, uzDateLabel } from "./morning-digest";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function getToken(): string {
  return getTelegramBotToken();
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  const entryMarkup = extra.reply_markup ? null : await barberEntryMarkup(chatId);
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
        ...(entryMarkup ? { reply_markup: entryMarkup } : {}),
      }),
    });
    const json = await res.json() as { ok?: boolean };
    return json.ok === true;
  } catch (err) {
    console.error("[Reminders] sendTelegramMessage failed:", err);
    return false;
  }
}

const sentReminders = new Set<string>();

function nowInTashkent(): { hour: number; minute: number; dateStr: string } {
  const tashkent = new Date(Date.now() + TASHKENT_UTC_OFFSET_MS);
  return {
    hour:    tashkent.getUTCHours(),
    minute:  tashkent.getUTCMinutes(),
    dateStr: tashkent.toISOString().split("T")[0]!,
  };
}

async function checkAndSendReminders(): Promise<void> {
  const token = getToken();
  if (!token) return;

  const nowMs = Date.now();
  const { hour, minute, dateStr: todayStr } = nowInTashkent();

  try {
    await expirePendingHolds();
    await runClientNotificationCycle(nowMs);

    await sendDueMorningDigests(todayStr, hour * 60 + minute);
  } catch (err) {
    console.error("[Reminders] checkAndSendReminders error:", err);
  }
}

async function sendDueMorningDigests(todayStr: string, nowMinutes: number): Promise<void> {
  const allBarbers = await db
    .select({
      id: usersTable.id,
      telegramId: usersTable.telegramId,
      morningDigestOn: usersTable.morningDigestOn,
      workingHoursStart: usersTable.workingHoursStart,
      scheduleJson: usersTable.scheduleJson,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.role, "barber"),
      isNull(usersTable.deletedAt),
    ));

  const due = allBarbers.filter((barberUser) => {
    if (!barberUser.telegramId) return false;
    const summaryKey = `morning_${todayStr}_${barberUser.id}`;
    if (sentReminders.has(summaryKey) || barberUser.morningDigestOn === todayStr) return false;
    const start = dayWorkStartMinutes(todayStr, barberUser.workingHoursStart, barberUser.scheduleJson);
    return start != null && isHourBeforeWork(nowMinutes, start);
  });
  if (!due.length) return;

  const todayBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.date, todayStr),
      inArray(bookingsTable.status, ["confirmed", "pending"]),
      isNull(bookingsTable.deletedAt),
    ));

  const byBarber = new Map<string, typeof todayBookings>();
  for (const bk of todayBookings) {
    if (!byBarber.has(bk.barberId)) byBarber.set(bk.barberId, []);
    byBarber.get(bk.barberId)!.push(bk);
  }

  const dateLabel = uzDateLabel(todayStr);
  for (const barberUser of due) {
    const summaryKey = `morning_${todayStr}_${barberUser.id}`;
    const claimed = await db
      .update(usersTable)
      .set({ morningDigestOn: todayStr })
      .where(and(
        eq(usersTable.id, barberUser.id),
        eq(usersTable.role, "barber"),
        or(isNull(usersTable.morningDigestOn), ne(usersTable.morningDigestOn, todayStr)),
      ))
      .returning({ id: usersTable.id });
    if (!claimed.length) continue;
    sentReminders.add(summaryKey);

    const text = buildBarberMorningSummary(dateLabel, (byBarber.get(barberUser.id) ?? []).map(bk => ({
      time: bk.startTime,
      clientName: bk.clientName,
      serviceName: bk.serviceName ?? null,
    })));
    const sent = await sendTelegramMessage(barberUser.telegramId!, text);
    if (!sent) {
      sentReminders.delete(summaryKey);
      await db.update(usersTable)
        .set({ morningDigestOn: null })
        .where(and(eq(usersTable.id, barberUser.id), eq(usersTable.morningDigestOn, todayStr)));
      continue;
    }
    console.log(`[Reminders] morning_summary sent: barberId=${barberUser.id}`);
  }
}

/** One preview so the barber can see the layout. Not counted as today's real schedule. */
async function sendMorningPreviewOnce(): Promise<void> {
  if (!getToken()) return;
  const todayStr = nowInTashkent().dateStr;
  const text = [
    "<i>Namuna. Haqiqiy xabar ish vaqtingizdan 1 soat oldin shu ko‘rinishda keladi.</i>",
    "",
    buildBarberMorningSummary(uzDateLabel(todayStr), [
      { time: "10:00", clientName: "Ali", serviceName: "Soch olish" },
      { time: "12:30", clientName: "Vali", serviceName: "Soqol" },
    ]),
  ].join("\n");

  const barbers = await db
    .select({ id: usersTable.id, telegramId: usersTable.telegramId, morningSampleSent: usersTable.morningSampleSent })
    .from(usersTable)
    .where(and(eq(usersTable.role, "barber"), isNull(usersTable.deletedAt)));

  for (const barberUser of barbers) {
    if (!barberUser.telegramId || barberUser.morningSampleSent) continue;
    const claimed = await db
      .update(usersTable)
      .set({ morningSampleSent: true })
      .where(and(
        eq(usersTable.id, barberUser.id),
        eq(usersTable.morningSampleSent, false),
      ))
      .returning({ id: usersTable.id });
    if (!claimed.length) continue;
    const sent = await sendTelegramMessage(barberUser.telegramId, text);
    if (!sent) {
      await db.update(usersTable)
        .set({ morningSampleSent: false })
        .where(eq(usersTable.id, barberUser.id));
      continue;
    }
    console.log(`[Reminders] morning_sample sent: barberId=${barberUser.id}`);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderJob(): void {
  if (reminderInterval) return;
  console.log("[Reminders] Starting reminder job (60s interval)");
  reminderInterval = setInterval(() => {
    checkAndSendReminders().catch(err =>
      console.error("[Reminders] Unhandled error:", err),
    );
  }, 60 * 1000);
  checkAndSendReminders().catch(() => {});
  sendMorningPreviewOnce().catch(err =>
    console.error("[Reminders] morning sample failed:", err),
  );
}

export function stopReminderJob(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

