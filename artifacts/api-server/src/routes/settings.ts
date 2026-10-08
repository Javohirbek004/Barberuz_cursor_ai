import { Router } from "express";
import { db, usersTable, slugRedirectsTable, bookingsTable, qrScansTable } from "@workspace/db";
import { and, eq, gte, isNull, lt, notInArray, sql } from "drizzle-orm";
import { authenticate, getUser, hashPassword } from "../lib/auth";
import { SLUG_LOCK_MS, isSlugAvailable, repairAccidentalSlug, suggestSlug, validateSlug } from "../lib/public-slug";

const router = Router();
const ALLOWED_BUFFER_MINUTES = [0, 5, 10, 15, 20];

function formatProfile(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    brandName: user.brandName,
    mode: user.mode,
    lang: user.lang,
    phone: user.phone,
    phoneVisible: user.phoneVisible,
    workingHoursStart: user.workingHoursStart,
    workingHoursEnd: user.workingHoursEnd,
    telegramVerified: user.telegramVerified,
    telegramUsername: user.telegramUsername,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    specializations: user.specializations,
    scheduleJson: user.scheduleJson,
    lunchBreakEnabled: user.lunchBreakEnabled,
    lunchBreakStart: user.lunchBreakStart,
    lunchBreakEnd: user.lunchBreakEnd,
    bufferTime: user.bufferTime,
    address: user.address,
    mapLink: user.mapLink,
    latitude: user.latitude,
    longitude: user.longitude,
    instagram: user.instagram,
    galleryImages: user.galleryImages,
    qrCta: user.qrCta,
    qrLogo: user.qrLogo,
    slugChangedAt: user.slugChangedAt,
    slugChangeCount: user.slugChangeCount,
    nextChangeAt: user.slugChangedAt
      ? new Date(new Date(user.slugChangedAt).getTime() + SLUG_LOCK_MS).toISOString()
      : null,
  };
}

function tashkentMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const [yearText, monthText] = parts.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const start = `${yearText}-${monthText}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return {
    start,
    end,
    startAt: new Date(`${start}T00:00:00+05:00`),
    endAt: new Date(`${end}T00:00:00+05:00`),
  };
}

router.get("/profile", authenticate, async (req, res) => {
  const user = getUser(req);
  try {
    const cleaned = await repairAccidentalSlug(user);
    res.json(formatProfile(cleaned));
  } catch (err) {
    console.error("[settings] GET /profile slug repair error:", err);
    res.json(formatProfile(user));
  }
});

router.put("/profile", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const {
      name, brandName, mode, lang, phone, phoneVisible,
      workingHoursStart, workingHoursEnd, bio, avatarUrl,
      specializations, scheduleJson,
      lunchBreakEnabled, lunchBreakStart, lunchBreakEnd,
      bufferTime: rawBufferTime,
      address, mapLink: rawMapLink, latitude, longitude,
      instagram: rawInstagram, galleryImages,
    } = req.body;
    // Only the supported gap sizes are accepted; anything else is ignored.
    const bufferTime = typeof rawBufferTime === "number" && ALLOWED_BUFFER_MINUTES.includes(rawBufferTime)
      ? rawBufferTime
      : undefined;
    const mapLink = typeof rawMapLink === "string"
      ? (/^https?:\/\//i.test(rawMapLink.trim()) ? rawMapLink.trim() : "")
      : rawMapLink;
    const instagram = typeof rawInstagram === "string"
      ? rawInstagram.replace(/^@+/, "")
      : rawInstagram;
    const [updated] = await db.update(usersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(brandName !== undefined && { brandName }),
        ...(mode !== undefined && { mode }),
        ...(lang !== undefined && { lang }),
        ...(phone !== undefined && { phone }),
        ...(phoneVisible !== undefined && { phoneVisible }),
        ...(workingHoursStart !== undefined && { workingHoursStart }),
        ...(workingHoursEnd !== undefined && { workingHoursEnd }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(specializations !== undefined && { specializations }),
        ...(scheduleJson !== undefined && { scheduleJson }),
        ...(lunchBreakEnabled !== undefined && { lunchBreakEnabled }),
        ...(lunchBreakStart !== undefined && { lunchBreakStart }),
        ...(lunchBreakEnd !== undefined && { lunchBreakEnd }),
        ...(bufferTime !== undefined && { bufferTime }),
        ...(address !== undefined && { address }),
        ...(mapLink !== undefined && { mapLink }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(instagram !== undefined && { instagram }),
        ...(galleryImages !== undefined && { galleryImages }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json(formatProfile(updated));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/slug-check", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const slug = String(req.query.slug || "").trim().toLowerCase();
    const problem = validateSlug(slug);
    if (problem !== "ok") {
      res.json({ status: problem });
      return;
    }
    if (slug === user.username || await isSlugAvailable(slug, user.id)) {
      res.json({ status: "ok" });
      return;
    }
    const suggestion = await suggestSlug(slug, user.phone, user.id);
    res.json({ status: "taken", suggestion });
  } catch (err) {
    console.error("[settings] GET /slug-check error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/page-stats", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const range = tashkentMonthRange();
    const [scans] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(qrScansTable)
      .where(and(
        eq(qrScansTable.barberId, user.id),
        gte(qrScansTable.createdAt, range.startAt),
        lt(qrScansTable.createdAt, range.endAt),
      ));
    const [bookings] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.barberId, user.id),
        isNull(bookingsTable.deletedAt),
        gte(bookingsTable.date, range.start),
        lt(bookingsTable.date, range.end),
        notInArray(bookingsTable.status, ["cancelled", "auto_cancelled"]),
      ));
    res.json({ scans: Number(scans?.n || 0), bookings: Number(bookings?.n || 0) });
  } catch (err) {
    console.error("[settings] GET /page-stats error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.patch("/qr", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { cta, logo } = req.body as { cta?: unknown; logo?: unknown };
    const patch: { qrCta?: string | null; qrLogo?: string | null; updatedAt: Date } = { updatedAt: new Date() };
    if (cta !== undefined) {
      if (typeof cta !== "string" || cta.trim().length > 80) {
        res.status(400).json({ error: "validation" });
        return;
      }
      patch.qrCta = cta.trim() || null;
    }
    if (logo !== undefined) {
      if (logo !== null && (typeof logo !== "string" || !logo.startsWith("data:image/") || logo.length > 400_000)) {
        res.status(400).json({ error: "validation" });
        return;
      }
      patch.qrLogo = logo;
    }
    const [updated] = await db.update(usersTable).set(patch).where(eq(usersTable.id, user.id)).returning();
    res.json({ qrCta: updated.qrCta, qrLogo: updated.qrLogo });
  } catch (err) {
    console.error("[settings] PATCH /qr error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/**
 * PATCH /api/settings/slug
 * One public-address change every 30 days.
 * The previous address keeps opening the new page for 30 days.
 */
router.patch("/slug", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { slug } = req.body as { slug?: string };

    if (!slug || typeof slug !== "string") {
      res.status(400).json({ error: "validation", message: "slug is required" });
      return;
    }

    const clean = slug.trim().toLowerCase();
    const problem = validateSlug(clean);
    if (problem !== "ok") {
      res.status(400).json({ error: problem });
      return;
    }

    if (clean === user.username) {
      res.json({ username: user.username, slugChangedAt: user.slugChangedAt, nextChangeAt: null });
      return;
    }

    if (user.slugChangedAt) {
      const changedAt = new Date(user.slugChangedAt).getTime();
      if (Date.now() - changedAt < SLUG_LOCK_MS) {
        res.status(429).json({
          error: "rate_limited",
          slugChangedAt: user.slugChangedAt,
          nextChangeAt: new Date(changedAt + SLUG_LOCK_MS).toISOString(),
        });
        return;
      }
    }

    if (!(await isSlugAvailable(clean, user.id))) {
      const suggestion = await suggestSlug(clean, user.phone, user.id);
      res.status(409).json({ error: "taken", suggestion });
      return;
    }

    const oldSlug = user.username;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SLUG_LOCK_MS);

    const [updated] = await db.transaction(async (tx) => {
      await tx.delete(slugRedirectsTable).where(and(
        eq(slugRedirectsTable.oldSlug, clean),
        eq(slugRedirectsTable.userId, user.id),
      ));
      await tx.insert(slugRedirectsTable).values({
        oldSlug,
        newSlug: clean,
        userId: user.id,
        expiresAt,
      });
      return tx
        .update(usersTable)
        .set({
          username: clean,
          slugChangedAt: now,
          slugChangeCount: (user.slugChangeCount ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(usersTable.id, user.id))
        .returning();
    });

    res.json({
      username: updated.username,
      slugChangedAt: updated.slugChangedAt,
      nextChangeAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[settings] PATCH /slug error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/password", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: "validation", message: "Missing fields" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "validation", message: "Password too short" });
      return;
    }
    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (hashPassword(oldPassword) !== fresh.passwordHash) {
      res.status(400).json({ error: "wrong_password", message: "Old password is incorrect" });
      return;
    }
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/notifications", authenticate, async (req, res) => {
  const user = getUser(req);
  res.json({
    newBooking: user.notifNewBooking,
    cancellation: user.notifCancellation,
    reminders: user.notifReminders,
    reminderMinutes: parseInt(user.notifReminderMinutes) || 30,
  });
});

router.put("/notifications", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { newBooking, cancellation, reminders, reminderMinutes } = req.body;
    await db.update(usersTable)
      .set({
        ...(newBooking !== undefined && { notifNewBooking: newBooking }),
        ...(cancellation !== undefined && { notifCancellation: cancellation }),
        ...(reminders !== undefined && { notifReminders: reminders }),
        ...(reminderMinutes !== undefined && { notifReminderMinutes: String(reminderMinutes) }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    res.json({
      newBooking: updated.notifNewBooking,
      cancellation: updated.notifCancellation,
      reminders: updated.notifReminders,
      reminderMinutes: parseInt(updated.notifReminderMinutes) || 30,
    });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
