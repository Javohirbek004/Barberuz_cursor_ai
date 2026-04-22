/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and sends Telegram reminders to customers:
 *  - 1 hour before appointment
 *  - 10 minutes before appointment (optional)
 *
 * Reminder state is tracked in-memory using a Set of `sessionId:window` keys
 * to avoid duplicate sends across runs.
 */

import { db, bookingSessionsTable } from "@workspace/db";
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

function buildReminderText(firstName: string, data: BookingData, minutesBefore: number): string {
  const barberLine = data.isTeam && data.teamBarberName
    ? `\n🧑‍🦱 Usta: <b>${data.teamBarberName}</b>`
    : "";
  const mapLine = data.mapLink
    ? `\n📍 <a href="${data.mapLink}">Manzilni ko'rish</a>`
    : data.barberAddress
    ? `\n📍 ${data.barberAddress}`
    : "";

  return minutesBefore === 60
    ? `⏰ <b>Eslatma!</b>\n\n${firstName}, sizning navbatingiz <b>1 soatdan so'ng</b>:${barberLine}\n🕒 Vaqt: <b>${data.time}</b>${mapLine}`
    : `⏰ <b>Eslatma!</b>\n\n${firstName}, sizning navbatingiz <b>10 daqiqadan so'ng</b>:${barberLine}\n🕒 Vaqt: <b>${data.time}</b>${mapLine}\n\n⚡ Iltimos, belgilangan vaqtga ulgurib keling!`;
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

    for (const session of sessions) {
      if (!session.clientTelegramId) continue;

      let data: BookingData;
      try {
        data = JSON.parse(session.bookingData) as BookingData;
      } catch {
        continue;
      }

      const appointmentDt = parseBookingDateTime(data);
      if (!appointmentDt) continue;

      const diffMinutes = (appointmentDt.getTime() - nowMs) / 60000;

      const firstName = session.clientName?.split(" ")[0] || "Mijoz";

      for (const window of [60, 10] as const) {
        const key = `${session.sessionId}:${window}`;
        if (sentReminders.has(key)) continue;

        if (diffMinutes <= window && diffMinutes > window - 5) {
          const text = buildReminderText(firstName, data, window);
          await sendTelegramMessage(session.clientTelegramId, text);
          sentReminders.add(key);
          console.log(`[Reminders] Sent ${window}min reminder to ${session.clientTelegramId} (session ${session.sessionId})`);
        }
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
