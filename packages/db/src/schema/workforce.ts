import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agentConfigRevisions } from "./agent_config_revisions.js";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { toolActionRequests } from "./tool_access.js";

export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id, { onDelete: "set null" }),
    currentDraftVersionId: uuid("current_draft_version_id").references(
      (): AnyPgColumn => workflowVersions.id,
      { onDelete: "set null" },
    ),
    publishedVersionId: uuid("published_version_id").references(
      (): AnyPgColumn => workflowVersions.id,
      { onDelete: "set null" },
    ),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("workflow_definitions_company_status_idx").on(table.companyId, table.status),
    statusCheck: check(
      "workflow_definitions_status_check",
      sql`${table.status} in ('draft', 'published', 'archived')`,
    ),
  }),
);

export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id").notNull().references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    state: text("state").notNull().default("draft"),
    graph: jsonb("graph").$type<Record<string, unknown>>().notNull(),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    definitionVersionUq: uniqueIndex("workflow_versions_definition_version_uq").on(
      table.definitionId,
      table.versionNumber,
    ),
    stateCheck: check("workflow_versions_state_check", sql`${table.state} in ('draft', 'published')`),
  }),
);

export const workforceShifts = pgTable(
  "workforce_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id"),
    routineRunId: uuid("routine_run_id"),
    workflowRunId: uuid("workflow_run_id"),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    previousShiftId: uuid("previous_shift_id").references((): AnyPgColumn => workforceShifts.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("running"),
    contextSnapshot: jsonb("context_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary"),
    costCents: integer("cost_cents").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStartedIdx: index("workforce_shifts_company_agent_started_idx").on(
      table.companyId,
      table.agentId,
      table.startedAt,
    ),
    statusCheck: check(
      "workforce_shifts_status_check",
      sql`${table.status} in ('scheduled', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled')`,
    ),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id").notNull().references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => workflowVersions.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id").references(() => workforceShifts.id, { onDelete: "set null" }),
    routineId: uuid("routine_id"),
    routineRunId: uuid("routine_run_id"),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    agentConfigRevisionId: uuid("agent_config_revision_id").references(() => agentConfigRevisions.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("running"),
    currentNodeId: text("current_node_id"),
    errorCode: text("error_code"),
    maxDelegationDepth: integer("max_delegation_depth").notNull().default(3),
    graphSnapshot: jsonb("graph_snapshot").$type<Record<string, unknown>>().notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("workflow_runs_company_status_idx").on(table.companyId, table.status),
    openRoutineUq: uniqueIndex("workflow_runs_one_open_routine_uq")
      .on(table.companyId, table.routineId)
      .where(sql`${table.routineId} is not null and ${table.status} in ('running', 'waiting_for_human')`),
    statusCheck: check(
      "workflow_runs_status_check",
      sql`${table.status} in ('running', 'waiting_for_human', 'completed', 'failed', 'cancelled')`,
    ),
  }),
);

export const workflowStepRuns = pgTable(
  "workflow_step_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    nodeType: text("node_type").notNull(),
    status: text("status").notNull().default("pending"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb("output").$type<Record<string, unknown>>().notNull().default({}),
    toolActionRequestId: uuid("tool_action_request_id").references(() => toolActionRequests.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runNodeUq: uniqueIndex("workflow_step_runs_run_node_uq").on(table.runId, table.nodeId),
    actionRequestIdx: index("workflow_step_runs_action_request_idx").on(table.toolActionRequestId),
    statusCheck: check(
      "workflow_step_runs_status_check",
      sql`${table.status} in ('pending', 'running', 'succeeded', 'waiting_for_human', 'failed', 'skipped')`,
    ),
  }),
);

export const workforceMemories = pgTable(
  "workforce_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    ownerAgentId: uuid("owner_agent_id").references(() => agents.id, { onDelete: "set null" }),
    visibility: text("visibility").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    source: text("source").notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyScopeIdx: index("workforce_memories_company_scope_idx").on(
      table.companyId,
      table.scopeType,
      table.scopeId,
    ),
    scopeCheck: check(
      "workforce_memories_scope_check",
      sql`${table.scopeType} in ('company', 'agent', 'issue', 'shift')`,
    ),
    visibilityCheck: check(
      "workforce_memories_visibility_check",
      sql`${table.visibility} in ('company', 'agent_private')`,
    ),
    kindCheck: check("workforce_memories_kind_check", sql`${table.kind} in ('shift_summary', 'note')`),
    privateOwnerCheck: check(
      "workforce_memories_private_owner_check",
      sql`${table.visibility} <> 'agent_private' or ${table.ownerAgentId} is not null`,
    ),
  }),
);

export const workforceOutboundDeliveries = pgTable(
  "workforce_outbound_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    workflowRunId: uuid("workflow_run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
    stepRunId: uuid("step_run_id").notNull().references(() => workflowStepRuns.id, { onDelete: "cascade" }),
    actionRequestId: uuid("action_request_id").notNull().references(() => toolActionRequests.id, {
      onDelete: "restrict",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionRequestUq: uniqueIndex("workforce_outbound_deliveries_action_request_uq").on(table.actionRequestId),
    companyIdempotencyUq: uniqueIndex("workforce_outbound_deliveries_company_idempotency_uq").on(
      table.companyId,
      table.idempotencyKey,
    ),
  }),
);

export const workforceCrmRecords = pgTable(
  "workforce_crm_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    workflowRunId: uuid("workflow_run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    externalRef: text("external_ref"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdempotencyUq: uniqueIndex("workforce_crm_records_company_idempotency_uq").on(
      table.companyId,
      table.idempotencyKey,
    ),
  }),
);
