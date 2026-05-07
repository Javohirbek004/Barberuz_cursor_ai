import { Router } from "express";
import { db, usersTable, slugRedirectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, getUser, hashPassword } from "../lib/auth";

const router = Router();

const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;

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
    address: user.address,
    mapLink: user.mapLink,
    latitude: user.latitude,
    longitude: user.longitude,
    instagram: user.instagram,
    galleryImages: user.galleryImages,
    slugChangedAt: user.slugChangedAt,
    slugChangeCount: user.slugChangeCount,
  };
}

router.get("/profile", authenticate, async (req, res) => {
  const user = getUser(req);
  res.json(formatProfile(user));
});

router.put("/profile", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const {
      name, brandName, mode, lang, phone, phoneVisible,
      workingHoursStart, workingHoursEnd, bio, avatarUrl,
      specializations, scheduleJson,
      lunchBreakEnabled, lunchBreakStart, lunchBreakEnd,
      address, mapLink: rawMapLink, latitude, longitude,
      instagram: rawInstagram, galleryImages,
    } = req.body;
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

/**
 * PATCH /api/settings/slug
 * Update the barber's public URL slug (username).
 * Rate-limited: max 1 change per 24 hours.
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

    if (!SLUG_REGEX.test(clean)) {
      res.status(400).json({ error: "validation", message: "Slug must be 3–30 chars, only lowercase letters, digits and hyphens" });
      return;
    }

    // No-op if same — check before rate limit so resubmitting current slug always succeeds
    if (clean === user.username) {
      res.json({ username: user.username });
      return;
    }

    // Rate limit: max 1 change per 24 h
    if (user.slugChangedAt) {
      const hoursSince = (Date.now() - new Date(user.slugChangedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        res.status(429).json({ error: "rate_limited", message: "Max 1 slug change per 24 hours" });
        return;
      }
    }

    // Uniqueness check: active usernames
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, clean))
      .limit(1);

    if (existing && existing.id !== user.id) {
      res.status(409).json({ error: "taken", message: "This slug is already taken" });
      return;
    }

    // Reservation check: protect old slugs so their QR codes / redirects stay valid.
    // If any OTHER user has used this slug in the past (it's in slug_redirects as an
    // old_slug for a different user), we must reject it — otherwise their old QRs
    // would silently start resolving to the wrong barber.
    const [reserved] = await db
      .select({ userId: slugRedirectsTable.userId })
      .from(slugRedirectsTable)
      .where(eq(slugRedirectsTable.oldSlug, clean))
      .limit(1);

    if (reserved && reserved.userId !== user.id) {
      res.status(409).json({ error: "taken", message: "This slug is already taken" });
      return;
    }

    const oldSlug = user.username;

    // Atomically insert redirect + update username so partial failure is impossible
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(slugRedirectsTable).values({
        oldSlug,
        userId: user.id,
      });
      return tx
        .update(usersTable)
        .set({
          username: clean,
          slugChangedAt: new Date(),
          slugChangeCount: (user.slugChangeCount ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id))
        .returning();
    });

    res.json({ username: updated.username, slugChangedAt: updated.slugChangedAt });
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
