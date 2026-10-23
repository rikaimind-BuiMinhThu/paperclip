import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  agents,
  companies,
  instanceDefaultModels,
  masterAgents,
  masterTeamMembers,
  masterTeams,
  type Db,
} from "@paperclipai/db";
import { resolveCatalogSkillRef } from "@paperclipai/skills-catalog";
import {
  writePaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
import {
  IMPLICIT_PLATFORM_DEFAULT_MODEL,
  legacyAgentAppearance,
  type CreateMasterAgent,
  type CreateMasterTeam,
  type DefaultModelStatus,
  type MasterAgentRecord,
  type MasterTeamRecord,
  type OnboardingHireRequest,
  type PutDefaultModel,
  type UpdateMasterAgent,
  type UpdateMasterTeam,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { getSecretProvider } from "../secrets/provider-registry.js";
import type { StoredSecretVersionMaterial } from "../secrets/types.js";
import { agentService } from "./agents.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { companySkillService } from "./company-skills.js";
import { logActivity } from "./activity-log.js";
import { instanceSettingsService } from "./instance-settings.js";
import { secretService } from "./secrets.js";
import { MASTER_AGENT_SEEDS, MASTER_TEAM_SEEDS } from "./master-agent-catalog.js";

const API_KEY_ENV: Record<string, string> = {
  claude_local: "ANTHROPIC_API_KEY",
  codex_local: "OPENAI_API_KEY",
  cursor: "CURSOR_API_KEY",
};

function masterAgentIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).masterAgentId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "agent";
}

function fillInstructions(template: string, agentName: string, organizationName: string) {
  return template
    .replaceAll("{{agentName}}", agentName)
    .replaceAll("{{organizationName}}", organizationName);
}

function toAgentRecord(row: typeof masterAgents.$inferSelect): MasterAgentRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    department: row.department as MasterAgentRecord["department"],
    role: row.role as MasterAgentRecord["role"],
    description: row.description,
    instructions: row.instructions,
    icon: row.icon,
    skillKeys: row.skillKeys ?? [],
    canCreateAgents: row.canCreateAgents,
    enabled: row.enabled,
    recommended: row.recommended,
    sortOrder: row.sortOrder,
  };
}

