import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));

const useLocalDb =
  process.env.USE_LOCAL_DB === "1" ||
  process.env.USE_LOCAL_DB === "true" ||
  !process.env.DATABASE_URL;

function postgresPoolConfig(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const needsSsl =
    /supabase\.(co|com)/i.test(rawUrl) ||
    parsed.searchParams.get("sslmode") === "require" ||
    parsed.searchParams.get("sslmode") === "verify-full";
  parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("uselibpqcompat", "true");
  return {
    connectionString: parsed.toString(),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}

/**
 * Additive, idempotent schema upgrades that must exist before the app serves requests.
 * Each statement uses IF NOT EXISTS, so running it on every start is safe.
 */
const ENSURE_SCHEMA_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "buffer_time" integer DEFAULT 10 NOT NULL`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "client_confirmed" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "client_telegram_id" text`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminded_24h" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminded_1h" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminded_followup" boolean DEFAULT false NOT NULL`,
];

async function createDb() {
  if (!useLocalDb) {
    const pool = new Pool(postgresPoolConfig(process.env.DATABASE_URL!));
    for (const statement of ENSURE_SCHEMA_SQL) {
      try {
        await pool.query(statement);
      } catch (err) {
        console.error("[db] Schema upgrade failed:", statement, err);
      }
    }
    return { pool, db: drizzlePg(pool, { schema }) };
  }

  const dataDir = path.resolve(here, "../.pglite-data");
  const client = new PGlite(dataDir);
  await client.waitReady;
  const sqlPath = path.join(here, "local-schema.sql");
  if (existsSync(sqlPath)) {
    await client.exec(readFileSync(sqlPath, "utf8"));
  }
  for (const statement of ENSURE_SCHEMA_SQL) {
    try {
      await client.exec(statement);
    } catch (err) {
      console.error("[db] Local schema upgrade failed:", statement, err);
    }
  }
  console.log("[db] Local PGlite database ready (Supabase not connected yet)");
  return { pool: undefined, db: drizzlePglite(client, { schema }) };
}

const started = await createDb();

export const pool = started.pool;
export const db = started.db;

export * from "./schema";
