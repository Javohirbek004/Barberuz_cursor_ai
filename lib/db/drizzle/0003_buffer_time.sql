-- Preparation gap between services ("Oraliq tanaffus"), in minutes. Default 10.
-- Additive and idempotent. Also applied automatically on API start (see lib/db/src/index.ts).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "buffer_time" integer DEFAULT 10 NOT NULL;
