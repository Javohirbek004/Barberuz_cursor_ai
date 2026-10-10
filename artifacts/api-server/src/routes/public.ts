/**
 * Public booking API — no authentication required.
 * Used by the customer-facing booking flow in the barber profile page.
 *
 * POST /api/public/sessions      — create a pending booking session
 * GET  /api/public/sessions/:id  — poll session status
 */

import { Router } from "express";
import { db, bookingSessionsTable, usersTable, servicesTable, slugRedirectsTable, bookingsTable, clientsTable, qrScansTable } from "@workspace/db";
import { eq, and, isNull, or, desc, gt } from "drizzle-orm";
import { deliverBookingReceipt } from "../lib/client-notifications";
import { findClientByPhone } from "../lib/client-lookup";
import { expirePendingHolds, findBookingConflict, minsToTime, parseClockTime } from "../lib/booking-conflicts";
import { resolveCatalogServices } from "../lib/public-booking";
import { slotOutsideWorkingHours } from "../lib/schedule-guard";
import { normalizePhone } from "../lib/phone";
import { randomBytes } from "crypto";
import { sendBarberBookingNotification } from "../lib/telegram-bot";

const router = Router();

function generateSessionId(): string {
  return randomBytes(5).toString("hex");
}

function toISODate(date: string): string {
  if (date === "today" || date === "bugun") {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  }
  if (date === "tomorrow" || date === "ertaga") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  }
  return date;
}

function timeToMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function getBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || "BARBERUZ_YORDAMCHI_BOT";
}

