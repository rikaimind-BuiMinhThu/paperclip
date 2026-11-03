ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
UPDATE "companies"
SET "slug" = lower(regexp_replace(regexp_replace(trim("issue_prefix"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
WHERE "slug" IS NULL OR trim("slug") = '';--> statement-breakpoint
UPDATE "companies"
SET "slug" = lower(regexp_replace(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
WHERE "slug" IS NULL OR trim("slug") = '';--> statement-breakpoint
UPDATE "companies"
SET "slug" = 'company'
WHERE "slug" IS NULL OR trim("slug") = '';--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    "slug",
    row_number() OVER (PARTITION BY "slug" ORDER BY "created_at" ASC, "id" ASC) AS rn
  FROM "companies"
)
UPDATE "companies" AS c
SET "slug" = ranked."slug" || '-' || ranked.rn::text
FROM ranked
WHERE c."id" = ranked."id" AND ranked.rn > 1;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "slug" SET DEFAULT 'company';--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies" USING btree ("slug");
