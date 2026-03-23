import { db, servicesTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { ServiceRow } from "../models/service.model";

export interface CreateServiceInput {
  barber_id: string;
  name: string;
  name_ru?: string | null;
  duration_minutes?: number;
  price?: string;
  is_active?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  name_ru?: string | null;
  duration_minutes?: number;
  price?: string;
  is_active?: boolean;
  deleted_at?: Date | null;
}

/** List active services, optionally filtered by barber_id */
export async function listServices(barberId?: string): Promise<ServiceRow[]> {
  const condition = barberId
    ? and(isNull(servicesTable.deletedAt), eq(servicesTable.barberId, barberId))
    : isNull(servicesTable.deletedAt);
  return db.select().from(servicesTable).where(condition).orderBy(servicesTable.createdAt);
}

/** Get a single service by UUID */
export async function getServiceById(id: string): Promise<ServiceRow | null> {
  const [row] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
  return row ?? null;
}

/** Create a service */
export async function createService(input: CreateServiceInput): Promise<ServiceRow> {
  const [row] = await db
    .insert(servicesTable)
    .values({
      barberId:  input.barber_id,
      name:      input.name,
      nameRu:    input.name_ru ?? null,
      duration:  input.duration_minutes ?? 30,
      price:     input.price ?? "0",
      isActive:  input.is_active ?? true,
    })
    .returning();
  return row!;
}

/** Patch a service */
export async function updateService(id: string, input: UpdateServiceInput): Promise<ServiceRow | null> {
  const updates: Partial<typeof servicesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined)             updates.name      = input.name;
  if (input.name_ru !== undefined)          updates.nameRu    = input.name_ru;
  if (input.duration_minutes !== undefined) updates.duration  = input.duration_minutes;
  if (input.price !== undefined)            updates.price     = input.price;
  if (input.is_active !== undefined)        updates.isActive  = input.is_active;
  if (input.deleted_at !== undefined)       updates.deletedAt = input.deleted_at;

  const [row] = await db
    .update(servicesTable)
    .set(updates)
    .where(eq(servicesTable.id, id))
    .returning();
  return row ?? null;
}

/** Soft-delete a service */
export async function softDeleteService(id: string): Promise<boolean> {
  const result = await db
    .update(servicesTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(servicesTable.id, id))
    .returning({ id: servicesTable.id });
  return result.length > 0;
}

/** Export ALL services (including soft-deleted) */
export async function exportAllServices(): Promise<ServiceRow[]> {
  return db.select().from(servicesTable).orderBy(servicesTable.createdAt);
}

/** Upsert service during import */
export async function upsertService(row: Record<string, unknown>): Promise<void> {
  await db
    .insert(servicesTable)
    .values({
      id:        row.id as string,
      barberId:  row.barber_id as string,
      name:      row.name as string,
      nameRu:    (row.name_ru as string | null) ?? null,
      duration:  Number(row.duration_minutes ?? row.duration ?? 30),
      price:     String(row.price ?? "0"),
      isActive:  Boolean(row.is_active ?? row.isActive ?? true),
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : new Date(),
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    })
    .onConflictDoUpdate({
      target: servicesTable.id,
      set: {
        name:      row.name as string,
        price:     String(row.price ?? "0"),
        isActive:  Boolean(row.is_active ?? true),
        updatedAt: new Date(),
      },
    });
}
