import { db, usersTable } from "@workspace/db";
import { eq, isNull, and, or, ilike } from "drizzle-orm";
import { UserRow } from "../models/user.model";

export interface CreateUserInput {
  name: string;
  username: string;
  password_hash: string;
  role?: "barber" | "client";
  mode?: "solo" | "team";
  language?: "uz" | "ru";
  phone?: string | null;
  brand_name?: string | null;
  telegram_id?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  brand_name?: string | null;
  role?: "barber" | "client";
  language?: "uz" | "ru";
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  deleted_at?: Date | null;
}

/** List all active (non-deleted) users */
export async function listUsers(): Promise<UserRow[]> {
  return db.select().from(usersTable).where(isNull(usersTable.deletedAt)).orderBy(usersTable.createdAt);
}

/** Get a single user by UUID */
export async function getUserById(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return row ?? null;
}

/** Check if a phone is already in use by another (non-deleted) user */
export async function phoneExists(phone: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.phone, phone),
        isNull(usersTable.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) return false;
  if (excludeId && rows[0].id === excludeId) return false;
  return true;
}

/** Create a new user */
export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const [row] = await db
    .insert(usersTable)
    .values({
      name: input.name,
      username: input.username,
      passwordHash: input.password_hash,
      role: input.role ?? "barber",
      mode: input.mode ?? "solo",
      lang: input.language ?? "uz",
      phone: input.phone ?? null,
      brandName: input.brand_name ?? null,
      telegramId: input.telegram_id ?? null,
    })
    .returning();
  return row!;
}

/** Patch an existing user */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserRow | null> {
  const updates: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined)       updates.name      = input.name;
  if (input.brand_name !== undefined) updates.brandName = input.brand_name;
  if (input.role !== undefined)       updates.role      = input.role;
  if (input.language !== undefined)   updates.lang      = input.language;
  if (input.phone !== undefined)      updates.phone     = input.phone;
  if (input.bio !== undefined)        updates.bio       = input.bio;
  if (input.avatar_url !== undefined) updates.avatarUrl = input.avatar_url;
  if (input.deleted_at !== undefined) updates.deletedAt = input.deleted_at;

  const [row] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();
  return row ?? null;
}

/** Soft-delete a user */
export async function softDeleteUser(id: string): Promise<boolean> {
  const result = await db
    .update(usersTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });
  return result.length > 0;
}

/** Export ALL users (including soft-deleted) */
export async function exportAllUsers(): Promise<UserRow[]> {
  return db.select().from(usersTable).orderBy(usersTable.createdAt);
}

/** Upsert users during import (restores with same UUID) */
export async function upsertUser(row: Record<string, unknown>): Promise<void> {
  await db
    .insert(usersTable)
    .values({
      id:            row.id as string,
      name:          row.name as string,
      username:      row.username as string,
      passwordHash:  row.password_hash as string ?? "",
      role:          (row.role as "barber" | "client") ?? "barber",
      mode:          (row.mode as "solo" | "team") ?? "solo",
      lang:          (row.lang ?? row.language ?? "uz") as "uz" | "ru",
      phone:         (row.phone as string | null) ?? null,
      brandName:     (row.brand_name as string | null) ?? null,
      telegramId:    (row.telegram_id as string | null) ?? null,
      telegramVerified: Boolean(row.telegram_verified),
      bio:           (row.bio as string | null) ?? null,
      avatarUrl:     (row.avatar_url as string | null) ?? null,
      createdAt:     row.created_at ? new Date(row.created_at as string) : new Date(),
      updatedAt:     row.updated_at ? new Date(row.updated_at as string) : new Date(),
      deletedAt:     row.deleted_at ? new Date(row.deleted_at as string) : null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        name:          row.name as string,
        username:      row.username as string,
        role:          (row.role as "barber" | "client") ?? "barber",
        lang:          (row.lang ?? row.language ?? "uz") as "uz" | "ru",
        phone:         (row.phone as string | null) ?? null,
        telegramId:    (row.telegram_id as string | null) ?? null,
        updatedAt:     new Date(),
      },
    });
}
