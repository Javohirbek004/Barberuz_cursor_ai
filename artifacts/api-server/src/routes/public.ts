/**
 * Public booking API — no authentication required.
 * Used by the customer-facing booking flow in the barber profile page.
 *
 * POST /api/public/sessions      — create a pending booking session
 * GET  /api/public/sessions/:id  — poll session status
 */

import { Router } from "express";
import { db, bookingSessionsTable, usersTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendBarberBookingNotification } from "../lib/telegram-bot";

const router = Router();

function generateSessionId(): string {
  return randomBytes(5).toString("hex");
}

function getBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || "Barberuz_yordamchi_bot";
}

function getAppUrl(): string {
  if (process.env.APP_URL && process.env.NODE_ENV !== "development") {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const domains = process.env.REPLIT_DOMAINS?.split(",");
  if (domains?.length) return `https://${domains[0]!.trim()}`;
  return "https://barberuz.replit.app";
}

async function expireOldSessions() {
  try {
    await db
      .update(bookingSessionsTable)
      .set({ status: "expired" })
      .where(
        and(
          eq(bookingSessionsTable.status, "pending"),
          lt(bookingSessionsTable.expiresAt, new Date()),
        ),
      );
  } catch {
  }
}

/**
 * POST /api/public/sessions
 *
 * Body:
 *  barberId       — UUID of the barber
 *  barberName     — display name
 *  barberAddress  — salon address
 *  mapLink        — Google Maps / Yandex link
 *  barberPageLink — link back to the barber's public page
 *  isTeam         — boolean
 *  teamBarberName — name of selected team barber (optional)
 *  services       — [{ name, price, duration }]
 *  totalPrice     — sum of service prices
 *  totalDuration  — sum of service durations
 *  date           — "today" | "tomorrow" | ISO date
 *  time           — "HH:MM"
 *  tgCustomer     — { tgId, name, username } if already verified (optional)
 *
 * Returns:
 *  { sessionId, deepLink, status: "pending" | "confirmed" }
 */
router.post("/sessions", async (req, res) => {
  try {
    await expireOldSessions();

    const {
      barberId,
      barberName,
      barberAddress,
      mapLink,
      barberPageLink,
      isTeam,
      teamBarberName,
      services,
      totalPrice,
      totalDuration,
      date,
      time,
      tgCustomer,
      clientPhone,
    } = req.body;

    if (!barberId || !date || !time || !services?.length) {
      res.status(400).json({ error: "validation", message: "Missing required fields" });
      return;
    }

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const bookingData = {
      barberName:     barberName || "Barber",
      barberAddress:  barberAddress || "",
      mapLink:        mapLink || "",
      barberPageLink: barberPageLink || `${getAppUrl()}/barber-uz`,
      isTeam:         !!isTeam,
      teamBarberName: teamBarberName || null,
      services:       services || [],
      totalPrice:     totalPrice || 0,
      totalDuration:  totalDuration || 0,
      date,
      time,
    };

    const safeClientPhone = (typeof clientPhone === "string" && clientPhone.trim())
      ? clientPhone.trim()
      : null;

    if (tgCustomer?.tgId) {
      const clientFirstName = (tgCustomer.name as string || "Mijoz").split(" ")[0];

      await db.insert(bookingSessionsTable).values({
        sessionId,
        barberId,
        bookingData: JSON.stringify(bookingData),
        clientTelegramId: String(tgCustomer.tgId),
        clientName: tgCustomer.name || "Mijoz",
        clientTelegramUsername: tgCustomer.username || null,
        clientPhone: safeClientPhone,
        status: "confirmed",
        expiresAt,
      });

      res.json({
        sessionId,
        status: "confirmed",
        deepLink: null,
      });

      // Fire barber notification async — don't block response
      sendBarberBookingNotification(
        barberId,
        sessionId,
        bookingData as Parameters<typeof sendBarberBookingNotification>[2],
        clientFirstName,
        safeClientPhone,
      ).catch(err => console.error("[PublicAPI] barber notify failed:", err));

      return;
    }

    await db.insert(bookingSessionsTable).values({
      sessionId,
      barberId,
      bookingData: JSON.stringify(bookingData),
      clientPhone: safeClientPhone,
      status: "pending",
      expiresAt,
    });

    const botUsername = getBotUsername();
    const deepLink = `https://t.me/${botUsername}?start=booking_${sessionId}`;

    res.json({ sessionId, deepLink, status: "pending" });
  } catch (err) {
    console.error("[PublicAPI] POST /sessions error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/**
 * GET /api/public/sessions/:sessionId
 * Poll session status. Returns:
 *  { status: "pending" | "confirmed" | "expired", clientName?, clientTelegramId? }
 */
router.get("/sessions/:sessionId", async (req, res) => {
  try {
    await expireOldSessions();

    const { sessionId } = req.params;
    const [session] = await db
      .select()
      .from(bookingSessionsTable)
      .where(eq(bookingSessionsTable.sessionId, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({
      status: session.status,
      clientName: session.clientName,
      clientTelegramId: session.clientTelegramId,
      clientTelegramUsername: session.clientTelegramUsername,
    });
  } catch (err) {
    console.error("[PublicAPI] GET /sessions/:id error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
