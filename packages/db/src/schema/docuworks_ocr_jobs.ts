import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { apiAppCustomers } from "./api_app_customers.js";
import { apiApps } from "./api_apps.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const docuworksOcrJobs = pgTable(
  "docuworks_ocr_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    apiAppId: uuid("api_app_id")
      .notNull()
      .references(() => apiApps.id, { onDelete: "cascade" }),
    apiAppCustomerId: uuid("api_app_customer_id")
      .notNull()
      .references(() => apiAppCustomers.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    status: text("status")
      .$type<"pending" | "success" | "failed">()
      .notNull()
      .default("pending"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestIdUq: uniqueIndex("docuworks_ocr_jobs_request_id_uq").on(table.requestId),
    customerIdx: index("docuworks_ocr_jobs_customer_idx").on(table.apiAppCustomerId),
    companyIdx: index("docuworks_ocr_jobs_company_idx").on(table.companyId),
  }),
);
