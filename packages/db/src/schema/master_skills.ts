import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Instance overrides for shipped catalog skills. Missing row = enabled by default.
 */
export const masterSkillCatalogPrefs = pgTable(
  "master_skill_catalog_prefs",
  {
    catalogKey: text("catalog_key").primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    recommended: boolean("recommended").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sortIdx: index("master_skill_catalog_prefs_sort_idx").on(table.sortOrder),
  }),
);

/**
 * Instance-owned skill templates. Hire installs them as company skills.
 * Referenced from master_agents.skill_keys as `instance/master/<slug>`.
 */
export const masterSkills = pgTable(
  "master_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    category: text("category").notNull().default("general"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    recommended: boolean("recommended").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUq: uniqueIndex("master_skills_slug_uq").on(table.slug),
    sortIdx: index("master_skills_sort_idx").on(table.sortOrder),
    recommendedUq: uniqueIndex("master_skills_recommended_uq")
      .on(table.recommended)
      .where(sql`${table.recommended} = true`),
  }),
);
