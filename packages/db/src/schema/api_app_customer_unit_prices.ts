import { bigint, boolean, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiAppCustomers } from "./api_app_customers.js";
import { billingUnitDefs } from "./billing_unit_defs.js";

export const apiAppCustomerUnitPrices = pgTable(
  "api_app_customer_unit_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiAppCustomerId: uuid("api_app_customer_id")
      .notNull()
      .references(() => apiAppCustomers.id, { onDelete: "cascade" }),
    billingUnitDefId: uuid("billing_unit_def_id")
      .notNull()
      .references(() => billingUnitDefs.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    monthlyUnitCap: bigint("monthly_unit_cap", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerUnitUq: uniqueIndex("api_app_customer_unit_prices_customer_unit_uq").on(
      table.apiAppCustomerId,
      table.billingUnitDefId,
    ),
  }),
);
