CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"assignee_agent_id" uuid,
	"current_draft_version_id" uuid,
	"published_version_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_definitions_status_check" CHECK ("workflow_definitions"."status" in ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"shift_id" uuid,
	"routine_id" uuid,
	"routine_run_id" uuid,
	"issue_id" uuid,
	"agent_id" uuid NOT NULL,
	"agent_config_revision_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"current_node_id" text,
	"error_code" text,
	"max_delegation_depth" integer DEFAULT 3 NOT NULL,
	"graph_snapshot" jsonb NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_runs_status_check" CHECK ("workflow_runs"."status" in ('running', 'waiting_for_human', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "workflow_step_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_action_request_id" uuid,
	"idempotency_key" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_step_runs_status_check" CHECK ("workflow_step_runs"."status" in ('pending', 'running', 'succeeded', 'waiting_for_human', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"graph" jsonb NOT NULL,
	"input_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_versions_state_check" CHECK ("workflow_versions"."state" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "workforce_crm_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"external_ref" text,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workforce_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"owner_agent_id" uuid,
	"visibility" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"source" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workforce_memories_scope_check" CHECK ("workforce_memories"."scope_type" in ('company', 'agent', 'issue', 'shift')),
	CONSTRAINT "workforce_memories_visibility_check" CHECK ("workforce_memories"."visibility" in ('company', 'agent_private')),
	CONSTRAINT "workforce_memories_kind_check" CHECK ("workforce_memories"."kind" in ('shift_summary', 'note')),
	CONSTRAINT "workforce_memories_private_owner_check" CHECK ("workforce_memories"."visibility" <> 'agent_private' or "workforce_memories"."owner_agent_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "workforce_outbound_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"step_run_id" uuid NOT NULL,
	"action_request_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workforce_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"routine_id" uuid,
	"routine_run_id" uuid,
	"workflow_run_id" uuid,
	"issue_id" uuid,
	"previous_shift_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workforce_shifts_status_check" CHECK ("workforce_shifts"."status" in ('scheduled', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "workflow_definition_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_current_draft_version_id_workflow_versions_id_fk" FOREIGN KEY ("current_draft_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_published_version_id_workflow_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_shift_id_workforce_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."workforce_shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_agent_config_revision_id_agent_config_revisions_id_fk" FOREIGN KEY ("agent_config_revision_id") REFERENCES "public"."agent_config_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_tool_action_request_id_tool_action_requests_id_fk" FOREIGN KEY ("tool_action_request_id") REFERENCES "public"."tool_action_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_crm_records" ADD CONSTRAINT "workforce_crm_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_crm_records" ADD CONSTRAINT "workforce_crm_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_crm_records" ADD CONSTRAINT "workforce_crm_records_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_memories" ADD CONSTRAINT "workforce_memories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_memories" ADD CONSTRAINT "workforce_memories_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_outbound_deliveries" ADD CONSTRAINT "workforce_outbound_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_outbound_deliveries" ADD CONSTRAINT "workforce_outbound_deliveries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_outbound_deliveries" ADD CONSTRAINT "workforce_outbound_deliveries_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_outbound_deliveries" ADD CONSTRAINT "workforce_outbound_deliveries_step_run_id_workflow_step_runs_id_fk" FOREIGN KEY ("step_run_id") REFERENCES "public"."workflow_step_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_outbound_deliveries" ADD CONSTRAINT "workforce_outbound_deliveries_action_request_id_tool_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "public"."tool_action_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_shifts" ADD CONSTRAINT "workforce_shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_shifts" ADD CONSTRAINT "workforce_shifts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_shifts" ADD CONSTRAINT "workforce_shifts_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_shifts" ADD CONSTRAINT "workforce_shifts_previous_shift_id_workforce_shifts_id_fk" FOREIGN KEY ("previous_shift_id") REFERENCES "public"."workforce_shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_definitions_company_status_idx" ON "workflow_definitions" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "workflow_runs_company_status_idx" ON "workflow_runs" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_one_open_routine_uq" ON "workflow_runs" USING btree ("company_id","routine_id") WHERE "workflow_runs"."routine_id" is not null and "workflow_runs"."status" in ('running', 'waiting_for_human');--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_step_runs_run_node_uq" ON "workflow_step_runs" USING btree ("run_id","node_id");--> statement-breakpoint
CREATE INDEX "workflow_step_runs_action_request_idx" ON "workflow_step_runs" USING btree ("tool_action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_definition_version_uq" ON "workflow_versions" USING btree ("definition_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "workforce_crm_records_company_idempotency_uq" ON "workforce_crm_records" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "workforce_memories_company_scope_idx" ON "workforce_memories" USING btree ("company_id","scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workforce_outbound_deliveries_action_request_uq" ON "workforce_outbound_deliveries" USING btree ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workforce_outbound_deliveries_company_idempotency_uq" ON "workforce_outbound_deliveries" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "workforce_shifts_company_agent_started_idx" ON "workforce_shifts" USING btree ("company_id","agent_id","started_at");--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routines_company_workflow_idx" ON "routines" USING btree ("company_id","workflow_definition_id");