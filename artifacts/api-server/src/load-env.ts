import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(dir, "../.env"),
  resolve(process.cwd(), ".env"),
  resolve(dir, "../../../.env"),
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
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

const feedbackToken =
  process.env.FEEDBACKS_BOT_TOKEN?.trim() ||
  process.env.FEEDBACKS_BOT_TOKE?.trim() ||
  "";
if (!process.env.FEEDBACKS_BOT?.trim() && feedbackToken) {
  process.env.FEEDBACKS_BOT = feedbackToken;
}

if (!process.env.ADMIN_TELEGRAM_ID?.trim() && process.env.FEEDBACKS_BOT_USERNAME?.trim()) {
  process.env.ADMIN_TELEGRAM_ID = process.env.FEEDBACKS_BOT_USERNAME.trim();
}
