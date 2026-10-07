import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiAppCustomers } from "./api_app_customers.js";
import { apiApps } from "./api_apps.js";
import { billingUnitDefs } from "./billing_unit_defs.js";
import { companies } from "./companies.js";

export const billingUnitMeterEvents = pgTable(
  "billing_unit_meter_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    apiAppCustomerId: uuid("api_app_customer_id")
      .notNull()
      .references(() => apiAppCustomers.id, { onDelete: "cascade" }),
    billingUnitDefId: uuid("billing_unit_def_id")
      .notNull()
      .references(() => billingUnitDefs.id),
    unitKey: text("unit_key").notNull(),
    quantity: integer("quantity").notNull(),
    packSize: integer("pack_size").notNull(),
    priceCents: integer("price_cents").notNull(),
    billablePacks: integer("billable_packs").notNull(),
    costCents: integer("cost_cents").notNull(),
    source: text("source").$type<"partner_api" | "auto">().notNull().default("partner_api"),
    idempotencyKey: text("idempotency_key").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerIdempotencyUq: uniqueIndex("billing_unit_meter_events_customer_idempotency_uq").on(
      table.apiAppCustomerId,
      table.idempotencyKey,
    ),
    customerOccurredIdx: index("billing_unit_meter_events_customer_occurred_idx").on(
      table.apiAppCustomerId,
      table.occurredAt,
    ),
    companyOccurredIdx: index("billing_unit_meter_events_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
  }),
);
