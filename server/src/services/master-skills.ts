import { and, asc, eq, sql } from "drizzle-orm";
import {
  masterSkillCatalogPrefs,
  masterSkills,
  type Db,
} from "@paperclipai/db";
import { listCatalogSkillsOrEmpty } from "./skills-catalog.js";
import {
  isMasterCustomSkillKey,
  masterCustomSkillKey,
  masterCustomSkillSlugFromKey,
  type CreateMasterSkill,
  type MasterSkillCatalogPref,
  type MasterSkillOption,
  type MasterSkillRecord,
  type UpdateMasterSkill,
  type UpsertMasterSkillCatalogPref,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { logActivity } from "./activity-log.js";
import { instanceSettingsService } from "./instance-settings.js";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "skill";
}

function toSkillRecord(row: typeof masterSkills.$inferSelect): MasterSkillRecord {
  return {
    id: row.id,
    slug: row.slug,
    key: masterCustomSkillKey(row.slug),
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    enabled: row.enabled,
    recommended: row.recommended,
    sortOrder: row.sortOrder,
  };
}

function toPrefRecord(row: typeof masterSkillCatalogPrefs.$inferSelect): MasterSkillCatalogPref {
  return {
    catalogKey: row.catalogKey,
    enabled: row.enabled,
    recommended: row.recommended,
    sortOrder: row.sortOrder,
  };
}

