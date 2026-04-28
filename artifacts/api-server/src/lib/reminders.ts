/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and sends Telegram reminders to the BARBER:
 *  - 30 minutes before appointment (barber is notified about upcoming client)
 *
 * Reminder state is tracked in-memory using a Set of `sessionId:window` keys
 * to avoid duplicate sends across runs.
 */

import { db, bookingSessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("[Reminders] sendTelegramMessage failed:", err);
  }
}

const sentReminders = new Set<string>();

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

function parseBookingDateTime(data: BookingData): Date | null {
  try {
    let dateStr = data.date;

    if (dateStr === "today" || dateStr === "bugun") {
      const now = new Date();
      dateStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    } else if (dateStr === "tomorrow" || dateStr === "ertaga") {
      const now = new Date();
      now.setDate(now.getDate() + 1);
      dateStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    }

    const [hours, minutes] = data.time.split(":").map(Number);
    const dt = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+05:00`);
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

function buildBarberReminderText(
  clientName: string,
  clientPhone: string | null,
  data: BookingData,
): string {
  const serviceNames = data.services.map(s => s.name).join(", ");
  const phoneLine = clientPhone ? `\n\uD83D\uDCDE ${clientPhone}` : "";
  return (
    `\u23F0 <b>Eslatma!</b>\n\n` +
    `30 daqiqadan keyin mijozingiz bor:\n\n` +
    `\uD83D\uDC64 ${clientName}` +
    `${phoneLine}\n` +
    `\uD83D\uDD52 ${data.time} (Bugun)\n` +
    `\u2702\uFE0F ${serviceNames}`
  );
}

async function checkAndSendReminders(): Promise<void> {
  const token = getToken();
  if (!token) return;

  try {
    const sessions = await db
      .select()
      .from(bookingSessionsTable)
      .where(eq(bookingSessionsTable.status, "confirmed"));

    const nowMs = Date.now();

    // Collect unique barberIds to batch-lookup telegramIds
    const barberIds = [...new Set(sessions.map(s => s.barberId))];
    const barberMap = new Map<string, string | null>();
    for (const barberId of barberIds) {
      try {
        const [barber] = await db
          .select({ telegramId: usersTable.telegramId })
          .from(usersTable)
          .where(eq(usersTable.id, barberId))
          .limit(1);
        barberMap.set(barberId, barber?.telegramId ?? null);
      } catch {
        barberMap.set(barberId, null);
      }
    }

    for (const session of sessions) {
      const barberTelegramId = barberMap.get(session.barberId);
      if (!barberTelegramId) continue;

      let data: BookingData;
      try {
        data = JSON.parse(session.bookingData) as BookingData;
      } catch {
        continue;
      }

      const appointmentDt = parseBookingDateTime(data);
      if (!appointmentDt) continue;

      const diffMinutes = (appointmentDt.getTime() - nowMs) / 60000;

      const key = `${session.sessionId}:30`;
      if (sentReminders.has(key)) continue;

      if (diffMinutes <= 30 && diffMinutes > 25) {
        const clientName = session.clientName?.split(" ")[0] || "Mijoz";
        const text = buildBarberReminderText(clientName, session.clientPhone || null, data);
        await sendTelegramMessage(barberTelegramId, text);
        sentReminders.add(key);
        console.log(`[Bot:reminder_sent] ${JSON.stringify({ sessionId: session.sessionId, barberId: session.barberId, telegramId: barberTelegramId })}`);
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
