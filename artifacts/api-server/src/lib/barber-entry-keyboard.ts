import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signAppEntry } from "./auth";

export const BARBER_ENTRY_BUTTON = "🌐 Ilovaga kirish";

function appBase(): string {
  if (process.env.NODE_ENV === "development" && process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
  if (renderHost) return `https://${renderHost}`;
  if (process.env.APP_URL) {
    const appUrl = process.env.APP_URL.replace(/\/$/, "");
    if (!/replit\./i.test(appUrl) && !/vercel\.app$/i.test(appUrl)) return appUrl;
  }
  return "https://barber-uz-clq6.onrender.com";
}

/** Bottom button that opens this barber's own profile. Null until the third notice. */
export async function barberEntryMarkup(telegramId: string) {
  const id = String(telegramId);
  const [row] = await db
    .select({
      userId: usersTable.id,
      noticeCount: usersTable.botNoticeCount,
      shown: usersTable.botEntryButton,
    })
    .from(usersTable)
    .where(eq(usersTable.telegramId, id))
    .limit(1);
  if (!row) return null;

  let count = row.noticeCount ?? 0;
  if (!row.shown) {
    count += 1;
    await db
      .update(usersTable)
      .set({
        botNoticeCount: count,
        botEntryButton: count >= 3,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.telegramId, id));
  }
  if (count < 3) return null;

  const url = `${appBase()}/dashboard?entry=${encodeURIComponent(signAppEntry(row.userId))}`;
  return {
    keyboard: [[{ text: BARBER_ENTRY_BUTTON, web_app: { url } }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}
