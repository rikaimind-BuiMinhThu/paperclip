import { asc, eq, sql } from "drizzle-orm";
import {
  masterAgents,
  masterDepartments,
  masterTeams,
  type Db,
} from "@paperclipai/db";
import {
  MASTER_DEPARTMENT_SEED_LEGACY_EN,
  MASTER_DEPARTMENT_SEEDS,
  type CreateMasterDepartment,
  type MasterDepartmentRecord,
  type UpdateMasterDepartment,
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
  return base || "department";
}

function toRecord(row: typeof masterDepartments.$inferSelect): MasterDepartmentRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export function masterDepartmentService(db: Db) {
  const settings = instanceSettingsService(db);

  async function ensureSeed() {
    for (const seed of MASTER_DEPARTMENT_SEEDS) {
      const [existing] = await db
        .select()
        .from(masterDepartments)
        .where(eq(masterDepartments.slug, seed.slug))
        .limit(1);
      if (!existing) {
        await db.insert(masterDepartments).values({
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          enabled: true,
          sortOrder: seed.sortOrder,
        });
        continue;
      }
      // Migrate untouched English seed copy to current seed labels; keep admin renames.
      const legacy = MASTER_DEPARTMENT_SEED_LEGACY_EN[seed.slug];
      const name = existing.name === legacy.name ? seed.name : existing.name;
      const description = existing.description === legacy.description ? seed.description : existing.description;
      if (name === existing.name && description === existing.description) continue;
      await db
        .update(masterDepartments)
        .set({ name, description, updatedAt: new Date() })
        .where(eq(masterDepartments.id, existing.id));
    }
  }

  async function list(includeDisabled: boolean): Promise<MasterDepartmentRecord[]> {
    await ensureSeed();
    const rows = await db
      .select()
      .from(masterDepartments)
      .where(includeDisabled ? undefined : eq(masterDepartments.enabled, true))
      .orderBy(asc(masterDepartments.sortOrder), asc(masterDepartments.name));
    return rows.map(toRecord);
  }

  async function assertDepartmentExists(slug: string) {
    await ensureSeed();
    const [row] = await db
      .select({ id: masterDepartments.id, enabled: masterDepartments.enabled })
      .from(masterDepartments)
      .where(eq(masterDepartments.slug, slug))
      .limit(1);
    if (!row) throw unprocessable(`Unknown master department: ${slug}`);
    return row;
  }

  async function uniqueSlug(name: string, preferred?: string) {
    const base = preferred?.trim() || slugify(name);
    const rows = await db.select({ slug: masterDepartments.slug }).from(masterDepartments);
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  async function create(input: CreateMasterDepartment): Promise<MasterDepartmentRecord> {
    await ensureSeed();
    const slug = await uniqueSlug(input.name, input.slug);
    const [maxSort] = await db
      .select({ value: sql<number>`coalesce(max(${masterDepartments.sortOrder}), -1)` })
      .from(masterDepartments);
    const sortOrder = input.sortOrder ?? ((maxSort?.value ?? -1) + 1);
    const [row] = await db
      .insert(masterDepartments)
      .values({
        slug,
        name: input.name,
        description: input.description ?? "",
        enabled: input.enabled ?? true,
        sortOrder,
      })
      .returning();
    if (!row) throw unprocessable("Could not create the master department");
    return toRecord(row);
  }

  async function update(id: string, input: UpdateMasterDepartment): Promise<MasterDepartmentRecord> {
    await ensureSeed();
    const [current] = await db.select().from(masterDepartments).where(eq(masterDepartments.id, id)).limit(1);
    if (!current) throw notFound("Master department not found");
    const [row] = await db
      .update(masterDepartments)
      .set({
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        enabled: input.enabled ?? current.enabled,
        sortOrder: input.sortOrder ?? current.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(masterDepartments.id, id))
      .returning();
    if (!row) throw notFound("Master department not found");
    return toRecord(row);
  }

  async function remove(id: string) {
    await ensureSeed();
    const [current] = await db.select().from(masterDepartments).where(eq(masterDepartments.id, id)).limit(1);
    if (!current) throw notFound("Master department not found");
    const [agent] = await db
      .select({ id: masterAgents.id })
      .from(masterAgents)
      .where(eq(masterAgents.department, current.slug))
      .limit(1);
    if (agent) throw conflict("Move or delete master agents in this department before deleting it");
    const [team] = await db
      .select({ id: masterTeams.id })
      .from(masterTeams)
      .where(eq(masterTeams.department, current.slug))
      .limit(1);
    if (team) throw conflict("Remove the master team in this department before deleting it");
    const [row] = await db
      .delete(masterDepartments)
      .where(eq(masterDepartments.id, id))
      .returning({ id: masterDepartments.id });
    if (!row) throw notFound("Master department not found");
  }

  async function logInstanceChange(
    actor: { actorType: "user" | "agent" | "system"; actorId: string | null },
    action: string,
    entityId: string,
  ) {
    const companyIds = await settings.listCompanyIds();
    await Promise.all(companyIds.map((companyId) => logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action,
      entityType: "master_department",
      entityId,
      details: null,
    })));
  }

  return {
    ensureSeed,
    list,
    assertDepartmentExists,
    create,
    update,
    remove,
    logInstanceChange,
  };
}
