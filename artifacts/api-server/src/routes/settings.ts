import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, getUser, hashPassword } from "../lib/auth";

const router = Router();

function formatProfile(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    brandName: user.brandName,
    mode: user.mode,
    lang: user.lang,
    phone: user.phone,
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
      name, brandName, mode, lang, phone,
      workingHoursStart, workingHoursEnd, bio, avatarUrl,
      specializations, scheduleJson,
      lunchBreakEnabled, lunchBreakStart, lunchBreakEnd,
    } = req.body;
    const [updated] = await db.update(usersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(brandName !== undefined && { brandName }),
        ...(mode !== undefined && { mode }),
        ...(lang !== undefined && { lang }),
        ...(phone !== undefined && { phone }),
        ...(workingHoursStart !== undefined && { workingHoursStart }),
        ...(workingHoursEnd !== undefined && { workingHoursEnd }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(specializations !== undefined && { specializations }),
        ...(scheduleJson !== undefined && { scheduleJson }),
        ...(lunchBreakEnabled !== undefined && { lunchBreakEnabled }),
        ...(lunchBreakStart !== undefined && { lunchBreakStart }),
        ...(lunchBreakEnd !== undefined && { lunchBreakEnd }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json(formatProfile(updated));
  } catch (err) {
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