export function masterSkillService(db: Db) {
  const settings = instanceSettingsService(db);

  async function listPrefs(): Promise<MasterSkillCatalogPref[]> {
    const rows = await db
      .select()
      .from(masterSkillCatalogPrefs)
      .orderBy(asc(masterSkillCatalogPrefs.sortOrder), asc(masterSkillCatalogPrefs.catalogKey));
    return rows.map(toPrefRecord);
  }

  async function upsertPref(input: UpsertMasterSkillCatalogPref): Promise<MasterSkillCatalogPref> {
    const catalogKey = input.catalogKey.trim();
    if (!catalogKey) throw unprocessable("catalogKey is required");
    const catalog = listCatalogSkillsOrEmpty().find((skill) => skill.key === catalogKey || skill.id === catalogKey);
    if (!catalog) throw unprocessable(`Unknown catalog skill: ${catalogKey}`);
    const key = catalog.key;
    const [existing] = await db
      .select()
      .from(masterSkillCatalogPrefs)
      .where(eq(masterSkillCatalogPrefs.catalogKey, key))
      .limit(1);
    if (existing) {
      const [row] = await db
        .update(masterSkillCatalogPrefs)
        .set({
          enabled: input.enabled ?? existing.enabled,
          recommended: input.recommended ?? existing.recommended,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(masterSkillCatalogPrefs.catalogKey, key))
        .returning();
      if (!row) throw notFound("Catalog preference not found");
      return toPrefRecord(row);
    }
    const [row] = await db
      .insert(masterSkillCatalogPrefs)
      .values({
        catalogKey: key,
        enabled: input.enabled ?? true,
        recommended: input.recommended ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    if (!row) throw unprocessable("Could not save catalog preference");
    return toPrefRecord(row);
  }

  async function listCustom(includeDisabled: boolean): Promise<MasterSkillRecord[]> {
    const rows = includeDisabled
      ? await db.select().from(masterSkills).orderBy(asc(masterSkills.sortOrder), asc(masterSkills.name))
      : await db
        .select()
        .from(masterSkills)
        .where(eq(masterSkills.enabled, true))
        .orderBy(asc(masterSkills.sortOrder), asc(masterSkills.name));
    return rows.map(toSkillRecord);
  }

  async function uniqueSlug(name: string, preferred?: string) {
    const base = preferred?.trim() || slugify(name);
    const rows = await db.select({ slug: masterSkills.slug }).from(masterSkills);
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  async function clearRecommended(exceptId?: string) {
    await db
      .update(masterSkills)
      .set({ recommended: false, updatedAt: new Date() })
      .where(
        exceptId
          ? and(eq(masterSkills.recommended, true), sql`${masterSkills.id} <> ${exceptId}`)
          : eq(masterSkills.recommended, true),
      );
  }

  async function createCustom(input: CreateMasterSkill): Promise<MasterSkillRecord> {
    if (input.recommended) await clearRecommended();
    const slug = await uniqueSlug(input.name, input.slug);
    const [row] = await db
      .insert(masterSkills)
      .values({
        slug,
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        category: input.category ?? "general",
        tags: input.tags ?? [],
        enabled: input.enabled ?? true,
        recommended: input.recommended ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    if (!row) throw unprocessable("Could not create the master skill");
    return toSkillRecord(row);
  }

  async function updateCustom(id: string, input: UpdateMasterSkill): Promise<MasterSkillRecord> {
    const [current] = await db.select().from(masterSkills).where(eq(masterSkills.id, id)).limit(1);
    if (!current) throw notFound("Master skill not found");
    if (input.recommended) await clearRecommended(id);
    const [row] = await db
      .update(masterSkills)
      .set({
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        instructions: input.instructions ?? current.instructions,
        category: input.category ?? current.category,
        tags: input.tags ?? current.tags,
        enabled: input.enabled ?? current.enabled,
        recommended: input.recommended ?? current.recommended,
        sortOrder: input.sortOrder ?? current.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(masterSkills.id, id))
      .returning();
    if (!row) throw notFound("Master skill not found");
    return toSkillRecord(row);
  }

  async function removeCustom(id: string) {
    const [row] = await db.delete(masterSkills).where(eq(masterSkills.id, id)).returning({ id: masterSkills.id });
    if (!row) throw notFound("Master skill not found");
  }

  async function getCustomBySlug(slug: string): Promise<MasterSkillRecord | null> {
    const [row] = await db.select().from(masterSkills).where(eq(masterSkills.slug, slug)).limit(1);
    return row ? toSkillRecord(row) : null;
  }

  /**
   * Effective picker list: shipped catalog (opt-out disabled via prefs) + custom master skills.
   * When includeDisabled is false, only enabled options are returned.
   */
  async function listEffectiveOptions(includeDisabled = false): Promise<MasterSkillOption[]> {
    const prefs = await listPrefs();
    const prefByKey = new Map(prefs.map((pref) => [pref.catalogKey, pref]));
    const catalogOptions: MasterSkillOption[] = listCatalogSkillsOrEmpty().map((skill) => {
      const pref = prefByKey.get(skill.key);
      const enabled = pref?.enabled ?? true;
      return {
        key: skill.key,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        kind: "catalog" as const,
        enabled,
        recommended: pref?.recommended ?? false,
        sortOrder: pref?.sortOrder ?? 0,
      };
    });
    const custom = await listCustom(true);
    const customOptions: MasterSkillOption[] = custom.map((skill) => ({
      key: skill.key,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      kind: "custom" as const,
      enabled: skill.enabled,
      recommended: skill.recommended,
      sortOrder: skill.sortOrder,
    }));
    const merged = [...catalogOptions, ...customOptions]
      .filter((option) => includeDisabled || option.enabled)
      .sort((a, b) => {
        if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
    return merged;
  }

  /** Throws if any key is unknown or disabled. */
  async function assertSkillKeysAllowed(skillKeys: string[]) {
    const enabled = await listEffectiveOptions(false);
    const allowed = new Set(enabled.map((option) => option.key));
    const invalid: string[] = [];
    for (const key of skillKeys) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      if (!allowed.has(trimmed)) invalid.push(trimmed);
    }
    if (invalid.length > 0) {
      throw unprocessable(`Unknown or disabled skill keys: ${invalid.join(", ")}`);
    }
  }

  async function resolveCustomForHire(key: string): Promise<MasterSkillRecord | null> {
    const slug = masterCustomSkillSlugFromKey(key);
    if (!slug) return null;
    const skill = await getCustomBySlug(slug);
    if (!skill || !skill.enabled) return null;
    return skill;
  }

  async function logInstanceChange(
    actor: { actorType: "user" | "agent" | "system"; actorId: string },
    action: string,
    entityId: string,
  ) {
    const companyIds = await settings.listCompanyIds();
    await Promise.all(companyIds.map((companyId) => logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action,
      entityType: "master_skill",
      entityId,
      details: null,
    })));
  }

  return {
    listPrefs,
    upsertPref,
    listCustom,
    createCustom,
    updateCustom,
    removeCustom,
    getCustomBySlug,
    listEffectiveOptions,
    assertSkillKeysAllowed,
    resolveCustomForHire,
    isMasterCustomSkillKey,
    logInstanceChange,
  };
}
