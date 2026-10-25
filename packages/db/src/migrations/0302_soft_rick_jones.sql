CREATE TABLE IF NOT EXISTS "master_departments" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "master_departments_slug_uq" ON "master_departments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_departments_sort_idx" ON "master_departments" USING btree ("sort_order");--> statement-breakpoint
INSERT INTO "master_departments" ("slug", "name", "description", "enabled", "sort_order") VALUES
	('leadership', 'リーダーシップ', '会社のリーダーシップと調整。', true, 0),
	('marketing', 'マーケティング', 'キャンペーン、コンテンツ、グロース。', true, 1),
	('sales', '営業', '見込み客の開拓と成約。', true, 2),
	('engineering', 'エンジニアリング', '構築、出荷、品質。', true, 3),
	('product', 'プロダクト', 'プロダクトの方向性、デザイン、リサーチ。', true, 4),
	('customer-success', 'カスタマーサクセス', '導入支援とサポート。', true, 5),
	('back-office', 'バックオフィス', 'オペレーション、経理、人事。', true, 6)
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "master_agents" DROP CONSTRAINT IF EXISTS "master_agents_department_check";--> statement-breakpoint
ALTER TABLE "master_teams" DROP CONSTRAINT IF EXISTS "master_teams_department_check";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "master_agents" ADD CONSTRAINT "master_agents_department_master_departments_slug_fk" FOREIGN KEY ("department") REFERENCES "public"."master_departments"("slug") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "master_teams" ADD CONSTRAINT "master_teams_department_master_departments_slug_fk" FOREIGN KEY ("department") REFERENCES "public"."master_departments"("slug") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
