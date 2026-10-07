import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiAppCustomers } from "./api_app_customers.js";
import { apiApps } from "./api_apps.js";
import { companies } from "./companies.js";

export const apiAppCustomerKeys = pgTable(
  "api_app_customer_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiAppCustomerId: uuid("api_app_customer_id")
      .notNull()
      .references(() => apiAppCustomers.id, { onDelete: "cascade" }),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyHashUq: uniqueIndex("api_app_customer_keys_key_hash_uq").on(table.keyHash),
    customerIdx: index("api_app_customer_keys_customer_idx").on(table.apiAppCustomerId),
    companyIdx: index("api_app_customer_keys_company_idx").on(table.companyId),
  }),
);
