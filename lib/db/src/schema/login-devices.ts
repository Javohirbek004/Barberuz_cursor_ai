import { pgTable, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginDevicesTable = pgTable(
  "login_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    deviceKey: text("device_key").notNull(),
    label: text("label").notNull(),
    ip: text("ip"),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    userKey: uniqueIndex("login_devices_user_key_idx").on(table.userId, table.deviceKey),
    userIdx: index("login_devices_user_id_idx").on(table.userId),
  }),
);
