import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const apiApps = pgTable(
  "api_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").$type<"active" | "paused" | "revoked">().notNull().default("active"),
    defaultAgentId: uuid("default_agent_id").references(() => agents.id, { onDelete: "set null" }),
    responsibleUserId: text("responsible_user_id").notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("api_apps_company_idx").on(table.companyId),
    companyStatusIdx: index("api_apps_company_status_idx").on(table.companyId, table.status),
  }),
);
