import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies } from "@paperclipai/db";
import {
  COMPANY_SLUG_PATTERN,
  companySlugForAttempt,
  isReservedCompanySlug,
  preferIssuePrefixOrNameSlug,
  validateCompanySlug,
} from "@paperclipai/shared";

export const MAX_COMPANY_SLUG_ATTEMPTS = 10_000;

type DbLike = Pick<Db, "select" | "execute">;

export function isCompanySlugConflict(error: unknown) {
  const seen = new Set<unknown>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const maybe = current as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
      cause?: unknown;
    };
    const constraint = maybe.constraint ?? maybe.constraint_name;
    if (maybe.code === "23505" && constraint === "companies_slug_idx") {
      return true;
    }
    current = maybe.cause;
  }
  return false;
}

export async function isCompanySlugTaken(
  db: DbLike,
  slug: string,
  exceptCompanyId?: string,
): Promise<boolean> {
  const conditions = [eq(companies.slug, slug)];
  if (exceptCompanyId) {
    conditions.push(ne(companies.id, exceptCompanyId));
  }
  const row = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(...conditions))
    .then((rows) => rows[0] ?? null);
  return Boolean(row);
}

/**
 * Pick a free slug. Prefer explicit validated input, else issuePrefix/name.
 */
export async function pickAvailableCompanySlug(
  db: DbLike,
  input: {
    name: string;
    issuePrefix?: string | null;
    preferredSlug?: string | null;
    exceptCompanyId?: string;
  },
): Promise<string> {
  let base: string;
  if (input.preferredSlug) {
    const validated = validateCompanySlug(input.preferredSlug);
    if (!validated.ok) {
      throw new Error(validated.error);
    }
    base = validated.slug;
  } else {
    base = preferIssuePrefixOrNameSlug({
      name: input.name,
      issuePrefix: input.issuePrefix,
    });
  }

  for (let attempt = 1; attempt <= MAX_COMPANY_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = companySlugForAttempt(base, attempt);
    if (!COMPANY_SLUG_PATTERN.test(candidate) || isReservedCompanySlug(candidate)) {
      continue;
    }
    const taken = await isCompanySlugTaken(db, candidate, input.exceptCompanyId);
    if (!taken) return candidate;
  }
  throw new Error("Unable to allocate unique company slug");
}

/**
 * Idempotent backfill for rows missing a unique slug (startup safety net).
 */
export async function backfillCompanySlugs(db: Db): Promise<{ updated: number }> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      issuePrefix: companies.issuePrefix,
      slug: companies.slug,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .orderBy(asc(companies.createdAt), asc(companies.id));

  let updated = 0;
  const used = new Set<string>();

  for (const row of rows) {
    const current = row.slug?.trim().toLowerCase() ?? "";
    const currentOk =
      current
      && COMPANY_SLUG_PATTERN.test(current)
      && !isReservedCompanySlug(current)
      && !used.has(current);

    if (currentOk) {
      used.add(current);
      continue;
    }

    const base = preferIssuePrefixOrNameSlug({
      name: row.name,
      issuePrefix: row.issuePrefix,
    });
    let next = base;
    for (let attempt = 1; attempt <= MAX_COMPANY_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = companySlugForAttempt(base, attempt);
      if (
        COMPANY_SLUG_PATTERN.test(candidate)
        && !isReservedCompanySlug(candidate)
        && !used.has(candidate)
      ) {
        next = candidate;
        break;
      }
    }

    if (next !== row.slug) {
      await db
        .update(companies)
        .set({ slug: next, updatedAt: new Date() })
        .where(eq(companies.id, row.id));
      updated += 1;
    }
    used.add(next);
  }

  return { updated };
}

/** Detect placeholder/default-only slug rows that still need uniqueness repair. */
export async function countCompaniesMissingUniqueSlug(db: DbLike): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT slug
      FROM companies
      GROUP BY slug
      HAVING COUNT(*) > 1
    ) dupes
  `);
  const rows = result as unknown as Array<{ count?: number }>;
  return Number(rows[0]?.count ?? 0);
}
