import { db, bookingsTable, clientsTable } from "@workspace/db";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { syncClientMetrics } from "./client-metrics";
import { normalizePhone } from "./phone";

type ClientRow = typeof clientsTable.$inferSelect;

function mergeNotes(parts: Array<string | null>): string | null {
  const seen: string[] = [];
  for (const part of parts) {
    const text = (part || "").trim();
    if (text && !seen.includes(text)) seen.push(text);
  }
  return seen.length ? seen.join("\n") : null;
}

/**
 * One-time cleanup that is safe to run on every start.
 * Saves every client phone in the standard "+998XXXXXXXXX" form and merges cards
 * of the same barber that carry the same number. Bookings move to the kept card,
 * then visits and spending are recounted from completed bookings.
 */
export async function normalizeStoredClientPhones(): Promise<{ renamed: number; merged: number }> {
  const rows = await db.select().from(clientsTable).where(isNotNull(clientsTable.phone));

  const groups = new Map<string, { standard: string; members: ClientRow[] }>();
  for (const row of rows) {
    const standard = normalizePhone(row.phone);
    if (!standard) continue;
    const key = `${row.barberId}:${standard}`;
    const group = groups.get(key) ?? { standard, members: [] };
    group.members.push(row);
    groups.set(key, group);
  }

  let renamed = 0;
  let merged = 0;

  for (const { standard, members } of groups.values()) {
    const ordered = [...members].sort((a, b) =>
      b.visitCount - a.visitCount
      || Number(!!b.telegramId) - Number(!!a.telegramId)
      || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const keep = ordered[0]!;
    const extras = ordered.slice(1);

    if (extras.length === 0) {
      if (keep.phone !== standard) {
        await db.update(clientsTable)
          .set({ phone: standard, updatedAt: new Date() })
          .where(eq(clientsTable.id, keep.id));
        renamed += 1;
      }
      continue;
    }

    try {
      const extraIds = extras.map((row) => row.id);
      await db.transaction(async (tx) => {
        await tx.update(bookingsTable)
          .set({ clientId: keep.id })
          .where(inArray(bookingsTable.clientId, extraIds));
        await tx.update(clientsTable)
          .set({
            phone: standard,
            telegramId: keep.telegramId ?? extras.find((row) => row.telegramId)?.telegramId ?? null,
            notes: mergeNotes([keep.notes, ...extras.map((row) => row.notes)]),
            status: ordered.some((row) => row.status === "blacklist") ? "blacklist" : keep.status,
            updatedAt: new Date(),
          })
          .where(eq(clientsTable.id, keep.id));
        await tx.delete(clientsTable).where(inArray(clientsTable.id, extraIds));
      });
      await syncClientMetrics(keep.id, keep.barberId);
      merged += extras.length;
    } catch (err) {
      console.error(`[PhoneCleanup] merge skipped for ${standard}:`, (err as Error).message);
    }
  }

  return { renamed, merged };
}
