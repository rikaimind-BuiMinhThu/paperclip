import { sql } from "drizzle-orm";
import {
  boolean,
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

const departmentInList = sql`'leadership', 'marketing', 'sales', 'engineering', 'product', 'customer-success', 'back-office'`;

/**
 * Instance-scoped job templates shown in onboarding. They are not company
 * agents. A hire copies one row into the new company.
 */
export const masterAgents = pgTable(
  "master_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    department: text("department").notNull(),
    role: text("role").notNull().default("general"),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    icon: text("icon").notNull().default("user"),
    skillKeys: jsonb("skill_keys").$type<string[]>().notNull().default([]),
    canCreateAgents: boolean("can_create_agents").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    recommended: boolean("recommended").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("master_agents_slug_uq").on(table.slug),
    departmentSortIdx: index("master_agents_department_sort_idx").on(table.department, table.sortOrder),
    recommendedUq: uniqueIndex("master_agents_recommended_uq")
      .on(table.recommended)
      .where(sql`${table.recommended} = true`),
    departmentCheck: check(
      "master_agents_department_check",
      sql`${table.department} in (${departmentInList})`,
    ),
  }),
);

export const masterTeams = pgTable(
  "master_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    department: text("department").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("master_teams_slug_uq").on(table.slug),
    departmentUq: uniqueIndex("master_teams_department_uq").on(table.department),
    departmentCheck: check(
      "master_teams_department_check",
      sql`${table.department} in (${departmentInList})`,
    ),
  }),
);

export const masterTeamMembers = pgTable(
  "master_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => masterTeams.id, { onDelete: "cascade" }),
    masterAgentId: uuid("master_agent_id")
      .notNull()
      .references(() => masterAgents.id, { onDelete: "restrict" }),
    isManager: boolean("is_manager").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    teamAgentUq: uniqueIndex("master_team_members_team_agent_uq").on(table.teamId, table.masterAgentId),
    managerUq: uniqueIndex("master_team_members_manager_uq")
      .on(table.teamId)
      .where(sql`${table.isManager} = true`),
  }),
);

/**
 * The one model every onboarding hire uses. The API key material is the
 * local-encrypted secret payload. Reads never return it.
 */
export const instanceDefaultModels = pgTable(
  "instance_default_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    singletonKey: text("singleton_key").notNull().default("default"),
    adapterType: text("adapter_type").notNull(),
    model: text("model").notNull(),
    credentialKind: text("credential_kind").notNull(),
    ownerUserId: text("owner_user_id"),
    apiKeyMaterial: jsonb("api_key_material").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    singletonUq: uniqueIndex("instance_default_models_singleton_uq").on(table.singletonKey),
    credentialCheck: check(
      "instance_default_models_credential_check",
      sql`${table.credentialKind} in ('stored_login', 'api_key')`,
    ),
  }),
);