function getAppUrl(): string {
  if (process.env.NODE_ENV === "development") {
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const firstDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (firstDomain) return `https://${firstDomain}`;
  return "https://barberuz-lovat.vercel.app";
}

async function expireOldSessions() {
  await expirePendingHolds();
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

    const startTime = parseClockTime(time);
    if (!startTime) {
      res.status(400).json({ error: "validation", message: "Vaqt noto'g'ri" });
      return;
    }

    const [barberRow] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, barberId), isNull(usersTable.deletedAt)))
      .limit(1);
    if (!barberRow) {
      res.status(404).json({ error: "not_found", message: "Sartarosh topilmadi" });
      return;
    }

    const catalog = await resolveCatalogServices(barberId, services);
    if (!catalog.ok) {
      res.status(400).json({ error: "validation", message: catalog.message });
      return;
    }

    const isoDate = toISODate(date);
    const hoursError = slotOutsideWorkingHours({
      isoDate,
      startTime,
      durationMins: catalog.totalDuration,
      workingHoursStart: barberRow.workingHoursStart,
      workingHoursEnd: barberRow.workingHoursEnd,
      scheduleJson: barberRow.scheduleJson,
      lunchBreakEnabled: barberRow.lunchBreakEnabled,
      lunchBreakStart: barberRow.lunchBreakStart,
      lunchBreakEnd: barberRow.lunchBreakEnd,
    });
    if (hoursError) {
      res.status(400).json({ error: "validation", message: hoursError });
      return;
    }

    const reqStart = timeToMins(startTime);
    const reqEnd = reqStart + catalog.totalDuration;
    const endTimeStr = minsToTime(Math.min(reqEnd, 24 * 60 - 1));
    const bufferMins = typeof barberRow.bufferTime === "number" ? barberRow.bufferTime : 10;
    const clash = await findBookingConflict({
      barberId,
      date: isoDate,
      startTime,
      endTime: endTimeStr,
      bufferMins,
    });
    if (clash) {
      res.status(409).json({ error: "conflict", message: "Tanlangan vaqt allaqachon band" });
      return;
    }

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const bookingData = {
      barberName:     barberName || barberRow.brandName || barberRow.name || "Barber",
      barberAddress:  barberAddress || barberRow.address || "",
      mapLink:        mapLink || barberRow.mapLink || "",
      barberPageLink: barberPageLink || `${getAppUrl()}`,
      isTeam:         !!isTeam,
      teamBarberName: teamBarberName || null,
      services:       catalog.services.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
      totalPrice:     catalog.totalPrice,
      totalDuration:  catalog.totalDuration,
      date:           isoDate,
      time:           startTime,
    };

    const typedPhone = typeof clientPhone === "string" ? clientPhone.trim() : "";
    const safeClientPhone = typedPhone ? (normalizePhone(typedPhone) ?? typedPhone) : null;

    if (tgCustomer?.tgId) {
      const chosenName = (typeof req.body.clientName === "string" && req.body.clientName.trim())
        ? req.body.clientName.trim()
        : ((tgCustomer.name as string) || "Mijoz");
      const clientFirstName = chosenName.split(" ")[0] || "Mijoz";
      const tgIdStr = String(tgCustomer.tgId);

      await db.insert(bookingSessionsTable).values({
        sessionId,
        barberId,
        bookingData: JSON.stringify(bookingData),
        clientTelegramId: tgIdStr,
        clientName: chosenName,
        clientTelegramUsername: tgCustomer.username || null,
        clientPhone: safeClientPhone,
        status: "confirmed",
        expiresAt,
      });

      // Upsert client record (mirrors confirmBookingSession in telegram-bot.ts)
      // so analytics client-identity counts remain correct.
      let clientId: string | null = null;
      try {
        let existing: typeof clientsTable.$inferSelect | null | undefined =
          safeClientPhone ? await findClientByPhone(barberId, safeClientPhone) : null;
        if (!existing) {
          [existing] = await db
            .select()
            .from(clientsTable)
            .where(and(eq(clientsTable.barberId, barberId), eq(clientsTable.telegramId, tgIdStr)))
            .limit(1);
        }

        if (existing) {
          await db.update(clientsTable).set({
            name: chosenName || existing.name,
            telegramId: tgIdStr,
            ...(safeClientPhone && { phone: safeClientPhone }),
            updatedAt: new Date(),
          }).where(eq(clientsTable.id, existing.id));
          clientId = existing.id;
        } else {
          const [newClient] = await db.insert(clientsTable).values({
            barberId,
            name: chosenName,
            phone: safeClientPhone,
            telegramId: tgIdStr,
            status: "new",
            visitCount: 0,
            totalSpent: "0",
          }).returning();
          clientId = newClient?.id ?? null;
        }
      } catch (clientErr) {
        console.warn("[PublicAPI] client upsert skipped:", (clientErr as Error).message);
      }

      // Insert booking row (with clientId) and link it back to the session
      // via bookingSessionsTable.bookingId — this makes confirmation idempotent:
      // if confirmBookingSession ever runs for this session, it will see
      // session.bookingId is already set and skip the duplicate insert.
      try {
        const svcName = catalog.services.map((s) => s.name).join(", ");

        const [inserted] = await db.insert(bookingsTable).values({
          barberId,
          clientId: clientId || null,
          clientName: chosenName,
          serviceName: svcName,
          date: isoDate,
          startTime,
          endTime: endTimeStr,
          price: String(catalog.totalPrice),
          status: "confirmed",
        }).returning({ id: bookingsTable.id });

        if (inserted?.id) {
          await db.update(bookingSessionsTable)
            .set({ bookingId: inserted.id })
            .where(eq(bookingSessionsTable.sessionId, sessionId));
          deliverBookingReceipt(inserted.id, {
            telegramId: tgIdStr,
            phone: safeClientPhone,
          }).catch((err) => console.error("[PublicAPI] client receipt failed:", err));
        }
      } catch (bookingErr) {
        console.error("[PublicAPI] booking row insert failed (non-fatal):", bookingErr);
      }

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

    const safeClientName = (typeof req.body.clientName === "string" && req.body.clientName.trim())
      ? req.body.clientName.trim()
      : null;

    const svcName = catalog.services.map((s) => s.name).join(", ");

    const [pendingBooking] = await db.insert(bookingsTable).values({
      barberId,
      clientName: safeClientName || "Mijoz",
      serviceName: svcName,
      date: isoDate,
      startTime,
      endTime: endTimeStr,
      price: String(catalog.totalPrice),
      status: "pending",
    }).returning({ id: bookingsTable.id });

    await db.insert(bookingSessionsTable).values({
      sessionId,
      barberId,
      bookingId: pendingBooking?.id ?? null,
      bookingData: JSON.stringify(bookingData),
      clientPhone: safeClientPhone,
      clientName: safeClientName,
      status: "pending",
      expiresAt,
    });

    const bookingId = pendingBooking?.id || sessionId;
    const deepLink = `https://t.me/BARBERUZ_YORDAMCHI_BOT?start=bk_${bookingId}`;

    res.json({ sessionId, bookingId, deepLink, status: "pending" });
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
 * GET /api/public/client-phone
 * Phone numbers are not handed out by Telegram id. The booking form keeps
 * the number on this device after the owner shares their contact.
 */
router.get("/client-phone", async (_req, res) => {
  res.json({ phone: null });
});

/**
 * GET /api/public/barber/:slug/slots?date=YYYY-MM-DD
 * Returns non-cancelled booked time ranges for a barber on a given date.
 * Used by the public booking modal to filter out already-taken slots.
 * Must be registered BEFORE /barber/:slug so Express resolves it correctly.
 */
router.get("/barber/:slug/slots", async (req, res) => {
  try {
    await expireOldSessions();
    const { slug } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "validation", message: "date query param required (YYYY-MM-DD)" });
      return;
    }

    const [barber] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.username, slug), isNull(usersTable.deletedAt)))
      .limit(1);

    if (!barber) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const booked = await db
      .select({
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        status: bookingsTable.status,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.barberId, barber.id),
          eq(bookingsTable.date, date),
          notInArray(bookingsTable.status, ["cancelled", "auto_cancelled"]),
        ),
      );

    res.json({ slots: booked });
  } catch (err) {
    console.error("[PublicAPI] GET /barber/:slug/slots error:", err);
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
router.post("/qr-scan", async (req, res) => {
  try {
    const slug = String(req.body?.slug || "").replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(slug)) {
      res.status(400).json({ error: "bad_slug" });
      return;
    }
    const [barber] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.username, slug), isNull(usersTable.deletedAt)))
      .limit(1);
    if (!barber) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await db.insert(qrScansTable).values({ barberId: barber.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[PublicAPI] POST /qr-scan error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/barber/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").replace(/^@/, "").trim().toLowerCase();

    // Direct match first
    let [barber] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.username, slug), isNull(usersTable.deletedAt)))
      .limit(1);

    let redirectTo: string | null = null;

    if (!barber) {
      // Old addresses keep working for 30 days. Rows without an expiry stay valid.
      const [redirect] = await db
        .select()
        .from(slugRedirectsTable)
        .where(and(
          eq(slugRedirectsTable.oldSlug, slug),
          or(isNull(slugRedirectsTable.expiresAt), gt(slugRedirectsTable.expiresAt, new Date())),
        ))
        .orderBy(desc(slugRedirectsTable.createdAt))
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
      phone: barber.phoneVisible ? barber.phone : null,
      specializations: barber.specializations,
      mode: barber.mode,
      lang: barber.lang,
      workingHoursStart: barber.workingHoursStart,
      workingHoursEnd: barber.workingHoursEnd,
      scheduleJson: barber.scheduleJson,
      lunchBreakEnabled: barber.lunchBreakEnabled,
      lunchBreakStart: barber.lunchBreakStart,
      lunchBreakEnd: barber.lunchBreakEnd,
      bufferTime: barber.bufferTime,
      telegramUsername: barber.telegramUsername,
      username: barber.username,
      address: barber.address,
      mapLink: barber.mapLink,
      latitude: barber.latitude,
      longitude: barber.longitude,
      phoneVisible: barber.phoneVisible,
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
