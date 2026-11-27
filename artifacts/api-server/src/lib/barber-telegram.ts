import { db, usersTable } from "@workspace/db";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";

type BarberChat = {
  id: string;
  telegramId?: string | null;
  phone?: string | null;
  botPhone?: string | null;
  name?: string | null;
};

/** The chat that should get barber alerts. A twin row from a second signup can hold the bot link. */
export async function bindBarberTelegramChat(barber: BarberChat): Promise<string | null> {
  try {
    return await resolveBarberTelegramChat(barber);
  } catch {
    return barber.telegramId ? String(barber.telegramId) : null;
  }
}

async function resolveBarberTelegramChat(barber: BarberChat): Promise<string | null> {
  if (barber.telegramId) return String(barber.telegramId);

  const twins = await db
    .select({
      telegramId: usersTable.telegramId,
      telegramUsername: usersTable.telegramUsername,
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

  const phone = (barber.phone || "").trim();
  const botPhone = (barber.botPhone || "").trim();
  const name = (barber.name || "").replace(/\s+/g, " ").trim();

  const byPhone = twins.find((row) => {
    const otherPhone = (row.phone || "").trim();
    const otherBot = (row.botPhone || "").trim();
    return (phone && (otherPhone === phone || otherBot === phone))
      || (botPhone && (otherPhone === botPhone || otherBot === botPhone));
  });
  const byName = twins.filter((row) => name && (row.name || "").replace(/\s+/g, " ").trim() === name);
  const twin = byPhone || (byName.length === 1 ? byName[0] : undefined);
  const chat = twin?.telegramId;
  if (!chat) return null;

  // The other row may still hold this chat. Sending must work even if copy fails.
  try {
    await db.update(usersTable).set({
      telegramId: chat,
      telegramVerified: true,
      ...(twin.telegramUsername ? { telegramUsername: twin.telegramUsername } : {}),
      updatedAt: new Date(),
    }).where(eq(usersTable.id, barber.id));
  } catch {
    /* unique telegram id — still send to this chat */
  }
  return String(chat);
}
