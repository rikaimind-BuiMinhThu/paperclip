import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyMemberships, instanceUserRoles } from "@paperclipai/db";
import { logActivity } from "./activity-log.js";

/**
 * M2 membership collapse: keep the newest active company membership per
 * normal user; archive the rest. Platform/instance admins are skipped.
 */
export async function collapseMultiCompanyMemberships(db: Db): Promise<{
  usersProcessed: number;
  membershipsArchived: number;
}> {
  const adminRows = await db
    .select({ userId: instanceUserRoles.userId })
    .from(instanceUserRoles);
  const adminIds = new Set(adminRows.map((row) => row.userId));

  const multiUserRows = await db.execute(sql`
    SELECT principal_id AS "principalId"
    FROM company_memberships
    WHERE principal_type = 'user'
      AND status = 'active'
    GROUP BY principal_id
    HAVING COUNT(*) > 1
  `);

  const principalIds = (multiUserRows as unknown as Array<{ principalId: string }>)
    .map((row) => row.principalId)
    .filter((id) => id && !adminIds.has(id));

  let usersProcessed = 0;
  let membershipsArchived = 0;

  for (const principalId of principalIds) {
    const memberships = await db
      .select({
        id: companyMemberships.id,
        companyId: companyMemberships.companyId,
        createdAt: companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, principalId),
          eq(companyMemberships.status, "active"),
        ),
      )
      .orderBy(desc(companyMemberships.createdAt), desc(companyMemberships.id));

    if (memberships.length <= 1) continue;

    const [kept, ...extras] = memberships;
    if (!kept || extras.length === 0) continue;

    const extraIds = extras.map((row) => row.id);
    await db
      .update(companyMemberships)
      .set({ status: "archived", updatedAt: new Date() })
      .where(inArray(companyMemberships.id, extraIds));

    membershipsArchived += extras.length;
    usersProcessed += 1;

    await logActivity(db, {
      companyId: kept.companyId,
      actorType: "system",
      actorId: "system",
      action: "company.membership_collapsed",
      entityType: "company_membership",
      entityId: kept.id,
      details: {
        policy: "keep_newest",
        principalId,
        keptCompanyId: kept.companyId,
        archivedCompanyIds: extras.map((row) => row.companyId),
      },
    });
  }

  return { usersProcessed, membershipsArchived };
}

/**
 * Reject adding a second active company membership for a normal user.
 * Returns true when the user may join `companyId`.
 */
export async function canUserJoinCompany(
  db: Db,
  userId: string,
  companyId: string | null,
  opts?: { isInstanceAdmin?: boolean },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (opts?.isInstanceAdmin) return { ok: true };

  const admin = await db
    .select({ userId: instanceUserRoles.userId })
    .from(instanceUserRoles)
    .where(eq(instanceUserRoles.userId, userId))
    .then((rows) => rows[0] ?? null);
  if (admin) return { ok: true };

  const conditions = [
    eq(companyMemberships.principalType, "user"),
    eq(companyMemberships.principalId, userId),
    eq(companyMemberships.status, "active"),
  ];
  if (companyId) {
    conditions.push(ne(companyMemberships.companyId, companyId));
  }

  const otherActive = await db
    .select({
      id: companyMemberships.id,
      companyId: companyMemberships.companyId,
    })
    .from(companyMemberships)
    .where(and(...conditions))
    .then((rows) => rows[0] ?? null);

  if (otherActive) {
    return {
      ok: false,
      reason: "User already belongs to a company",
    };
  }
  return { ok: true };
}
