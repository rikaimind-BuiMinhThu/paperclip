import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiAppCustomers } from "./api_app_customers.js";
import { apiApps } from "./api_apps.js";
import { companies } from "./companies.js";

export const licenseRedeemTokens = pgTable(
  "license_redeem_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    apiAppCustomerId: uuid("api_app_customer_id").references(() => apiAppCustomers.id, {
      onDelete: "set null",
    }),
    label: text("label"),
    tokenHash: text("token_hash").notNull(),
    pagesGranted: integer("pages_granted").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedByCustomerId: uuid("redeemed_by_customer_id").references(() => apiAppCustomers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUq: uniqueIndex("license_redeem_tokens_token_hash_uq").on(table.tokenHash),
    appIdx: index("license_redeem_tokens_app_idx").on(table.apiAppId),
    companyIdx: index("license_redeem_tokens_company_idx").on(table.companyId),
  }),
);
