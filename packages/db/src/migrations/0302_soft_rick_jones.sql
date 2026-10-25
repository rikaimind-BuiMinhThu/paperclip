CREATE TABLE "master_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_departments_slug_uq" ON "master_departments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "master_departments_sort_idx" ON "master_departments" USING btree ("sort_order");--> statement-breakpoint
INSERT INTO "master_departments" ("slug", "name", "description", "enabled", "sort_order") VALUES
	('leadership', 'Leadership', 'Company leadership and coordination.', true, 0),
	('marketing', 'Marketing', 'Campaigns, content, and growth.', true, 1),
	('sales', 'Sales', 'Prospecting and closing.', true, 2),
	('engineering', 'Engineering', 'Build, ship, and quality.', true, 3),
	('product', 'Product', 'Product direction, design, and research.', true, 4),
	('customer-success', 'Customer success', 'Adoption and support.', true, 5),
	('back-office', 'Back office', 'Operations, books, and people.', true, 6)
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "master_agents" DROP CONSTRAINT "master_agents_department_check";--> statement-breakpoint
ALTER TABLE "master_teams" DROP CONSTRAINT "master_teams_department_check";--> statement-breakpoint
ALTER TABLE "master_agents" ADD CONSTRAINT "master_agents_department_master_departments_slug_fk" FOREIGN KEY ("department") REFERENCES "public"."master_departments"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_teams" ADD CONSTRAINT "master_teams_department_master_departments_slug_fk" FOREIGN KEY ("department") REFERENCES "public"."master_departments"("slug") ON DELETE restrict ON UPDATE no action;
