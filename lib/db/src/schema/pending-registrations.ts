import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Registration details held until the barber shares a phone in Telegram. */
export const pendingRegistrationsTable = pgTable("pending_registrations", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  brandName: text("brand_name"),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mode: text("mode", { enum: ["solo", "team"] }).notNull().default("solo"),
  lang: text("lang", { enum: ["uz", "ru"] }).notNull().default("uz"),
  /** The Telegram chat that opened this signup's bot link. Survives server restarts. */
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type PendingRegistration = typeof pendingRegistrationsTable.$inferSelect;
