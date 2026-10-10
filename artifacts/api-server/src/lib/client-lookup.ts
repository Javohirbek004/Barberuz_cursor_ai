import { db, clientsTable } from "@workspace/db";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { normalizePhone, phoneKey, sqlPhoneKeyMatches } from "./phone";

/**
 * The barber's client with this phone number, however the number was typed or
 * saved. Matches on the last nine digits, so "+998 (90) 123-45-67" and
 * "901234567" are the same person.
 */
export async function findClientByPhone(
  barberId: string,
  phone: string | null | undefined,
  exceptClientId?: string,
) {
  const key = phoneKey(phone);
  if (!key) return null;
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(
      eq(clientsTable.barberId, barberId),
      sqlPhoneKeyMatches(clientsTable.phone, key),
      ...(exceptClientId ? [ne(clientsTable.id, exceptClientId)] : []),
    ))
    .orderBy(desc(clientsTable.visitCount), asc(clientsTable.createdAt))
    .limit(1);
  return client ?? null;
}

/**
 * Find the client by phone or create one with the number saved in the standard
 * "+998XXXXXXXXX" form. A booking alone does not count as a visit.
 * Returns null when the phone is not a usable number.
 */
export async function findOrCreateClientByPhone(
  barberId: string,
  clientName: string,
  rawPhone: string,
): Promise<string | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  const existing = await findClientByPhone(barberId, phone);
  if (existing) {
    if (existing.phone !== phone) {
      await db.update(clientsTable)
        .set({ phone, updatedAt: new Date() })
        .where(eq(clientsTable.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db.insert(clientsTable).values({
    barberId,
    name: clientName,
    phone,
    status: "new",
    visitCount: 0,
    totalSpent: "0",
    lastVisit: null,
  }).returning();
  return created?.id ?? null;
}
