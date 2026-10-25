import { z } from "zod";

/** Seeded shelves that ship with every instance (also used by agent catalog seeds). */
export const MASTER_DEPARTMENT_SEEDS = [
  { slug: "leadership", name: "Leadership", description: "Company leadership and coordination.", sortOrder: 0 },
  { slug: "marketing", name: "Marketing", description: "Campaigns, content, and growth.", sortOrder: 1 },
  { slug: "sales", name: "Sales", description: "Prospecting and closing.", sortOrder: 2 },
  { slug: "engineering", name: "Engineering", description: "Build, ship, and quality.", sortOrder: 3 },
  { slug: "product", name: "Product", description: "Product direction, design, and research.", sortOrder: 4 },
  { slug: "customer-success", name: "Customer success", description: "Adoption and support.", sortOrder: 5 },
  { slug: "back-office", name: "Back office", description: "Operations, books, and people.", sortOrder: 6 },
] as const;

export type MasterAgentDepartment = (typeof MASTER_DEPARTMENT_SEEDS)[number]["slug"];

/** Slug list for catalog seeds and UI fallbacks. Prefer MASTER_DEPARTMENT_SEEDS for labels. */
export const MASTER_AGENT_DEPARTMENTS = [
  "leadership",
  "marketing",
  "sales",
  "engineering",
  "product",
  "customer-success",
  "back-office",
] as const satisfies readonly MasterAgentDepartment[];

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

/** Department slug on agents/teams — existence is enforced in the service layer. */
export const masterDepartmentSlugSchema = slugSchema;

export const masterDepartmentSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export type MasterDepartmentRecord = z.infer<typeof masterDepartmentSchema>;

export const createMasterDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type CreateMasterDepartment = z.infer<typeof createMasterDepartmentSchema>;

export const updateMasterDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type UpdateMasterDepartment = z.infer<typeof updateMasterDepartmentSchema>;
