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

async function createDb() {
  if (!useLocalDb) {
    const pool = new Pool(postgresPoolConfig(process.env.DATABASE_URL!));
    return { pool, db: drizzlePg(pool, { schema }) };
  }

  const dataDir = path.resolve(here, "../.pglite-data");
  const client = new PGlite(dataDir);
  await client.waitReady;
  const sqlPath = path.join(here, "local-schema.sql");
  if (existsSync(sqlPath)) {
    await client.exec(readFileSync(sqlPath, "utf8"));
  }
  console.log("[db] Local PGlite database ready (Supabase not connected yet)");
  return { pool: undefined, db: drizzlePglite(client, { schema }) };
}

const started = await createDb();

export const pool = started.pool;
export const db = started.db;

export * from "./schema";
