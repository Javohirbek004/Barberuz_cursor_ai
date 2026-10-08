import { pgTable, text, numeric, boolean, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { servicesTable } from "./services";

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barberId: uuid("barber_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
    serviceName: text("service_name"),
    date: date("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    bookingTime: timestamp("booking_time", { withTimezone: true }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
    status: text("status", {
      enum: ["pending", "confirmed", "completed", "cancelled", "auto_cancelled", "no_show"],
    }).notNull().default("confirmed"),
    /** Client tapped "I will come" in Telegram. Existing rows stay true so they are not auto-cancelled. */
    clientConfirmed: boolean("client_confirmed").notNull().default(true),
    clientTelegramId: text("client_telegram_id"),
    reminded24h: boolean("reminded_24h").notNull().default(false),
    reminded1h: boolean("reminded_1h").notNull().default(false),
    remindedFollowup: boolean("reminded_followup").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    barberIdx:      index("bookings_barber_id_idx").on(table.barberId),
    clientIdx:      index("bookings_client_id_idx").on(table.clientId),
    bookingTimeIdx: index("bookings_booking_time_idx").on(table.bookingTime),
    statusIdx:      index("bookings_status_idx").on(table.status),
  }),
);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
