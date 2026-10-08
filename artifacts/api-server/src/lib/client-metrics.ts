import { db, bookingsTable, clientsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

/**
 * One place that updates a client's visit count, spending and loyalty mark.
 * Daily and monthly income already come from completed bookings only, so this
 * does not add a second money counter.
 * A visit is counted only when the booking status is completed.
 */
export async function syncClientMetrics(clientId: string | null | undefined, barberId: string) {
  if (!clientId) return;
  const rows = await db
    .select({
      price: bookingsTable.price,
      date: bookingsTable.date,
      startTime: bookingsTable.startTime,
    })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.clientId, clientId),
      eq(bookingsTable.barberId, barberId),
      eq(bookingsTable.status, "completed"),
      isNull(bookingsTable.deletedAt),
    ));

  let total = 0;
  let lastVisit: Date | null = null;
  for (const row of rows) {
    total += Number(row.price) || 0;
    const at = new Date(`${row.date}T${String(row.startTime).slice(0, 5)}:00+05:00`);
    if (!Number.isNaN(at.getTime()) && (!lastVisit || at > lastVisit)) lastVisit = at;
  }

  const [client] = await db
    .select({ status: clientsTable.status })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), eq(clientsTable.barberId, barberId)))
    .limit(1);
  if (!client) return;

  const days = lastVisit ? (Date.now() - lastVisit.getTime()) / 86400000 : null;
  const stillComing = days === null || days <= 30;
  const status = client.status === "blacklist"
    ? "blacklist"
    : stillComing && rows.length >= 5
      ? "regular"
      : "new";

  await db.update(clientsTable).set({
    visitCount: rows.length,
    totalSpent: total.toFixed(2),
    lastVisit,
    status,
    updatedAt: new Date(),
  }).where(and(eq(clientsTable.id, clientId), eq(clientsTable.barberId, barberId)));
}
