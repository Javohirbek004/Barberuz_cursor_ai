ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "latitude" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longitude" text;
