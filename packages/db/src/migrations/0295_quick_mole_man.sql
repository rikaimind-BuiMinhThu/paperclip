CREATE TABLE "api_app_customer_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_app_customer_id" uuid NOT NULL,
	"api_app_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_app_customer_unit_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_app_customer_id" uuid NOT NULL,
	"billing_unit_def_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"monthly_unit_cap" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_app_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_app_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"external_ref" text,
	"name" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"plan_id" uuid NOT NULL,
	"default_agent_id" uuid,
	"allowed_models_override" jsonb,
	"unit_spend_cap_cents" integer,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"default_agent_id" uuid,
	"responsible_user_id" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_unit_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_app_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"unit_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"aggregation" text DEFAULT 'per_unit' NOT NULL,
	"pack_size" integer DEFAULT 1 NOT NULL,
	"default_price_cents" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_unit_meter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"api_app_id" uuid NOT NULL,
	"api_app_customer_id" uuid NOT NULL,
	"billing_unit_def_id" uuid NOT NULL,
	"unit_key" text NOT NULL,
	"quantity" integer NOT NULL,
	"pack_size" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"billable_packs" integer NOT NULL,
	"cost_cents" integer NOT NULL,
	"source" text DEFAULT 'partner_api' NOT NULL,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"monthly_token_limit" bigint NOT NULL,
	"monthly_cost_cents_limit" integer NOT NULL,
	"cost_multiplier_bps" integer DEFAULT 10000 NOT NULL,
	"allowed_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rpm_limit" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "api_app_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "api_app_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "api_app_id" uuid;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "api_app_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "api_app_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "api_app_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "api_app_customer_keys" ADD CONSTRAINT "api_app_customer_keys_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customer_keys" ADD CONSTRAINT "api_app_customer_keys_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customer_keys" ADD CONSTRAINT "api_app_customer_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customer_unit_prices" ADD CONSTRAINT "api_app_customer_unit_prices_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customer_unit_prices" ADD CONSTRAINT "api_app_customer_unit_prices_billing_unit_def_id_billing_unit_defs_id_fk" FOREIGN KEY ("billing_unit_def_id") REFERENCES "public"."billing_unit_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customers" ADD CONSTRAINT "api_app_customers_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customers" ADD CONSTRAINT "api_app_customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customers" ADD CONSTRAINT "api_app_customers_plan_id_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_app_customers" ADD CONSTRAINT "api_app_customers_default_agent_id_agents_id_fk" FOREIGN KEY ("default_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_apps" ADD CONSTRAINT "api_apps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_apps" ADD CONSTRAINT "api_apps_default_agent_id_agents_id_fk" FOREIGN KEY ("default_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_defs" ADD CONSTRAINT "billing_unit_defs_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_defs" ADD CONSTRAINT "billing_unit_defs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_meter_events" ADD CONSTRAINT "billing_unit_meter_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_meter_events" ADD CONSTRAINT "billing_unit_meter_events_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_meter_events" ADD CONSTRAINT "billing_unit_meter_events_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_unit_meter_events" ADD CONSTRAINT "billing_unit_meter_events_billing_unit_def_id_billing_unit_defs_id_fk" FOREIGN KEY ("billing_unit_def_id") REFERENCES "public"."billing_unit_defs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_app_customer_keys_key_hash_uq" ON "api_app_customer_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_app_customer_keys_customer_idx" ON "api_app_customer_keys" USING btree ("api_app_customer_id");--> statement-breakpoint
CREATE INDEX "api_app_customer_keys_company_idx" ON "api_app_customer_keys" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_app_customer_unit_prices_customer_unit_uq" ON "api_app_customer_unit_prices" USING btree ("api_app_customer_id","billing_unit_def_id");--> statement-breakpoint
CREATE INDEX "api_app_customers_app_idx" ON "api_app_customers" USING btree ("api_app_id");--> statement-breakpoint
CREATE INDEX "api_app_customers_company_idx" ON "api_app_customers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_app_customers_app_external_ref_uq" ON "api_app_customers" USING btree ("api_app_id","external_ref");--> statement-breakpoint
CREATE INDEX "api_apps_company_idx" ON "api_apps" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "api_apps_company_status_idx" ON "api_apps" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "billing_unit_defs_app_idx" ON "billing_unit_defs" USING btree ("api_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_unit_defs_app_unit_key_uq" ON "billing_unit_defs" USING btree ("api_app_id","unit_key");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_unit_meter_events_customer_idempotency_uq" ON "billing_unit_meter_events" USING btree ("api_app_customer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_unit_meter_events_customer_occurred_idx" ON "billing_unit_meter_events" USING btree ("api_app_customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "billing_unit_meter_events_company_occurred_idx" ON "billing_unit_meter_events" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_plans_slug_uq" ON "pricing_plans" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_events_company_api_app_customer_occurred_idx" ON "cost_events" USING btree ("company_id","api_app_customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "issues_company_api_app_customer_idx" ON "issues" USING btree ("company_id","api_app_customer_id");