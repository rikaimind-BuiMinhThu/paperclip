import { z } from "zod";

export const MASTER_CUSTOM_SKILL_KEY_PREFIX = "instance/master/" as const;

export function masterCustomSkillKey(slug: string): string {
  return `${MASTER_CUSTOM_SKILL_KEY_PREFIX}${slug.trim()}`;
}

export function isMasterCustomSkillKey(key: string): boolean {
  return key.startsWith(MASTER_CUSTOM_SKILL_KEY_PREFIX) && key.length > MASTER_CUSTOM_SKILL_KEY_PREFIX.length;
}

export function masterCustomSkillSlugFromKey(key: string): string | null {
  if (!isMasterCustomSkillKey(key)) return null;
  const slug = key.slice(MASTER_CUSTOM_SKILL_KEY_PREFIX.length).trim();
  return slug.length > 0 ? slug : null;
}

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const masterSkillCatalogPrefSchema = z.object({
  catalogKey: z.string().min(1),
  enabled: z.boolean(),
  recommended: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export type MasterSkillCatalogPref = z.infer<typeof masterSkillCatalogPrefSchema>;

export const upsertMasterSkillCatalogPrefSchema = z.object({
  catalogKey: z.string().trim().min(1).max(400),
  enabled: z.boolean().optional(),
  recommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type UpsertMasterSkillCatalogPref = z.infer<typeof upsertMasterSkillCatalogPrefSchema>;

export const masterSkillSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  enabled: z.boolean(),
  recommended: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export type MasterSkillRecord = z.infer<typeof masterSkillSchema>;

export const createMasterSkillSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().min(1).max(500),
  instructions: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  enabled: z.boolean().optional(),
  recommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type CreateMasterSkill = z.infer<typeof createMasterSkillSchema>;

export const updateMasterSkillSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  instructions: z.string().trim().min(1).max(50_000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  enabled: z.boolean().optional(),
  recommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type UpdateMasterSkill = z.infer<typeof updateMasterSkillSchema>;

/** Combined picker row for Master Agents skill selection. */
export const masterSkillOptionSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  kind: z.enum(["catalog", "custom"]),
  enabled: z.boolean(),
  recommended: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export type MasterSkillOption = z.infer<typeof masterSkillOptionSchema>;
