import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const bookingSessionsTable = pgTable(
  "booking_sessions",
  {
    sessionId:              text("session_id").primaryKey(),
    barberId:               text("barber_id").notNull(),
    bookingData:            text("booking_data").notNull(),
    clientTelegramId:       text("client_telegram_id"),
    clientName:             text("client_name"),
    clientTelegramUsername: text("client_telegram_username"),
    bookingId:              text("booking_id"),
    clientPhone:            text("client_phone"),
    notificationSent:       boolean("notification_sent").notNull().default(false),
    cancelNotificationSent: boolean("cancel_notification_sent").notNull().default(false),
    status: text("status", {
      enum: ["pending", "confirmed", "expired", "cancelled"],
    }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx:  index("booking_sessions_status_idx").on(table.status),
    barberIdx:  index("booking_sessions_barber_id_idx").on(table.barberId),
    expiresIdx: index("booking_sessions_expires_idx").on(table.expiresAt),
  }),
);

export type BookingSession = typeof bookingSessionsTable.$inferSelect;
