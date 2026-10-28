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
 * Reminder state is tracked in-memory via sentReminders Set (key = sessionId:window).
 * Server restarts clear the set; reminders won't re-fire within the same time window.
 */

import { db, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { expirePendingHolds } from "./booking-conflicts";
import { runClientNotificationCycle } from "./client-notifications";
import { getTelegramBotToken } from "./telegram-token";
import { barberEntryMarkup } from "./barber-entry-keyboard";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function getToken(): string {
  return getTelegramBotToken();
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const token = getToken();
  if (!token) return;
  const entryMarkup = extra.reply_markup ? null : await barberEntryMarkup(chatId);
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
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
  } catch (err) {
    console.error("[Reminders] sendTelegramMessage failed:", err);
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

function buildBarberMorningSummary(
  barberFirstName: string,
  bookings: { time: string; clientName: string; serviceName: string | null }[],
): string {
  if (bookings.length === 0) {
    return (
      `\u2600\uFE0F <b>Xayrli tong, ${barberFirstName}!</b>\n\n` +
      `Bugun uchun hech qanday bron yo\u02BBq. Dam oling! \uD83D\uDE0A`
    );
  }
  const sorted = [...bookings].sort((a, b) => a.time.localeCompare(b.time));
  const lines  = sorted
    .map(b => `  \uD83D\uDD50 ${b.time} \u2014 ${b.clientName}${b.serviceName ? ` (${b.serviceName})` : ""}`)
    .join("\n");
  return (
    `\u2600\uFE0F <b>Xayrli tong, ${barberFirstName}!</b>\n\n` +
    `\uD83D\uDCC5 <b>Bugungi jadval (${bookings.length} ta bron):</b>\n\n` +
    `${lines}\n\n` +
    `Muvaffaqiyatli ish kuni! \uD83D\uDC88`
  );
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
        ));

      const byBarber = new Map<string, typeof todayBookings>();
      for (const bk of todayBookings) {
        if (!byBarber.has(bk.barberId)) byBarber.set(bk.barberId, []);
        byBarber.get(bk.barberId)!.push(bk);
      }

      // Also include barbers who have telegramId but no bookings today
      // Query all barbers with telegramId
      const allBarbers = await db
        .select({ id: usersTable.id, telegramId: usersTable.telegramId, name: usersTable.name })
        .from(usersTable)
        .where(and(
          eq(usersTable.role, "barber"),
          isNull(usersTable.deletedAt),
        ));

      for (const barberUser of allBarbers) {
        if (!barberUser.telegramId) continue;
        const summaryKey = `morning_${todayStr}_${barberUser.id}`;
        if (sentReminders.has(summaryKey)) continue;

        const barberBookings = byBarber.get(barberUser.id) ?? [];
        const bookingList = barberBookings.map(bk => ({
          time:        bk.startTime,
          clientName:  bk.clientName,
          serviceName: bk.serviceName ?? null,
        }));

        const firstName = barberUser.name?.split(" ")[0] || "Barber";
        const text = buildBarberMorningSummary(firstName, bookingList);
        await sendTelegramMessage(barberUser.telegramId, text);
        sentReminders.add(summaryKey);
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

