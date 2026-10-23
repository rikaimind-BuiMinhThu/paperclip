CREATE TABLE "docuworks_ocr_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"api_app_id" uuid NOT NULL,
	"api_app_customer_id" uuid NOT NULL,
	"issue_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_redeem_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"api_app_id" uuid NOT NULL,
	"api_app_customer_id" uuid,
	"label" text,
	"token_hash" text NOT NULL,
	"pages_granted" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docuworks_ocr_jobs" ADD CONSTRAINT "docuworks_ocr_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docuworks_ocr_jobs" ADD CONSTRAINT "docuworks_ocr_jobs_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docuworks_ocr_jobs" ADD CONSTRAINT "docuworks_ocr_jobs_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docuworks_ocr_jobs" ADD CONSTRAINT "docuworks_ocr_jobs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_redeem_tokens" ADD CONSTRAINT "license_redeem_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_redeem_tokens" ADD CONSTRAINT "license_redeem_tokens_api_app_id_api_apps_id_fk" FOREIGN KEY ("api_app_id") REFERENCES "public"."api_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_redeem_tokens" ADD CONSTRAINT "license_redeem_tokens_api_app_customer_id_api_app_customers_id_fk" FOREIGN KEY ("api_app_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_redeem_tokens" ADD CONSTRAINT "license_redeem_tokens_redeemed_by_customer_id_api_app_customers_id_fk" FOREIGN KEY ("redeemed_by_customer_id") REFERENCES "public"."api_app_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "docuworks_ocr_jobs_request_id_uq" ON "docuworks_ocr_jobs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "docuworks_ocr_jobs_customer_idx" ON "docuworks_ocr_jobs" USING btree ("api_app_customer_id");--> statement-breakpoint
CREATE INDEX "docuworks_ocr_jobs_company_idx" ON "docuworks_ocr_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_redeem_tokens_token_hash_uq" ON "license_redeem_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "license_redeem_tokens_app_idx" ON "license_redeem_tokens" USING btree ("api_app_id");--> statement-breakpoint
CREATE INDEX "license_redeem_tokens_company_idx" ON "license_redeem_tokens" USING btree ("company_id");