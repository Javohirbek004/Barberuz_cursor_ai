import { pgTable, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const qrScansTable = pgTable(
  "qr_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barberId: uuid("barber_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    barberIdx: index("qr_scans_barber_id_idx").on(table.barberId),
    createdIdx: index("qr_scans_created_at_idx").on(table.createdAt),
  }),
);
