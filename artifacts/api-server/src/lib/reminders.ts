/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and dispatches:
 *
 *  BARBER:
 *   — Morning digest at 08:30 Tashkent time with today's full schedule
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
import { buildBarberMorningSummary, uzDateLabel } from "./morning-digest";

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

    // ── Barber morning summary (08:30–08:34 Tashkent) ────────────────────────
    if (hour === 8 && minute >= 30 && minute <= 34) {
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

      // Also include barbers who have telegramId but no bookings today
      // Query all barbers with telegramId
      const allBarbers = await db
        .select({
          id: usersTable.id,
          telegramId: usersTable.telegramId,
          morningDigestOn: usersTable.morningDigestOn,
        })
        .from(usersTable)
        .where(and(
          eq(usersTable.role, "barber"),
          isNull(usersTable.deletedAt),
        ));

      const dateLabel = uzDateLabel(todayStr);
      for (const barberUser of allBarbers) {
        if (!barberUser.telegramId) continue;
        const summaryKey = `morning_${todayStr}_${barberUser.id}`;
        if (sentReminders.has(summaryKey) || barberUser.morningDigestOn === todayStr) continue;

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

        const barberBookings = byBarber.get(barberUser.id) ?? [];
        const text = buildBarberMorningSummary(dateLabel, barberBookings.map(bk => ({
          time:        bk.startTime,
          clientName:  bk.clientName,
          serviceName: bk.serviceName ?? null,
        })));
        const sent = await sendTelegramMessage(barberUser.telegramId, text);
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
  } catch (err) {
    console.error("[Reminders] checkAndSendReminders error:", err);
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
}

export function stopReminderJob(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

