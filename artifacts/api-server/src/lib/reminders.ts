/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and dispatches:
 *
 *  BARBER:
 *   — 15-min upcoming-client alert (replaces old 30-min)
 *   — Morning digest at 08:30 Tashkent time with today's full schedule
 *
 *  CLIENT (requires clientTelegramId on the session):
 *   — 24h-before reminder with "Confirm" / "Cancel" inline buttons
 *   — 1h-before final alert with location/map link
 *
 * Reminder state is tracked in-memory via sentReminders Set (key = sessionId:window).
 * Server restarts clear the set; reminders won't re-fire within the same time window.
 */

import { db, bookingSessionsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
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
      dateStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    } else if (dateStr === "tomorrow" || dateStr === "ertaga") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dateStr = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    }
    const [hours, minutes] = data.time.split(":").map(Number);
    const dt = new Date(
      `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+05:00`,
    );
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

function nowInTashkent(): { hour: number; minute: number; dateStr: string } {
  const tashkent = new Date(Date.now() + TASHKENT_UTC_OFFSET_MS);
  return {
    hour:    tashkent.getUTCHours(),
    minute:  tashkent.getUTCMinutes(),
    dateStr: tashkent.toISOString().split("T")[0]!,
  };
}

function buildBarber15MinText(
  clientName: string,
  clientPhone: string | null,
  data: BookingData,
  notes?: string | null,
): string {
  const serviceNames = data.services.map(s => s.name).join(", ");
  const phoneLine    = clientPhone ? `\n\uD83D\uDCDE ${clientPhone}` : "";
  const notesLine    = notes       ? `\n\uD83D\uDCDD Eslatma: ${notes}` : "";
  return (
    `\u26A1\uFE0F <b>Keyingi mijozingizga 15 daqiqa qoldi!</b>\n\n` +
    `\uD83D\uDC64 Mijoz: ${clientName}${phoneLine}\n` +
    `\u2702\uFE0F Xizmat: ${serviceNames}\n` +
    `\uD83D\uDD50 Vaqt: <b>${data.time}</b>` +
    notesLine
  );
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

function buildClient24hText(clientName: string, data: BookingData): string {
  const serviceNames  = data.services.map(s => s.name).join(", ");
  const addressLine   = data.barberAddress ? `\n\uD83D\uDCCD Manzil: ${data.barberAddress}` : "";
  return (
    `\u23F0 <b>Eslatma!</b> Ertaga navbatingiz bor!\n\n` +
    `\uD83D\uDC88 ${data.barberName}\n` +
    `\u2702\uFE0F Xizmat: ${serviceNames}\n` +
    `\uD83D\uDD50 Vaqt: <b>${data.time}</b>` +
    `${addressLine}\n\n` +
    `Tasdiqlaysizmi?`
  );
}

function buildClient1hText(data: BookingData): string {
  const addressLine = data.barberAddress ? `\n\uD83D\uDCCD Manzil: ${data.barberAddress}` : "";
  const mapLine     = data.mapLink       ? `\n\uD83D\uDDFA ${data.mapLink}`               : "";
  return (
    `\u2702\uFE0F <b>Eslatma:</b> Broningizga <b>1 soat</b> qoldi!\n\n` +
    `\uD83D\uDD50 Soat <b>${data.time}</b> da` +
    `${addressLine}` +
    `${mapLine}\n\n` +
    `Kutamiz! \u2702\uFE0F`
  );
}

async function checkAndSendReminders(): Promise<void> {
  const token = getToken();
  if (!token) return;

  const nowMs = Date.now();
  const { hour, minute, dateStr: todayStr } = nowInTashkent();

  try {
    // ── Session-based reminders (barber 15-min + client 24h/1h) ─────────────
    const sessions = await db
      .select()
      .from(bookingSessionsTable)
      .where(eq(bookingSessionsTable.status, "confirmed"));

    const barberIds = [...new Set(sessions.map(s => s.barberId))];
    const barberMap = new Map<string, { telegramId: string | null; name: string; phone: string | null }>();
    for (const barberId of barberIds) {
      try {
        const [b] = await db
          .select({ telegramId: usersTable.telegramId, name: usersTable.name, phone: usersTable.phone })
          .from(usersTable)
          .where(eq(usersTable.id, barberId))
          .limit(1);
        barberMap.set(barberId, {
          telegramId: b?.telegramId ?? null,
          name:       b?.name ?? "Barber",
          phone:      b?.phone ?? null,
        });
      } catch {
        barberMap.set(barberId, { telegramId: null, name: "Barber", phone: null });
      }
    }

    for (const session of sessions) {
      const barber = barberMap.get(session.barberId);

      let data: BookingData;
      try { data = JSON.parse(session.bookingData) as BookingData; } catch { continue; }

      const appointmentDt = parseBookingDateTime(data);
      if (!appointmentDt) continue;

      const diffMinutes = (appointmentDt.getTime() - nowMs) / 60000;

      // ── Barber 15-min reminder ──────────────────────────────────────────
      if (barber?.telegramId) {
        const key = `${session.sessionId}:barber_15`;
        if (!sentReminders.has(key) && diffMinutes <= 15 && diffMinutes > 10) {
          const clientName = session.clientName?.split(" ")[0] || "Mijoz";
          const text = buildBarber15MinText(clientName, session.clientPhone ?? null, data);
          await sendTelegramMessage(barber.telegramId, text);
          sentReminders.add(key);
          console.log(`[Reminders] barber_15min sent: ${session.sessionId}`);
        }
      }

      // ── Client 24h reminder ─────────────────────────────────────────────
      if (session.clientTelegramId) {
        const key24 = `${session.sessionId}:client_24h`;
        if (!sentReminders.has(key24) && diffMinutes <= 24 * 60 && diffMinutes > 23 * 60) {
          const clientName = session.clientName?.split(" ")[0] || "Mijoz";
          const text = buildClient24hText(clientName, data);
          await sendTelegramMessage(session.clientTelegramId, text, {
            reply_markup: {
              inline_keyboard: [[
                { text: "\u2705 Tasdiqlash",    callback_data: `client_reminder_confirm_${session.sessionId}` },
                { text: "\u274C Bekor qilish", callback_data: `client_reminder_cancel_${session.sessionId}` },
              ]],
            },
          });
          sentReminders.add(key24);
          console.log(`[Reminders] client_24h sent: ${session.sessionId}`);
        }

        // ── Client 1h final reminder ────────────────────────────────────
        const key1h = `${session.sessionId}:client_1h`;
        if (!sentReminders.has(key1h) && diffMinutes <= 60 && diffMinutes > 55) {
          const text = buildClient1hText(data);
          await sendTelegramMessage(session.clientTelegramId, text);
          sentReminders.add(key1h);
          console.log(`[Reminders] client_1h sent: ${session.sessionId}`);
        }
      }
    }

    // ── Barber morning summary (08:30–08:34 Tashkent) ────────────────────────
    if (hour === 8 && minute >= 30 && minute <= 34) {
      const todayBookings = await db
        .select()
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.date, todayStr),
          eq(bookingsTable.status, "confirmed"),
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
