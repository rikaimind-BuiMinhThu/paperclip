CREATE TABLE "instance_default_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton_key" text DEFAULT 'default' NOT NULL,
	"adapter_type" text NOT NULL,
	"model" text NOT NULL,
	"credential_kind" text NOT NULL,
	"owner_user_id" text,
	"api_key_material" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_default_models_credential_check" CHECK ("instance_default_models"."credential_kind" in ('stored_login', 'api_key'))
);
--> statement-breakpoint
CREATE TABLE "master_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"role" text DEFAULT 'general' NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"icon" text DEFAULT 'user' NOT NULL,
	"skill_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"can_create_agents" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_agents_department_check" CHECK ("master_agents"."department" in ('leadership', 'marketing', 'sales', 'engineering', 'product', 'customer-success', 'back-office'))
);
--> statement-breakpoint
CREATE TABLE "master_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"master_agent_id" uuid NOT NULL,
	"is_manager" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"department" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_teams_department_check" CHECK ("master_teams"."department" in ('leadership', 'marketing', 'sales', 'engineering', 'product', 'customer-success', 'back-office'))
);
--> statement-breakpoint
ALTER TABLE "master_team_members" ADD CONSTRAINT "master_team_members_team_id_master_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."master_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_team_members" ADD CONSTRAINT "master_team_members_master_agent_id_master_agents_id_fk" FOREIGN KEY ("master_agent_id") REFERENCES "public"."master_agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instance_default_models_singleton_uq" ON "instance_default_models" USING btree ("singleton_key");--> statement-breakpoint
CREATE UNIQUE INDEX "master_agents_slug_uq" ON "master_agents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "master_agents_department_sort_idx" ON "master_agents" USING btree ("department","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "master_agents_recommended_uq" ON "master_agents" USING btree ("recommended") WHERE "master_agents"."recommended" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "master_team_members_team_agent_uq" ON "master_team_members" USING btree ("team_id","master_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "master_team_members_manager_uq" ON "master_team_members" USING btree ("team_id") WHERE "master_team_members"."is_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "master_teams_slug_uq" ON "master_teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "master_teams_department_uq" ON "master_teams" USING btree ("department");