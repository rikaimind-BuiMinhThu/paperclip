CREATE TABLE "master_skill_catalog_prefs" (
	"catalog_key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "master_skill_catalog_prefs_sort_idx" ON "master_skill_catalog_prefs" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "master_skills_slug_uq" ON "master_skills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "master_skills_sort_idx" ON "master_skills" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "master_skills_recommended_uq" ON "master_skills" USING btree ("recommended") WHERE "master_skills"."recommended" = true;