/**
 * Reminder system for confirmed bookings.
 *
 * Runs every 60 seconds and dispatches:
 *
 *  BARBER:
 *   — 15-min upcoming-client alert (replaces old 30-min)
 *   — Morning digest at 08:30 Tashkent time with today's full schedule
 *
 *  CLIENT:
 *   Handled in client-notifications.ts (receipt, 20:00 reminder, follow-up, 1h, auto-cancel).
 *
 * Reminder state is tracked in-memory via sentReminders Set (key = sessionId:window).
 * Server restarts clear the set; reminders won't re-fire within the same time window.
 */

import { randomBytes } from "crypto";
import { db, bookingSessionsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { findBookingConflict, minsToTime, timeToMins } from "./booking-conflicts";
import { runClientNotificationCycle } from "./client-notifications";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
    });
    return res.ok;
  } catch (err) {
    console.error("[Reminders] sendTelegramMessage failed:", err);
    return false;
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

export function remainingMinutesFromDiff(diffMinutes: number): number {
  return Math.min(15, Math.max(1, Math.round(diffMinutes)));
}

/** Wall-clock date/time in Tashkent that the reminder will read as `minutes` left. */
export function pickClockForRemainingMinutes(
  minutes: number,
  nowMs = Date.now(),
): { date: string; time: string; remainingMinutes: number } {
  const wanted = remainingMinutesFromDiff(minutes);
  let probe = nowMs + wanted * 60 * 1000;
  for (let i = 0; i < 8; i++) {
    const date = new Date(probe).toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    const time = new Date(probe).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Tashkent",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const appointment = new Date(`${date}T${time}:00+05:00`);
    const remainingMinutes = remainingMinutesFromDiff((appointment.getTime() - nowMs) / 60000);
    if (remainingMinutes === wanted && appointment.getTime() > nowMs) {
      return { date, time, remainingMinutes };
    }
    probe += (wanted - remainingMinutes) * 60 * 1000;
    if (probe <= nowMs) probe = nowMs + wanted * 60 * 1000 + 30 * 1000;
  }
  const fallback = new Date(nowMs + wanted * 60 * 1000 + 30 * 1000);
  return {
    date: fallback.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" }),
    time: fallback.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Tashkent",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    remainingMinutes: wanted,
  };
}

export function buildBarber15MinText(
  clientName: string,
  clientPhone: string | null,
  data: BookingData,
  remainingMinutes: number,
  notes?: string | null,
): string {
  const serviceNames = data.services.map(s => s.name).join(", ");
  const phoneLine    = clientPhone ? `\n\uD83D\uDCDE ${clientPhone}` : "";
  const notesLine    = notes       ? `\n\uD83D\uDCDD Eslatma: ${notes}` : "";
  return (
    `\u26A1\uFE0F <b>Keyingi mijozingizga ${remainingMinutes} daqiqa qoldi!</b>\n\n` +
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

export async function sendDueBarber15MinReminders(
  nowMs = Date.now(),
  onlySessionId?: string,
): Promise<{ sessionId: string; remainingMinutes: number; text: string; sent: boolean }[]> {
  const sessions = await db
    .select()
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.status, "confirmed"));

  const scoped = onlySessionId
    ? sessions.filter((session) => session.sessionId === onlySessionId)
    : sessions;

  const barberIds = [...new Set(scoped.map(s => s.barberId))];
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

  const results: { sessionId: string; remainingMinutes: number; text: string; sent: boolean }[] = [];

  for (const session of scoped) {
    const barber = barberMap.get(session.barberId);

    let data: BookingData;
    try { data = JSON.parse(session.bookingData) as BookingData; } catch { continue; }

    const appointmentDt = parseBookingDateTime(data);
    if (!appointmentDt) continue;

    const diffMinutes = (appointmentDt.getTime() - nowMs) / 60000;

    // A booking made only a few minutes ahead still gets one reminder with the real time left.
    if (!barber?.telegramId || sentReminders.has(`${session.sessionId}:barber_15`)) continue;
    if (!(diffMinutes <= 15 && diffMinutes > 0)) continue;

    const clientName = session.clientName?.split(" ")[0] || "Mijoz";
    const remainingMinutes = remainingMinutesFromDiff(diffMinutes);
    const text = buildBarber15MinText(clientName, session.clientPhone ?? null, data, remainingMinutes, session.clientName?.startsWith("Sinov") ? "Sinov — haqiqiy mijoz emas" : undefined);
    const sent = await sendTelegramMessage(barber.telegramId, text);
    sentReminders.add(`${session.sessionId}:barber_15`);
    results.push({ sessionId: session.sessionId, remainingMinutes, text, sent });
    console.log(`[Reminders] barber_15min sent: ${session.sessionId}`);
  }

  return results;
}

export async function triggerBarber15MinTest(
  user: typeof usersTable.$inferSelect,
  minutes = 8,
): Promise<{
  remainingMinutes: number;
  date: string;
  time: string;
  text: string;
  sent: boolean;
  bookingId: string | null;
  sessionId: string;
  telegramLinked: boolean;
}> {
  const clock = pickClockForRemainingMinutes(minutes);
  const sessionId = `test_${randomBytes(5).toString("hex")}`;
  const startMins = timeToMins(clock.time);
  const endTime = minsToTime(Math.min(startMins + 30, 24 * 60 - 1));
  const notes = "Sinov bron — o'chirish mumkin";
  const bookingData: BookingData = {
    barberName: user.brandName || user.name || "Barber",
    barberAddress: user.address || "",
    mapLink: user.mapLink || "",
    barberPageLink: user.username ? `https://barberuz-lovat.vercel.app/${user.username}` : "https://barberuz-lovat.vercel.app",
    isTeam: user.mode === "team",
    teamBarberName: null,
    date: clock.date,
    time: clock.time,
    totalPrice: 0,
    services: [{ name: "Sinov", price: 0, duration: 30 }],
  };

  const bufferMins = typeof user.bufferTime === "number" ? user.bufferTime : 10;
  const clash = await findBookingConflict({
    barberId: user.id,
    date: clock.date,
    startTime: clock.time,
    endTime,
    bufferMins,
  });

  let bookingId: string | null = null;
  if (!clash) {
    const [booking] = await db.insert(bookingsTable).values({
      barberId: user.id,
      clientName: "Sinov mijoz",
      serviceName: "Sinov",
      date: clock.date,
      startTime: clock.time,
      endTime,
      price: "0",
      notes,
      status: "confirmed",
    }).returning();
    bookingId = booking?.id ?? null;
  }

  await db.insert(bookingSessionsTable).values({
    sessionId,
    barberId: user.id,
    bookingId,
    bookingData: JSON.stringify(bookingData),
    clientName: "Sinov mijoz",
    status: "confirmed",
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
  });

  const [result] = await sendDueBarber15MinReminders(Date.now(), sessionId);
  const text = result?.text ?? buildBarber15MinText("Sinov", null, bookingData, clock.remainingMinutes, "Sinov — haqiqiy mijoz emas");

  return {
    remainingMinutes: result?.remainingMinutes ?? clock.remainingMinutes,
    date: clock.date,
    time: clock.time,
    text,
    sent: result?.sent ?? false,
    bookingId,
    sessionId,
    telegramLinked: Boolean(user.telegramId),
  };
}

async function checkAndSendReminders(): Promise<void> {
  const token = getToken();
  if (!token) return;

  const nowMs = Date.now();
  const { hour, minute, dateStr: todayStr } = nowInTashkent();

  try {
    await runClientNotificationCycle(nowMs);
    await sendDueBarber15MinReminders(nowMs);

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

