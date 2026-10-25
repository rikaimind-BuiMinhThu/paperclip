import { z } from "zod";

/** Previous English seed copy — used to migrate untouched rows to current seed labels. */
export const MASTER_DEPARTMENT_SEED_LEGACY_EN = {
  leadership: { name: "Leadership", description: "Company leadership and coordination." },
  marketing: { name: "Marketing", description: "Campaigns, content, and growth." },
  sales: { name: "Sales", description: "Prospecting and closing." },
  engineering: { name: "Engineering", description: "Build, ship, and quality." },
  product: { name: "Product", description: "Product direction, design, and research." },
  "customer-success": { name: "Customer success", description: "Adoption and support." },
  "back-office": { name: "Back office", description: "Operations, books, and people." },
} as const;

/** Seeded shelves that ship with every instance (also used by agent catalog seeds). */
export const MASTER_DEPARTMENT_SEEDS = [
  { slug: "leadership", name: "リーダーシップ", description: "会社のリーダーシップと調整。", sortOrder: 0 },
  { slug: "marketing", name: "マーケティング", description: "キャンペーン、コンテンツ、グロース。", sortOrder: 1 },
  { slug: "sales", name: "営業", description: "見込み客の開拓と成約。", sortOrder: 2 },
  { slug: "engineering", name: "エンジニアリング", description: "構築、出荷、品質。", sortOrder: 3 },
  { slug: "product", name: "プロダクト", description: "プロダクトの方向性、デザイン、リサーチ。", sortOrder: 4 },
  { slug: "customer-success", name: "カスタマーサクセス", description: "導入支援とサポート。", sortOrder: 5 },
  { slug: "back-office", name: "バックオフィス", description: "オペレーション、経理、人事。", sortOrder: 6 },
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
