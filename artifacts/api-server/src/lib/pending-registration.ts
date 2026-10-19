import { randomUUID } from "crypto";
import { and, desc, eq, gt, lte } from "drizzle-orm";
import { db, pendingRegistrationsTable, usersTable, type PendingRegistration } from "@workspace/db";
import { allocatePublicSlug, isSlugAvailable } from "./public-slug";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export async function savePendingRegistration(input: {
  name: string;
  brandName?: string | null;
  passwordHash: string;
  mode: "solo" | "team";
  lang: "uz" | "ru";
}): Promise<PendingRegistration> {
  const id = randomUUID();
  const now = new Date();
  let username = await allocatePublicSlug({
    brandName: input.brandName,
    name: input.name,
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    await db.delete(pendingRegistrationsTable).where(and(
      eq(pendingRegistrationsTable.username, username),
      lte(pendingRegistrationsTable.expiresAt, now),
    ));
    const [clash] = await db
      .select({ id: pendingRegistrationsTable.id })
      .from(pendingRegistrationsTable)
      .where(and(
        eq(pendingRegistrationsTable.username, username),
        gt(pendingRegistrationsTable.expiresAt, now),
      ))
      .limit(1);
    if (!clash) break;
    username = await allocatePublicSlug({
      name: `${input.name} ${attempt + 2}`,
    });
  }

  const [row] = await db.insert(pendingRegistrationsTable).values({
    id,
    name: input.name,
    brandName: input.brandName || null,
    username,
    passwordHash: input.passwordHash,
    mode: input.mode,
    lang: input.lang,
    expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
  }).returning();
  return row;
}

export async function getLivePendingRegistration(id: string): Promise<PendingRegistration | null> {
  const [row] = await db
    .select()
    .from(pendingRegistrationsTable)
    .where(and(
      eq(pendingRegistrationsTable.id, id),
      gt(pendingRegistrationsTable.expiresAt, new Date()),
    ))
    .limit(1);
  return row ?? null;
}

export async function latestLivePendingRegistration(): Promise<PendingRegistration | null> {
  const [row] = await db
    .select()
    .from(pendingRegistrationsTable)
    .where(gt(pendingRegistrationsTable.expiresAt, new Date()))
    .orderBy(desc(pendingRegistrationsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function createUserFromPending(
  pending: PendingRegistration,
  contact: { phone: string | null; telegramId: string; telegramUsername: string | null },
) {
  let username = pending.username;
  if (!(await isSlugAvailable(username))) {
    username = await allocatePublicSlug({
      brandName: pending.brandName,
      name: pending.name,
      phone: contact.phone,
    });
  }

  const values = {
    id: pending.id,
    name: pending.name,
    username,
    brandName: pending.brandName,
    passwordHash: pending.passwordHash,
    mode: pending.mode,
    lang: pending.lang,
    phone: contact.phone,
    telegramVerified: true,
    telegramId: contact.telegramId,
    telegramUsername: contact.telegramUsername,
  };
  let user;
  try {
    [user] = await db.insert(usersTable).values(values).returning();
  } catch (err) {
    values.username = await allocatePublicSlug({
      brandName: pending.brandName,
      name: pending.name,
      phone: contact.phone,
    });
    [user] = await db.insert(usersTable).values(values).returning();
    if (!user) throw err;
  }

  if (!user) throw new Error("signup save failed");
  await db.delete(pendingRegistrationsTable).where(eq(pendingRegistrationsTable.id, pending.id));
  return user;
}
