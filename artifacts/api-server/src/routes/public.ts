/**
 * Public booking API — no authentication required.
 * Used by the customer-facing booking flow in the barber profile page.
 *
 * POST /api/public/sessions      — create a pending booking session
 * GET  /api/public/sessions/:id  — poll session status
 */

import { Router } from "express";
import { db, bookingSessionsTable, usersTable, servicesTable, slugRedirectsTable } from "@workspace/db";
import { eq, and, lt, isNull } from "drizzle-orm";
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
  if (process.env.NODE_ENV === "development") {
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const firstDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (firstDomain) return `https://${firstDomain}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
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
      barberPageLink: barberPageLink || `${getAppUrl()}`,
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

/**
 * GET /api/public/barber/id/:barberId
 * Fetch barber by their permanent UUID — used by /b/:id links.
 * Must be registered BEFORE /barber/:slug so "id" isn't treated as a slug.
 */
router.get("/barber/id/:barberId", async (req, res) => {
  try {
    const { barberId } = req.params;

    const [barber] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, barberId), isNull(usersTable.deletedAt)))
      .limit(1);

    if (!barber) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Return redirect shape — BarberByIdPage will navigate to /{username}
    res.json({ redirectTo: barber.username });
  } catch (err) {
    console.error("[PublicAPI] GET /barber/id/:id error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/**
 * GET /api/public/barber/:slug
 * Look up a barber by their public slug (username).
 * If not found directly, check slug_redirects for old slugs.
 * Returns barber profile + services for the public booking page.
 */
router.get("/barber/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Direct match first
    let [barber] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.username, slug), isNull(usersTable.deletedAt)))
      .limit(1);

    let redirectTo: string | null = null;

    if (!barber) {
      // Check redirect table for old slug
      const [redirect] = await db
        .select()
        .from(slugRedirectsTable)
        .where(eq(slugRedirectsTable.oldSlug, slug))
        .limit(1);

      if (redirect) {
        const [found] = await db
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.id, redirect.userId), isNull(usersTable.deletedAt)))
          .limit(1);

        if (found) {
          barber = found;
          redirectTo = found.username;
        }
      }
    }

    if (!barber) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // If this was an old slug, tell the client to update the URL
    if (redirectTo) {
      res.json({ redirectTo });
      return;
    }

    // Fetch active services
    const services = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.barberId, barber.id), eq(servicesTable.isActive, true), isNull(servicesTable.deletedAt)))
      .orderBy(servicesTable.createdAt);

    res.json({
      id: barber.id,
      name: barber.name,
      brandName: barber.brandName,
      bio: barber.bio,
      avatarUrl: barber.avatarUrl,
      phone: barber.phone,
      specializations: barber.specializations,
      mode: barber.mode,
      lang: barber.lang,
      workingHoursStart: barber.workingHoursStart,
      workingHoursEnd: barber.workingHoursEnd,
      scheduleJson: barber.scheduleJson,
      lunchBreakEnabled: barber.lunchBreakEnabled,
      lunchBreakStart: barber.lunchBreakStart,
      lunchBreakEnd: barber.lunchBreakEnd,
      telegramUsername: barber.telegramUsername,
      username: barber.username,
      address: barber.address,
      mapLink: barber.mapLink,
      instagram: barber.instagram,
      galleryImages: barber.galleryImages,
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        nameRu: s.nameRu,
        duration: s.duration,
        price: Number(s.price),
      })),
    });
  } catch (err) {
    console.error("[PublicAPI] GET /barber/:slug error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
