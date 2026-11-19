import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { normalizePhone, phoneKey } from "./phone";

/** This Telegram number already belongs to another barber account. */
export class BotPhoneTakenError extends Error {
  constructor() {
    super("bot_phone_taken");
    this.name = "BotPhoneTakenError";
  }
}

function contactKey(raw: string | null | undefined): string | null {
  return phoneKey(normalizePhone(raw) || raw);
}

/**
 * The account that shared this Telegram number.
 * A customer-facing number counts only while no bot number is stored yet,
 * so an edited contact number does not take over the bot.
 */
export async function findBarberBySharedContact(shared: string | null | undefined) {
  const key = contactKey(shared);
  if (!key) return null;
  const rows = await db
    .select()
    .from(usersTable)
    .where(and(
      isNull(usersTable.deletedAt),
      sql`(
        (length(regexp_replace(coalesce(${usersTable.botPhone}, ''), '[^0-9]', '', 'g')) >= 9
          and right(regexp_replace(coalesce(${usersTable.botPhone}, ''), '[^0-9]', '', 'g'), 9) = ${key})
        or (
          (${usersTable.botPhone} is null or btrim(${usersTable.botPhone}) = '')
          and length(regexp_replace(coalesce(${usersTable.phone}, ''), '[^0-9]', '', 'g')) >= 9
          and right(regexp_replace(coalesce(${usersTable.phone}, ''), '[^0-9]', '', 'g'), 9) = ${key}
        )
      )`,
    ))
    .limit(5);
  return rows.find((row) => contactKey(row.botPhone) === key)
    ?? rows.find((row) => !row.botPhone?.trim() && contactKey(row.phone) === key)
    ?? null;
}

async function numberHeld(
  column: typeof usersTable.phone | typeof usersTable.botPhone,
  shared: string,
  exceptId: string | null,
): Promise<boolean> {
  const key = contactKey(shared);
  if (!key) return false;
  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      isNull(usersTable.deletedAt),
      exceptId ? ne(usersTable.id, exceptId) : undefined,
      sql`length(regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')) >= 9
        and right(regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g'), 9) = ${key}`,
    ))
    .limit(1);
  return !!row;
}

/**
 * Remember the number shared with the bot.
 * Copy it onto the customer-facing number only when that number is still empty
 * and no other barber already shows it.
 */
export async function planSharedBarberPhone(userId: string | null, shared: string | null | undefined) {
  const botPhone = normalizePhone(shared);
  if (!botPhone) return { botPhone: null as string | null };
  if (await numberHeld(usersTable.botPhone, botPhone, userId)) throw new BotPhoneTakenError();

  let current = "";
  if (userId) {
    const [row] = await db
      .select({ phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    current = row?.phone?.trim() || "";
  }
  if (current) return { botPhone };
  if (await numberHeld(usersTable.phone, botPhone, userId)) return { botPhone };
  return { botPhone, publicPhone: botPhone };
}
