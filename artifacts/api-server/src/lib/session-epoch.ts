import { db, loginDevicesTable, usersTable } from "@workspace/db";
import { and, eq, isNull, ne } from "drizzle-orm";
import { generateToken } from "./auth";

export async function bumpSessionEpoch(
  userId: string,
  keepDeviceKey?: string | null,
): Promise<{ epoch: number; token: string }> {
  const [row] = await db
    .select({ sessionEpoch: usersTable.sessionEpoch })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const epoch = (row?.sessionEpoch ?? 0) + 1;
  await db.update(usersTable)
    .set({ sessionEpoch: epoch, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const where = keepDeviceKey
    ? and(eq(loginDevicesTable.userId, userId), ne(loginDevicesTable.deviceKey, keepDeviceKey), isNull(loginDevicesTable.revokedAt))
    : and(eq(loginDevicesTable.userId, userId), isNull(loginDevicesTable.revokedAt));
  await db.update(loginDevicesTable).set({ revokedAt: new Date() }).where(where);

  return { epoch, token: generateToken(userId, 7 * 24 * 60 * 60, epoch) };
}
