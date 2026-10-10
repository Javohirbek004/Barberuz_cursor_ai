import { Router } from "express";
import type { Request } from "express";
import { db, usersTable, slugRedirectsTable, bookingsTable, qrScansTable, loginDevicesTable } from "@workspace/db";
import { and, eq, gte, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { authenticate, getUser, hashPassword, generateToken } from "../lib/auth";
import { consumeRateLimit } from "../lib/rate-limit";
import { bumpSessionEpoch } from "../lib/session-epoch";
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
    if (!consumeRateLimit(`pwd:${user.id}`, 8, 15 * 60 * 1000)) {
      res.status(429).json({ error: "too_many", message: "Ko'p urinish. Biroz kuting." });
      return;
    }
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
    const { token } = await bumpSessionEpoch(user.id, deviceKeyOf(req));
    if (deviceKeyOf(req)) await rememberDevice(user.id, deviceKeyOf(req)!, deviceLabelOf(req), clientIp(req));
    res.json({ success: true, message: "Password updated", token });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

function headerValue(req: Request, name: string): string {
  const raw = req.headers[name];
  return (Array.isArray(raw) ? raw[0] : raw || "").trim();
}

function clientIp(req: Request): string | null {
  const ip = (headerValue(req, "x-forwarded-for").split(",")[0] || req.ip || "").trim();
  if (!ip || ip === "::1" || ip === "127.0.0.1") return null;
  return ip.slice(0, 64);
}

function deviceKeyOf(req: Request): string | null {
  const value = headerValue(req, "x-device-key");
  return /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : null;
}

function deviceLabelOf(req: Request): string {
  const given = headerValue(req, "x-device-label").replace(/[\r\n]/g, " ").trim();
  if (given) return given.slice(0, 80);
  const ua = headerValue(req, "user-agent");
  const android = ua.match(/Android\s[\d.]+;\s*([^;)]+)/i);
  if (android) {
    const model = android[1].replace(/\s+Build.*/i, "").trim();
    if (model && !/linux/i.test(model)) return model.slice(0, 80);
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Brauzer";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /Linux/i.test(ua) ? "Linux" : "Qurilma";
  return `${browser} / ${os}`;
}

async function rememberDevice(userId: string, deviceKey: string, label: string, ip: string | null) {
  const now = new Date();
  await db.insert(loginDevicesTable).values({
    userId,
    deviceKey,
    label,
    ip,
    lastSeen: now,
  }).onConflictDoUpdate({
    target: [loginDevicesTable.userId, loginDevicesTable.deviceKey],
    set: { label, ip, lastSeen: now, revokedAt: null },
  });
}

router.get("/security", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const key = deviceKeyOf(req);
    if (key) await rememberDevice(user.id, key, deviceLabelOf(req), clientIp(req));
    const rows = await db.select().from(loginDevicesTable).where(and(
      eq(loginDevicesTable.userId, user.id),
      isNull(loginDevicesTable.revokedAt),
    ));
    rows.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    res.json({
      quickLogin: user.quickLogin,
      devices: rows.map((row) => ({
        id: row.id,
        label: row.label,
        ip: row.ip,
        lastSeen: new Date(row.lastSeen).toISOString(),
        current: key != null && row.deviceKey === key,
      })),
    });
  } catch (err) {
    console.error("[settings] GET /security error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/quick-login", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const enabled = req.body?.enabled === true;
    await db.update(usersTable)
      .set({ quickLogin: enabled, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    res.json({ quickLogin: enabled });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/devices/logout-others", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const key = deviceKeyOf(req);
    const epoch = (user.sessionEpoch ?? 0) + 1;
    await db.update(usersTable)
      .set({ sessionEpoch: epoch, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    const revoked = await db.update(loginDevicesTable)
      .set({ revokedAt: new Date() })
      .where(key
        ? and(eq(loginDevicesTable.userId, user.id), ne(loginDevicesTable.deviceKey, key), isNull(loginDevicesTable.revokedAt))
        : and(eq(loginDevicesTable.userId, user.id), isNull(loginDevicesTable.revokedAt)))
      .returning({ id: loginDevicesTable.id });
    if (key) await rememberDevice(user.id, key, deviceLabelOf(req), clientIp(req));
    res.json({
      token: generateToken(user.id, 7 * 24 * 60 * 60, epoch),
      loggedOut: revoked.length,
    });
  } catch (err) {
    console.error("[settings] logout others error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/verify-password", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    if (!consumeRateLimit(`verifypw:${user.id}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: "too_many", message: "Ko'p urinish. Biroz kuting." });
      return;
    }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (!password || hashPassword(password) !== fresh.passwordHash) {
      res.status(400).json({ error: "wrong_password", message: "Wrong password" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

function notificationPayload(user: {
  notifNewBooking: boolean;
  notifCancellation: boolean;
  notifReminders: boolean;
  notifReminderMinutes: string;
  notifClientEvening: boolean;
  notifClientQuick: boolean;
  notifClientAutoCancel: boolean;
}) {
  return {
    newBooking: user.notifNewBooking,
    cancellation: user.notifCancellation,
    reminders: user.notifReminders,
    reminderMinutes: parseInt(user.notifReminderMinutes) || 30,
    eveningConfirm: user.notifClientEvening,
    quickReminder: user.notifClientQuick,
    autoCancel: user.notifClientAutoCancel,
  };
}

router.get("/notifications", authenticate, async (req, res) => {
  const user = getUser(req);
  res.json(notificationPayload(user));
});

router.put("/notifications", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { newBooking, cancellation, reminders, reminderMinutes, eveningConfirm, quickReminder, autoCancel } = req.body;
    await db.update(usersTable)
      .set({
        ...(newBooking !== undefined && { notifNewBooking: newBooking }),
        ...(cancellation !== undefined && { notifCancellation: cancellation }),
        ...(reminders !== undefined && { notifReminders: reminders }),
        ...(reminderMinutes !== undefined && { notifReminderMinutes: String(reminderMinutes) }),
        ...(typeof eveningConfirm === "boolean" && { notifClientEvening: eveningConfirm }),
        ...(typeof quickReminder === "boolean" && { notifClientQuick: quickReminder }),
        ...(typeof autoCancel === "boolean" && { notifClientAutoCancel: autoCancel }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    res.json(notificationPayload(updated));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
