import { db, usersTable } from "@workspace/db";
import { and, isNotNull, isNull, ne } from "drizzle-orm";
import { phoneKey } from "./phone";

type BarberChat = {
  id: string;
  telegramId?: string | null;
  phone?: string | null;
  botPhone?: string | null;
  name?: string | null;
};

function personKeys(row: { phone?: string | null; botPhone?: string | null }): string[] {
  return [phoneKey(row.phone), phoneKey(row.botPhone)].filter(
    (key): key is string => Boolean(key),
  );
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || "").replace(/\s+/g, " ").trim().toLowerCase();
  const right = (b || "").replace(/\s+/g, " ").trim().toLowerCase();
  return Boolean(left) && left === right;
}

/**
 * Chat that should get barber alerts.
 * A second signup can leave the bot link on the other row — do not copy it
 * (the database forbids two live rows sharing one Telegram id).
 */
export async function bindBarberTelegramChat(barber: BarberChat): Promise<string | null> {
  try {
    if (barber.telegramId) return String(barber.telegramId);

    const twins = await db
      .select({
        telegramId: usersTable.telegramId,
        phone: usersTable.phone,
        botPhone: usersTable.botPhone,
        name: usersTable.name,
      })
      .from(usersTable)
      .where(and(
        ne(usersTable.id, barber.id),
        isNotNull(usersTable.telegramId),
        isNull(usersTable.deletedAt),
      ));

    const keys = personKeys(barber);
    const byPhone = twins.find((row) => {
      const other = personKeys(row);
      return keys.some((key) => other.includes(key));
    });
    const byName = twins.filter((row) => sameName(barber.name, row.name));
    const twin = byPhone || (byName.length === 1 ? byName[0] : undefined);
    return twin?.telegramId ? String(twin.telegramId) : null;
  } catch {
    return barber.telegramId ? String(barber.telegramId) : null;
  }
}
