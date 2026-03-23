import { servicesTable } from "@workspace/db";

export type ServiceRow = typeof servicesTable.$inferSelect;

export interface V1Service {
  id: string;
  barber_id: string;
  name: string;
  name_ru: string | null;
  duration_minutes: number;
  price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function formatService(row: ServiceRow): V1Service {
  return {
    id:               row.id,
    barber_id:        row.barberId,
    name:             row.name,
    name_ru:          row.nameRu ?? null,
    duration_minutes: row.duration,
    price:            row.price,
    is_active:        row.isActive,
    created_at:       row.createdAt.toISOString(),
    updated_at:       row.updatedAt.toISOString(),
    deleted_at:       row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}
