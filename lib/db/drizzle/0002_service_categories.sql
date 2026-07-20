-- Migration: service_categories table + services.category_id FK + data backfill
-- Applied via drizzle-kit push (push mode); SQL preserved for auditability.

CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "barber_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_categories_barber_id_idx"
  ON "service_categories" ("barber_id");--> statement-breakpoint

ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "category_id" uuid
  REFERENCES "service_categories"("id") ON DELETE SET NULL;--> statement-breakpoint

-- Backfill: derive category rows from distinct nameRu values per barber
INSERT INTO "service_categories" ("barber_id", "name")
SELECT DISTINCT
  s."barber_id",
  CASE s."name_ru"
    WHEN 'soch'     THEN 'Soch'
    WHEN 'soqol'    THEN 'Soqol'
    WHEN 'pakora'   THEN 'Pakora'
    WHEN 'bola'     THEN 'Bolalar'
    WHEN 'kosmetik' THEN 'Kosmetik'
    WHEN 'boshqa'   THEN 'Boshqa'
    ELSE s."name_ru"
  END AS "name"
FROM "services" s
WHERE s."name_ru" IS NOT NULL
  AND s."deleted_at" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Link services to their newly created category rows
UPDATE "services" s
SET "category_id" = sc."id"
FROM "service_categories" sc
WHERE sc."barber_id" = s."barber_id"
  AND sc."name" = CASE s."name_ru"
    WHEN 'soch'     THEN 'Soch'
    WHEN 'soqol'    THEN 'Soqol'
    WHEN 'pakora'   THEN 'Pakora'
    WHEN 'bola'     THEN 'Bolalar'
    WHEN 'kosmetik' THEN 'Kosmetik'
    WHEN 'boshqa'   THEN 'Boshqa'
    ELSE s."name_ru"
  END
  AND s."name_ru" IS NOT NULL
  AND s."category_id" IS NULL;
