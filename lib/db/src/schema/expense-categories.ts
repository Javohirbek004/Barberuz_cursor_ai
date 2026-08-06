import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const expenseCategoriesTable = pgTable(
  "expense_categories",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    barberId:  uuid("barber_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name:      text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    barberIdx:  index("expense_categories_barber_id_idx").on(t.barberId),
    uniqueName: unique("expense_categories_barber_name_uniq").on(t.barberId, t.name),
  }),
);

export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;
