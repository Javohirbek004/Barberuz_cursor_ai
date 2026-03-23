import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  brandName: text("brand_name"),
  passwordHash: text("password_hash").notNull(),
  mode: text("mode", { enum: ["solo", "team"] }).notNull().default("solo"),
  lang: text("lang", { enum: ["uz", "ru"] }).notNull().default("uz"),
  telegramVerified: boolean("telegram_verified").notNull().default(false),
  telegramId: text("telegram_id"),
  telegramUsername: text("telegram_username"),
  phone: text("phone"),
  workingHoursStart: text("working_hours_start"),
  workingHoursEnd: text("working_hours_end"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  notifNewBooking: boolean("notif_new_booking").notNull().default(true),
  notifCancellation: boolean("notif_cancellation").notNull().default(true),
  notifReminders: boolean("notif_reminders").notNull().default(true),
  notifReminderMinutes: text("notif_reminder_minutes").notNull().default("30"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
