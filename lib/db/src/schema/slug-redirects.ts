import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const slugRedirectsTable = pgTable(
  "slug_redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    oldSlug: text("old_slug").notNull(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oldSlugIdx: index("slug_redirects_old_slug_idx").on(table.oldSlug),
    userIdIdx: index("slug_redirects_user_id_idx").on(table.userId),
  }),
);

export type SlugRedirect = typeof slugRedirectsTable.$inferSelect;
