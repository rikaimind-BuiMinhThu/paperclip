import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Instance-scoped org shelves for master agents / master teams.
 * Slug is the stable key stored on master_agents.department and master_teams.department.
 */
export const masterDepartments = pgTable(
  "master_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("master_departments_slug_uq").on(table.slug),
    sortIdx: index("master_departments_sort_idx").on(table.sortOrder),
  }),
);
