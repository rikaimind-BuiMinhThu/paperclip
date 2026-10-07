import { boolean, bigint, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const pricingPlans = pgTable(
  "pricing_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    monthlyTokenLimit: bigint("monthly_token_limit", { mode: "number" }).notNull(),
    monthlyCostCentsLimit: integer("monthly_cost_cents_limit").notNull(),
    costMultiplierBps: integer("cost_multiplier_bps").notNull().default(10000),
    allowedModels: jsonb("allowed_models").$type<string[]>().notNull().default([]),
    rpmLimit: integer("rpm_limit").notNull().default(60),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("pricing_plans_slug_uq").on(table.slug),
  }),
);
