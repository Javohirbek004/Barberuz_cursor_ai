import { pgTable, text, boolean, timestamp, uuid, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    username: text("username").notNull().unique(),
    brandName: text("brand_name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["barber", "client"] }).notNull().default("barber"),
    mode: text("mode", { enum: ["solo", "team"] }).notNull().default("solo"),
    lang: text("lang", { enum: ["uz", "ru"] }).notNull().default("uz"),
    phone: text("phone"),
    phoneVisible: boolean("phone_visible").notNull().default(true),
    telegramVerified: boolean("telegram_verified").notNull().default(false),
    telegramId: text("telegram_id"),
    telegramUsername: text("telegram_username"),
    workingHoursStart: text("working_hours_start"),
    workingHoursEnd: text("working_hours_end"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    specializations: text("specializations"),
    scheduleJson: text("schedule_json"),
    lunchBreakEnabled: boolean("lunch_break_enabled").notNull().default(false),
    lunchBreakStart: text("lunch_break_start"),
    lunchBreakEnd: text("lunch_break_end"),
    /** Preparation gap (minutes) added after every service. Allowed: 0, 5, 10, 15, 20. */
    bufferTime: integer("buffer_time").notNull().default(10),
    address: text("address"),
    mapLink: text("map_link"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    instagram: text("instagram"),
    galleryImages: text("gallery_images"),
    qrCta: text("qr_cta"),
    qrLogo: text("qr_logo"),
    notifNewBooking: boolean("notif_new_booking").notNull().default(true),
    notifCancellation: boolean("notif_cancellation").notNull().default(true),
    notifReminders: boolean("notif_reminders").notNull().default(true),
    notifReminderMinutes: text("notif_reminder_minutes").notNull().default("30"),
    /** Client Telegram: reminder 24 hours before the appointment. */
    notifClientEvening: boolean("notif_client_evening").notNull().default(true),
    /** Client Telegram: reminder 1 hour before the appointment. */
    notifClientQuick: boolean("notif_client_quick").notNull().default(true),
    /** Minutes before the visit when the client can no longer cancel in the bot. */
    clientCancelLimit: integer("client_cancel_limit_min").notNull().default(60),
    /** Client Telegram: auto-cancel unconfirmed bookings inside the last hour. */
    notifClientAutoCancel: boolean("notif_client_auto_cancel").notNull().default(true),
    /** Bumped to sign every other device out. Tokens carry the same number. */
    sessionEpoch: integer("session_epoch").notNull().default(0),
    /** Whether this barber asked for a PIN or fingerprint on this account. */
    quickLogin: boolean("quick_login").notNull().default(false),
    /** Messages sent to this barber after signup. The lasting app button starts at 3. */
    botNoticeCount: integer("bot_notice_count").notNull().default(0),
    /** The lasting bottom app button has already been shown in this chat. */
    botEntryButton: boolean("bot_entry_button").notNull().default(false),
    /** Tashkent date (YYYY-MM-DD) when this barber already got today's morning schedule. */
    morningDigestOn: text("morning_digest_on"),
    /** The one-time preview of the morning schedule was already sent to this barber. */
    morningSampleSent: boolean("morning_sample_sent").notNull().default(false),
    slugChangedAt: timestamp("slug_changed_at", { withTimezone: true }),
    slugChangeCount: integer("slug_change_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    phoneIdx: index("users_phone_idx").on(table.phone),
    telegramIdIdx: index("users_telegram_id_idx").on(table.telegramId),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
