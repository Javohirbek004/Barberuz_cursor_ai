import { existsSync, readFileSync } from "fs";
import path from "path";
import { defineConfig } from "drizzle-kit";

const envFiles = [
  path.resolve(__dirname, "../../artifacts/api-server/.env"),
  path.resolve(__dirname, "../../.env"),
];
for (const envFile of envFiles) {
  if (!existsSync(envFile) || process.env.DATABASE_URL) continue;
  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

if (
  !process.env.DATABASE_URL &&
  process.env.USE_LOCAL_DB !== "1" &&
  process.env.USE_LOCAL_DB !== "true"
) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/users.ts",
    "./src/schema/clients.ts",
    "./src/schema/service-categories.ts",
    "./src/schema/services.ts",
    "./src/schema/bookings.ts",
    "./src/schema/booking-sessions.ts",
    "./src/schema/slug-redirects.ts",
    "./src/schema/expenses.ts",
    "./src/schema/expense-categories.ts",
  ],
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL
      ? (() => {
          const parsed = new URL(process.env.DATABASE_URL);
          parsed.searchParams.set("sslmode", "require");
          parsed.searchParams.set("uselibpqcompat", "true");
          return parsed.toString();
        })()
      : "postgres://127.0.0.1:5432/local",
    ssl: { rejectUnauthorized: false },
  },
});
