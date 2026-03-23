import { usersTable } from "@workspace/db";

export type UserRow = typeof usersTable.$inferSelect;

/** Public user shape returned by the v1 API */
export interface V1User {
  id: string;
  name: string;
  username: string;
  brand_name: string | null;
  role: "barber" | "client";
  mode: "solo" | "team";
  language: "uz" | "ru";
  phone: string | null;
  telegram_id: string | null;
  telegram_verified: boolean;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;  // ISO 8601
  updated_at: string;
  deleted_at: string | null;
}

export function formatUser(row: UserRow): V1User {
  return {
    id:               row.id,
    name:             row.name,
    username:         row.username,
    brand_name:       row.brandName ?? null,
    role:             (row.role ?? "barber") as "barber" | "client",
    mode:             row.mode,
    language:         row.lang,
    phone:            row.phone ?? null,
    telegram_id:      row.telegramId ?? null,
    telegram_verified: row.telegramVerified,
    bio:              row.bio ?? null,
    avatar_url:       row.avatarUrl ?? null,
    created_at:       row.createdAt.toISOString(),
    updated_at:       row.updatedAt.toISOString(),
    deleted_at:       row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}
