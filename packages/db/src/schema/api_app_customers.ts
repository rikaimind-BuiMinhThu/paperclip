import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { apiApps } from "./api_apps.js";
import { companies } from "./companies.js";
import { pricingPlans } from "./pricing_plans.js";

export const apiAppCustomers = pgTable(
  "api_app_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    externalRef: text("external_ref"),
    name: text("name").notNull(),
    email: text("email"),
    status: text("status").$type<"active" | "paused" | "revoked">().notNull().default("active"),
    planId: uuid("plan_id")
      .notNull()
      .references(() => pricingPlans.id),
    defaultAgentId: uuid("default_agent_id").references(() => agents.id, { onDelete: "set null" }),
    allowedModelsOverride: jsonb("allowed_models_override").$type<string[] | null>(),
    unitSpendCapCents: integer("unit_spend_cap_cents"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("api_app_customers_app_idx").on(table.apiAppId),
    companyIdx: index("api_app_customers_company_idx").on(table.companyId),
    appExternalRefUq: uniqueIndex("api_app_customers_app_external_ref_uq").on(
      table.apiAppId,
      table.externalRef,
    ),
  }),
);
