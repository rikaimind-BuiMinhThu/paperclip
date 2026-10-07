import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiApps } from "./api_apps.js";
import { companies } from "./companies.js";

export const billingUnitDefs = pgTable(
  "billing_unit_defs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    unitKey: text("unit_key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    aggregation: text("aggregation").$type<"per_unit" | "per_pack">().notNull().default("per_unit"),
    packSize: integer("pack_size").notNull().default(1),
    defaultPriceCents: integer("default_price_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("billing_unit_defs_app_idx").on(table.apiAppId),
    appUnitKeyUq: uniqueIndex("billing_unit_defs_app_unit_key_uq").on(table.apiAppId, table.unitKey),
  }),
);
