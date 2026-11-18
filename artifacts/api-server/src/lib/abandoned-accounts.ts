import { and, eq, isNull, lt } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Drop signups that were never finished and never linked to Telegram. */
export async function purgeAbandonedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - WEEK_MS);
  const removed = await db
    .delete(usersTable)
    .where(and(
      eq(usersTable.onboardingCompleted, false),
      isNull(usersTable.telegramId),
      lt(usersTable.createdAt, cutoff),
    ))
    .returning();
  if (removed.length > 0) {
    console.log(`[Accounts] Removed ${removed.length} unfinished account(s) older than 7 days`);
  }
  return removed.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAbandonedAccountCleanup(): void {
  if (timer) return;
  const run = () => {
    purgeAbandonedAccounts().catch((err) => console.error("[Accounts] Cleanup failed:", err));
  };
  run();
  timer = setInterval(run, DAY_MS);
}
