import { z } from "zod";
import { AGENT_ROLES } from "../constants.js";

export const MASTER_AGENT_DEPARTMENTS = [
  "leadership",
  "marketing",
  "sales",
  "engineering",
  "product",
  "customer-success",
  "back-office",
] as const;

export type MasterAgentDepartment = (typeof MASTER_AGENT_DEPARTMENTS)[number];

export const MASTER_AGENT_ICONS = [
  "briefcase",
  "crown",
  "megaphone",
  "pen-line",
  "clapperboard",
  "share-2",
  "search",
  "badge-dollar-sign",
  "mail",
  "messages-square",
  "handshake",
  "phone",
  "presentation",
  "code",
  "check",
  "server",
  "shield",
  "layout",
  "palette",
  "life-buoy",
  "headset",
  "calculator",
  "users",
  "user-plus",
  "calendar",
  "scale",
  "monitor",
  "user",
] as const;

export type MasterAgentIcon = (typeof MASTER_AGENT_ICONS)[number];

export const DEFAULT_MODEL_ADAPTER_TYPES = ["claude_local", "codex_local", "cursor"] as const;

export type DefaultModelAdapterType = (typeof DEFAULT_MODEL_ADAPTER_TYPES)[number];

const departmentSchema = z.enum(MASTER_AGENT_DEPARTMENTS);
const iconSchema = z.enum(MASTER_AGENT_ICONS);
const roleSchema = z.enum(AGENT_ROLES);

export const masterAgentSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  department: departmentSchema,
  role: roleSchema,
  description: z.string(),
  instructions: z.string(),
  icon: z.string(),
  skillKeys: z.array(z.string()),
  canCreateAgents: z.boolean(),
  enabled: z.boolean(),
  recommended: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export type MasterAgentRecord = z.infer<typeof masterAgentSchema>;

export const masterTeamMemberSchema = z.object({
  masterAgentId: z.string().uuid(),
  title: z.string(),
  isManager: z.boolean(),
  sortOrder: z.number().int(),
}).strict();

export const masterTeamSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  department: departmentSchema,
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  members: z.array(masterTeamMemberSchema),
}).strict();

export type MasterTeamRecord = z.infer<typeof masterTeamSchema>;

export const createMasterAgentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  department: departmentSchema,
  description: z.string().trim().min(1).max(200),
  instructions: z.string().trim().min(1).max(20_000),
  role: roleSchema.optional(),
  icon: iconSchema.optional(),
  skillKeys: z.array(z.string().trim().min(1)).max(20).optional(),
  canCreateAgents: z.boolean().optional(),
  enabled: z.boolean().optional(),
  recommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export type CreateMasterAgent = z.infer<typeof createMasterAgentSchema>;

export const updateMasterAgentSchema = createMasterAgentSchema.partial().strict();

export type UpdateMasterAgent = z.infer<typeof updateMasterAgentSchema>;

export const createMasterTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(200),
  department: departmentSchema,
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  memberIds: z.array(z.string().uuid()).min(1).max(12),
  managerId: z.string().uuid(),
}).strict().superRefine((value, ctx) => {
  if (!value.memberIds.includes(value.managerId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The manager must be one of the team members",
      path: ["managerId"],
    });
  }
});

export type CreateMasterTeam = z.infer<typeof createMasterTeamSchema>;

export const updateMasterTeamSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  department: departmentSchema.optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  memberIds: z.array(z.string().uuid()).min(1).max(12).optional(),
  managerId: z.string().uuid().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.memberIds && value.managerId && !value.memberIds.includes(value.managerId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The manager must be one of the team members",
      path: ["managerId"],
    });
  }
});

export type UpdateMasterTeam = z.infer<typeof updateMasterTeamSchema>;

export const defaultModelStatusSchema = z.object({
  configured: z.boolean(),
  adapterType: z.enum(DEFAULT_MODEL_ADAPTER_TYPES).nullable(),
  model: z.string().nullable(),
  credentialKind: z.enum(["stored_login", "api_key"]).nullable(),
}).strict();

export type DefaultModelStatus = z.infer<typeof defaultModelStatusSchema>;

export const putDefaultModelSchema = z.object({
  adapterType: z.enum(DEFAULT_MODEL_ADAPTER_TYPES),
  model: z.string().trim().min(1).max(200),
  credential: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("stored_login") }).strict(),
    z.object({ kind: z.literal("api_key"), apiKey: z.string().trim().min(1).max(4_000) }).strict(),
  ]),
}).strict();

export type PutDefaultModel = z.infer<typeof putDefaultModelSchema>;

export const onboardingHireSchema = z.object({
  masterAgentId: z.string().uuid().optional(),
  masterTeamId: z.string().uuid().optional(),
}).strict().superRefine((value, ctx) => {
  const hasAgent = Boolean(value.masterAgentId);
  const hasTeam = Boolean(value.masterTeamId);
  if (hasAgent === hasTeam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Send exactly one of masterAgentId or masterTeamId",
      path: ["masterAgentId"],
    });
  }
});

export type OnboardingHireRequest = z.infer<typeof onboardingHireSchema>;
