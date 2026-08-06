import { pgTable, text, numeric, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const expensesTable = pgTable(
  "expenses",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    barberId:  uuid("barber_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    title:     text("title").notNull(),
    amount:    numeric("amount", { precision: 10, scale: 2 }).notNull(),
    category:  text("category").notNull().default("Boshqa"),
    date:      date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    barberIdx: index("expenses_barber_id_idx").on(t.barberId),
    dateIdx:   index("expenses_date_idx").on(t.date),
  }),
);

export type Expense = typeof expensesTable.$inferSelect;
