import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const BARBER_ENTRY_BUTTON = "🌐 Ilovaga kirish";

export function barberEntryKeyboard() {
  return {
    keyboard: [[{ text: BARBER_ENTRY_BUTTON }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Count one message sent to this barber.
 * From the third message on, the lasting bottom button may be attached once.
 */
export async function claimBarberEntryKeyboard(telegramId: string): Promise<boolean> {
  const id = String(telegramId);
  const [row] = await db
    .select({
      noticeCount: usersTable.botNoticeCount,
      shown: usersTable.botEntryButton,
    })
    .from(usersTable)
    .where(eq(usersTable.telegramId, id))
    .limit(1);
  if (!row || row.shown) return false;
  const next = (row.noticeCount ?? 0) + 1;
  await db
    .update(usersTable)
    .set({ botNoticeCount: next, updatedAt: new Date() })
    .where(eq(usersTable.telegramId, id));
  return next >= 3;
}

export async function rememberBarberEntryKeyboard(telegramId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ botEntryButton: true, updatedAt: new Date() })
    .where(eq(usersTable.telegramId, String(telegramId)));
}