export function masterAgentService(db: Db) {
  const agentsSvc = agentService(db);
  const instructions = agentInstructionsService(db);
  const skills = companySkillService(db);
  const secrets = secretService(db);
  const settings = instanceSettingsService(db);

  async function ensureKujiraTemplates() {
    const slugs = new Set(["sachi-sales", "ikura-back-office", "kujira-engineer"]);
    for (const seed of MASTER_AGENT_SEEDS) {
      if (!slugs.has(seed.slug)) continue;
      const [existing] = await db.select({ id: masterAgents.id }).from(masterAgents).where(eq(masterAgents.slug, seed.slug));
      if (existing) continue;
      await db.insert(masterAgents).values({
        slug: seed.slug,
        title: seed.title,
        department: seed.department,
        role: seed.role,
        description: seed.description,
        instructions: seed.instructions,
        icon: seed.icon,
        skillKeys: seed.skillKeys,
        canCreateAgents: seed.canCreateAgents,
        enabled: true,
        recommended: false,
        sortOrder: seed.sortOrder,
      });
    }
  }

  async function ensureCmoPlanFirstTemplate() {
    const seed = MASTER_AGENT_SEEDS.find((row) => row.slug === "cmo");
    if (!seed) return;
    const [existing] = await db.select().from(masterAgents).where(eq(masterAgents.slug, "cmo")).limit(1);
    if (!existing) return;
    const keys = Array.isArray(existing.skillKeys) ? existing.skillKeys : [];
    const missingSkill = seed.skillKeys.some((key) => !keys.includes(key));
    if (
      !missingSkill
      && existing.description === seed.description
      && existing.instructions === seed.instructions
    ) {
      return;
    }
    await db.update(masterAgents).set({
      description: seed.description,
      instructions: seed.instructions,
      skillKeys: seed.skillKeys,
      updatedAt: new Date(),
    }).where(eq(masterAgents.id, existing.id));
  }

  async function ensureMarketingTeamMembership() {
    const seed = MASTER_TEAM_SEEDS.find((row) => row.slug === "marketing-team");
    if (!seed) return;
    const [team] = await db.select().from(masterTeams).where(eq(masterTeams.slug, "marketing-team")).limit(1);
    if (!team) return;
    if (team.description !== seed.description) {
      await db.update(masterTeams).set({
        description: seed.description,
        updatedAt: new Date(),
      }).where(eq(masterTeams.id, team.id));
    }
    const [social] = await db.select({ id: masterAgents.id })
      .from(masterAgents)
      .where(eq(masterAgents.slug, "social-media-manager"))
      .limit(1);
    if (!social) return;
    const [member] = await db.select({ id: masterTeamMembers.id })
      .from(masterTeamMembers)
      .where(and(
        eq(masterTeamMembers.teamId, team.id),
        eq(masterTeamMembers.masterAgentId, social.id),
      ))
      .limit(1);
    if (member) return;
    const sortOrder = seed.memberSlugs.indexOf("social-media-manager");
    await db.insert(masterTeamMembers).values({
      teamId: team.id,
      masterAgentId: social.id,
      isManager: false,
      sortOrder: sortOrder >= 0 ? sortOrder : 3,
    });
  }

  async function ensureMarketingTemplates() {
    await ensureCmoPlanFirstTemplate();
    await ensureMarketingTeamMembership();
  }

  async function ensureSeed() {
    const [existing] = await db.select({ id: masterAgents.id }).from(masterAgents).limit(1);
    if (existing) {
      await ensureKujiraTemplates();
      await ensureMarketingTemplates();
      return;
    }
    await db.transaction(async (tx) => {
      const [again] = await tx.select({ id: masterAgents.id }).from(masterAgents).limit(1);
      if (again) return;
      const inserted = await tx
        .insert(masterAgents)
        .values(MASTER_AGENT_SEEDS.map((seed) => ({
          slug: seed.slug,
          title: seed.title,
          department: seed.department,
          role: seed.role,
          description: seed.description,
          instructions: seed.instructions,
          icon: seed.icon,
          skillKeys: seed.skillKeys,
          canCreateAgents: seed.canCreateAgents,
          enabled: true,
          recommended: seed.recommended === true,
          sortOrder: seed.sortOrder,
        })))
        .returning({ id: masterAgents.id, slug: masterAgents.slug });
      const idBySlug = new Map(inserted.map((row) => [row.slug, row.id]));
      const teamRows = await tx
        .insert(masterTeams)
        .values(MASTER_TEAM_SEEDS.map((seed) => ({
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          department: seed.department,
          enabled: true,
          sortOrder: seed.sortOrder,
        })))
        .returning({ id: masterTeams.id, slug: masterTeams.slug });
      const teamIdBySlug = new Map(teamRows.map((row) => [row.slug, row.id]));
      await tx.insert(masterTeamMembers).values(MASTER_TEAM_SEEDS.flatMap((seed) => {
        const teamId = teamIdBySlug.get(seed.slug);
        if (!teamId) return [];
        return seed.memberSlugs.flatMap((memberSlug, index) => {
          const masterAgentId = idBySlug.get(memberSlug);
          if (!masterAgentId) return [];
          return [{
            teamId,
            masterAgentId,
            isManager: memberSlug === seed.managerSlug,
            sortOrder: index,
          }];
        });
      }));
    });
    await ensureKujiraTemplates();
    await ensureMarketingTemplates();
  }

  async function listAgents(includeDisabled: boolean): Promise<MasterAgentRecord[]> {
    await ensureSeed();
    const rows = await db
      .select()
      .from(masterAgents)
      .where(includeDisabled ? undefined : eq(masterAgents.enabled, true))
      .orderBy(asc(masterAgents.department), asc(masterAgents.sortOrder), asc(masterAgents.title));
    return rows.map(toAgentRecord);
  }

  async function listTeams(includeDisabled: boolean): Promise<MasterTeamRecord[]> {
    await ensureSeed();
    const teams = await db
      .select()
      .from(masterTeams)
      .where(includeDisabled ? undefined : eq(masterTeams.enabled, true))
      .orderBy(asc(masterTeams.sortOrder), asc(masterTeams.name));
    if (teams.length === 0) return [];
    const members = await db
      .select({
        teamId: masterTeamMembers.teamId,
        masterAgentId: masterTeamMembers.masterAgentId,
        isManager: masterTeamMembers.isManager,
        sortOrder: masterTeamMembers.sortOrder,
        title: masterAgents.title,
        enabled: masterAgents.enabled,
      })
      .from(masterTeamMembers)
      .innerJoin(masterAgents, eq(masterAgents.id, masterTeamMembers.masterAgentId))
      .orderBy(asc(masterTeamMembers.sortOrder));
    return teams.map((team) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      description: team.description,
      department: team.department as MasterTeamRecord["department"],
      enabled: team.enabled,
      sortOrder: team.sortOrder,
      members: members
        .filter((member) => member.teamId === team.id && (includeDisabled || member.enabled))
        .map((member) => ({
          masterAgentId: member.masterAgentId,
          title: member.title,
          isManager: member.isManager,
          sortOrder: member.sortOrder,
        })),
    }));
  }

  async function uniqueSlug(title: string, ignoreId?: string) {
    const base = slugify(title);
    const rows = await db.select({ id: masterAgents.id, slug: masterAgents.slug }).from(masterAgents);
    const taken = new Set(rows.filter((row) => row.id !== ignoreId).map((row) => row.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  async function clearRecommended(exceptId?: string) {
    await db
      .update(masterAgents)
      .set({ recommended: false, updatedAt: new Date() })
      .where(exceptId ? and(eq(masterAgents.recommended, true), sql`${masterAgents.id} <> ${exceptId}`) : eq(masterAgents.recommended, true));
  }

  async function createAgent(input: CreateMasterAgent): Promise<MasterAgentRecord> {
    await ensureSeed();
    if (input.recommended) await clearRecommended();
    const slug = await uniqueSlug(input.title);
    const [row] = await db.insert(masterAgents).values({
      slug,
      title: input.title,
      department: input.department,
      role: input.role ?? "general",
      description: input.description,
      instructions: input.instructions,
      icon: input.icon ?? "user",
      skillKeys: input.skillKeys ?? [],
      canCreateAgents: input.canCreateAgents ?? false,
      enabled: input.enabled ?? true,
      recommended: input.recommended ?? false,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    if (!row) throw unprocessable("Could not create the master agent");
    return toAgentRecord(row);
  }

  async function updateAgent(id: string, input: UpdateMasterAgent): Promise<MasterAgentRecord> {
    await ensureSeed();
    const [current] = await db.select().from(masterAgents).where(eq(masterAgents.id, id));
    if (!current) throw notFound("Master agent not found");
    if (input.recommended) await clearRecommended(id);
    const [row] = await db.update(masterAgents).set({
      title: input.title ?? current.title,
      department: input.department ?? current.department,
      role: input.role ?? current.role,
      description: input.description ?? current.description,
      instructions: input.instructions ?? current.instructions,
      icon: input.icon ?? current.icon,
      skillKeys: input.skillKeys ?? current.skillKeys,
      canCreateAgents: input.canCreateAgents ?? current.canCreateAgents,
      enabled: input.enabled ?? current.enabled,
      recommended: input.recommended ?? current.recommended,
      sortOrder: input.sortOrder ?? current.sortOrder,
      updatedAt: new Date(),
    }).where(eq(masterAgents.id, id)).returning();
    if (!row) throw notFound("Master agent not found");
    return toAgentRecord(row);
  }

  async function removeAgent(id: string) {
    await ensureSeed();
    const [member] = await db
      .select({ id: masterTeamMembers.id })
      .from(masterTeamMembers)
      .where(eq(masterTeamMembers.masterAgentId, id))
      .limit(1);
    if (member) throw conflict("Remove this agent from its team before deleting it");
    const [row] = await db.delete(masterAgents).where(eq(masterAgents.id, id)).returning({ id: masterAgents.id });
    if (!row) throw notFound("Master agent not found");
  }

  async function assertMembers(department: string, memberIds: string[], managerId: string) {
    const rows = await db.select().from(masterAgents).where(eq(masterAgents.department, department));
    const allowed = new Set(rows.map((row) => row.id));
    for (const memberId of memberIds) {
      if (!allowed.has(memberId)) {
        throw unprocessable("Team members must be master agents in the same department");
      }
    }
    if (!memberIds.includes(managerId)) {
      throw unprocessable("The manager must be one of the team members");
    }
  }

  async function replaceMembers(teamId: string, memberIds: string[], managerId: string) {
    await db.delete(masterTeamMembers).where(eq(masterTeamMembers.teamId, teamId));
    await db.insert(masterTeamMembers).values(memberIds.map((masterAgentId, index) => ({
      teamId,
      masterAgentId,
      isManager: masterAgentId === managerId,
      sortOrder: index,
    })));
  }

  async function createTeam(input: CreateMasterTeam): Promise<MasterTeamRecord> {
    await ensureSeed();
    const [departmentTaken] = await db
      .select({ id: masterTeams.id })
      .from(masterTeams)
      .where(eq(masterTeams.department, input.department))
      .limit(1);
    if (departmentTaken) throw conflict("That department already has a team");
    await assertMembers(input.department, input.memberIds, input.managerId);
    const slug = slugify(input.name);
    const [team] = await db.insert(masterTeams).values({
      slug,
      name: input.name,
      description: input.description,
      department: input.department,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
    }).returning();
    if (!team) throw unprocessable("Could not create the team");
    await replaceMembers(team.id, input.memberIds, input.managerId);
    const [listed] = (await listTeams(true)).filter((row) => row.id === team.id);
    if (!listed) throw unprocessable("Could not create the team");
    return listed;
  }

  async function updateTeam(id: string, input: UpdateMasterTeam): Promise<MasterTeamRecord> {
    await ensureSeed();
    const [current] = await db.select().from(masterTeams).where(eq(masterTeams.id, id));
    if (!current) throw notFound("Master team not found");
    const department = input.department ?? current.department;
    if (department !== current.department) {
      const [taken] = await db.select({ id: masterTeams.id }).from(masterTeams).where(eq(masterTeams.department, department)).limit(1);
      if (taken && taken.id !== id) throw conflict("That department already has a team");
    }
    await db.update(masterTeams).set({
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      department,
      enabled: input.enabled ?? current.enabled,
      sortOrder: input.sortOrder ?? current.sortOrder,
      updatedAt: new Date(),
    }).where(eq(masterTeams.id, id));
    if (input.memberIds && input.managerId) {
      await assertMembers(department, input.memberIds, input.managerId);
      await replaceMembers(id, input.memberIds, input.managerId);
    }
    const [listed] = (await listTeams(true)).filter((row) => row.id === id);
    if (!listed) throw notFound("Master team not found");
    return listed;
  }

  async function removeTeam(id: string) {
    await ensureSeed();
    const [row] = await db.delete(masterTeams).where(eq(masterTeams.id, id)).returning({ id: masterTeams.id });
    if (!row) throw notFound("Master team not found");
  }

  async function defaultModelStatus(): Promise<DefaultModelStatus> {
    const [row] = await db.select().from(instanceDefaultModels).limit(1);
    if (!row) {
      return { configured: true, ...IMPLICIT_PLATFORM_DEFAULT_MODEL };
    }
    return {
      configured: true,
      adapterType: row.adapterType as DefaultModelStatus["adapterType"],
      model: row.model,
      credentialKind: row.credentialKind as DefaultModelStatus["credentialKind"],
    };
  }

  async function putDefaultModel(input: PutDefaultModel, ownerUserId: string | null) {
    const provider = getSecretProvider("local_encrypted");
    const material = input.credential.kind === "api_key"
      ? (await provider.createSecret({ value: input.credential.apiKey })).material
      : null;
    const values = {
      adapterType: input.adapterType,
      model: input.model,
      credentialKind: input.credential.kind,
      ownerUserId: input.credential.kind === "stored_login" ? ownerUserId : null,
      apiKeyMaterial: material as Record<string, unknown> | null,
      updatedAt: new Date(),
    };
    const [existing] = await db.select({ id: instanceDefaultModels.id }).from(instanceDefaultModels).limit(1);
    if (existing) {
      await db.update(instanceDefaultModels).set(values).where(eq(instanceDefaultModels.id, existing.id));
    } else {
      await db.insert(instanceDefaultModels).values({ singletonKey: "default", ...values });
    }
    return defaultModelStatus();
  }

  async function installSkills(companyId: string, skillKeys: string[]) {
    for (const key of skillKeys) {
      const catalogSkill = resolveCatalogSkillRef(key);
      if (!catalogSkill) continue;
      await skills.installFromCatalog(companyId, { catalogSkillId: catalogSkill.id });
    }
  }

  async function hireOne(params: {
    companyId: string;
    companyName: string;
    master: MasterAgentRecord;
    reportsTo: string | null;
    adapterType: string;
    model: string;
    env?: Record<string, unknown>;
    ownerUserId: string | null;
    credentialKind: string;
    actor: { actorType: "user" | "agent" | "system"; actorId: string; userId: string | null };
  }) {
    const baseConfig: Record<string, unknown> = {
      model: params.model,
      timeoutSec: 0,
      graceSec: 15,
    };
    if (params.adapterType === "claude_local") baseConfig.dangerouslySkipPermissions = true;
    if (params.env) baseConfig.env = params.env;
    const adapterConfig = writePaperclipSkillSyncPreference(baseConfig, params.master.skillKeys);
    const created = await agentsSvc.create(params.companyId, {
      name: params.master.title,
      title: params.master.title,
      role: params.master.role,
      icon: params.master.icon,
      appearance: legacyAgentAppearance(params.master.id),
      metadata: { masterAgentId: params.master.id },
      reportsTo: params.reportsTo,
      adapterType: params.adapterType,
      adapterConfig,
      permissions: { canCreateAgents: params.master.canCreateAgents },
      status: "idle",
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
    }, params.credentialKind === "stored_login" && params.adapterType === "claude_local"
      ? {
          claudeLogin: {
            ownerUserId: params.ownerUserId,
            applyExistingWithoutClaim: true,
          },
        }
      : undefined);
    const instructionsText = fillInstructions(params.master.instructions, created.name, params.companyName);
    const materialized = await instructions.materializeManagedBundle(
      created,
      { "AGENTS.md": instructionsText },
      { entryFile: "AGENTS.md", replaceExisting: false },
    );
    const updated = await agentsSvc.update(created.id, { adapterConfig: materialized.adapterConfig }, {
      allowPendingApprovalConfigUpdate: true,
    });
    await installSkills(params.companyId, params.master.skillKeys);
    await logActivity(db, {
      companyId: params.companyId,
      actorType: params.actor.actorType,
      actorId: params.actor.actorId,
      action: "agent.hired_from_master",
      entityType: "agent",
      entityId: created.id,
      details: {
        masterAgentId: params.master.id,
        title: params.master.title,
        adapterType: params.adapterType,
      },
    });
    return updated ?? created;
  }

  async function hire(
    companyId: string,
    input: OnboardingHireRequest,
    actor: { actorType: "user" | "agent" | "system"; actorId: string; userId: string | null },
  ) {
    await ensureSeed();
    const [storedModel] = await db.select().from(instanceDefaultModels).limit(1);
    const modelRow = storedModel ?? {
      adapterType: IMPLICIT_PLATFORM_DEFAULT_MODEL.adapterType,
      model: IMPLICIT_PLATFORM_DEFAULT_MODEL.model,
      credentialKind: IMPLICIT_PLATFORM_DEFAULT_MODEL.credentialKind,
      ownerUserId: null,
      apiKeyMaterial: null,
    };
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) throw notFound("Company not found");

    let env: Record<string, unknown> | undefined;
    if (modelRow.credentialKind === "api_key" && modelRow.apiKeyMaterial) {
      const envKey = API_KEY_ENV[modelRow.adapterType] ?? "API_KEY";
      const plaintext = await getSecretProvider("local_encrypted").resolveVersion({
        material: modelRow.apiKeyMaterial as StoredSecretVersionMaterial,
        externalRef: null,
      });
      const secret = await secrets.create(companyId, {
        name: `${envKey} · platform default`,
        key: `${envKey}.platform.${randomUUID()}`,
        provider: "local_encrypted",
        value: plaintext,
        description: "Platform default model credential copied at onboarding hire.",
      }, { userId: actor.userId });
      env = { [envKey]: { type: "secret_ref", secretId: secret.id, version: "latest" } };
    }

    const hireParams = {
      companyId,
      companyName: company.name,
      adapterType: modelRow.adapterType,
      model: modelRow.model,
      env,
      ownerUserId: modelRow.ownerUserId,
      credentialKind: modelRow.credentialKind,
      actor,
    };

    const companyAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
    const hiredMasterIds = new Set<string>();
    for (const row of companyAgents) {
      const fromMeta = masterAgentIdFromMetadata(row.metadata);
      if (fromMeta) hiredMasterIds.add(fromMeta);
    }
    const findExistingForMaster = (master: MasterAgentRecord) => {
      if (hiredMasterIds.has(master.id)) {
        return companyAgents.find((row) => masterAgentIdFromMetadata(row.metadata) === master.id)
          ?? companyAgents.find((row) => row.title === master.title || row.name === master.title)
          ?? null;
      }
      return companyAgents.find((row) => row.title === master.title || row.name === master.title) ?? null;
    };
    const markHired = (masterId: string) => {
      hiredMasterIds.add(masterId);
    };

    if (input.masterAgentId) {
      const [row] = await db.select().from(masterAgents).where(eq(masterAgents.id, input.masterAgentId));
      if (!row || !row.enabled) throw notFound("Master agent not found");
      const master = toAgentRecord(row);
      if (findExistingForMaster(master)) {
        throw conflict("This starter is already hired in this organization");
      }
      const agent = await hireOne({ ...hireParams, master, reportsTo: null });
      return { agents: [agent], managerAgentId: agent.id, label: agent.name };
    }

    const [team] = await db.select().from(masterTeams).where(eq(masterTeams.id, input.masterTeamId!));
    if (!team || !team.enabled) throw notFound("Master team not found");
    const memberRows = await db
      .select({ member: masterTeamMembers, agent: masterAgents })
      .from(masterTeamMembers)
      .innerJoin(masterAgents, eq(masterAgents.id, masterTeamMembers.masterAgentId))
      .where(eq(masterTeamMembers.teamId, team.id))
      .orderBy(asc(masterTeamMembers.sortOrder));
    const enabledMembers = memberRows.filter((row) => row.agent.enabled);
    const manager = enabledMembers.find((row) => row.member.isManager);
    if (!manager) throw unprocessable("The team manager is not available");

    const managerMaster = toAgentRecord(manager.agent);
    const existingManager = findExistingForMaster(managerMaster);
    const hired: Awaited<ReturnType<typeof hireOne>>[] = [];
    let managerAgentId: string;
    if (existingManager) {
      managerAgentId = existingManager.id;
      markHired(managerMaster.id);
    } else {
      const hiredManager = await hireOne({
        ...hireParams,
        master: managerMaster,
        reportsTo: null,
      });
      hired.push(hiredManager);
      managerAgentId = hiredManager.id;
      markHired(managerMaster.id);
    }

    for (const row of enabledMembers) {
      if (row.member.isManager) continue;
      const master = toAgentRecord(row.agent);
      if (findExistingForMaster(master)) {
        markHired(master.id);
        continue;
      }
      const created = await hireOne({
        ...hireParams,
        master,
        reportsTo: managerAgentId,
      });
      hired.push(created);
      markHired(master.id);
    }

    if (hired.length === 0) {
      throw conflict("Every member of this team is already hired in this organization");
    }
    return { agents: hired, managerAgentId, label: team.name };
  }

  async function logInstanceChange(actor: { actorType: "user" | "agent" | "system"; actorId: string }, action: string, entityId: string) {
    const companyIds = await settings.listCompanyIds();
    await Promise.all(companyIds.map((companyId) => logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action,
      entityType: "master_agent",
      entityId,
      details: null,
    })));
  }

  return {
    ensureSeed,
    listAgents,
    listTeams,
    createAgent,
    updateAgent,
    removeAgent,
    createTeam,
    updateTeam,
    removeTeam,
    defaultModelStatus,
    putDefaultModel,
    hire,
    logInstanceChange,
  };
}
