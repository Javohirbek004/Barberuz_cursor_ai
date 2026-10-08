import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

/** Short-lived request to replace a client's phone with their Telegram contact. */
export const phoneUpdateIntentsTable = pgTable("phone_update_intents", {
  telegramId: text("telegram_id").primaryKey(),
  barberSlug: text("barber_slug"),
  phone: text("phone"),
  pending: boolean("pending").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PhoneUpdateIntent = typeof phoneUpdateIntentsTable.$inferSelect;
