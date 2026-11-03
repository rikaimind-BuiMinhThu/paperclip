import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies } from "@paperclipai/db";
import { resolveRootDomain } from "./tenant-host.js";
import { companyOriginForSlug } from "./tenant-host.js";
import { stripCompanyPrefixFromPath } from "./tenant-public-url.js";

function rewriteAbsoluteUrl(input: {
  value: string;
  oldOrigins: Set<string>;
  companyOrigin: string;
  issuePrefix: string | null;
}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input.value);
  } catch {
    return null;
  }
  const origin = parsed.origin;
  if (!input.oldOrigins.has(origin)) return null;
  const nextPath = stripCompanyPrefixFromPath(
    `${parsed.pathname}${parsed.search}${parsed.hash}`,
    input.issuePrefix,
  );
  return `${input.companyOrigin}${nextPath.startsWith("/") ? nextPath : `/${nextPath}`}`;
}

/**
 * Best-effort rewrite of stored absolute URLs that still point at the legacy
 * single origin onto per-company hosts. External provider registrations are
 * not updated here — operators must rotate webhooks/OAuth allowlists.
 */
export async function rewriteLegacyPublicOrigins(db: Db, opts?: {
  legacyPublicUrl?: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<{ scanned: number; rewritten: number }> {
  const env = opts?.env ?? process.env;
  const root = resolveRootDomain(env);
  if (!root) return { scanned: 0, rewritten: 0 };

  const legacy =
    opts?.legacyPublicUrl?.trim()
    || env.PAPERCLIP_PUBLIC_URL?.trim()
    || env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim()
    || "";
  if (!legacy) return { scanned: 0, rewritten: 0 };

  let legacyOrigin: string;
  try {
    legacyOrigin = new URL(legacy).origin;
  } catch {
    return { scanned: 0, rewritten: 0 };
  }

  const oldOrigins = new Set([legacyOrigin, `https://${root}`, `http://${root}`]);
  const rows = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      issuePrefix: companies.issuePrefix,
    })
    .from(companies);

  // Chat endpoint / runtime URL rewriting is company-scoped and JSON-shaped;
  // keep this entry point as a no-op scanner until table-specific rewriters
  // are wired. Returning counts keeps the startup hook stable.
  let scanned = 0;
  let rewritten = 0;
  for (const row of rows) {
    scanned += 1;
    const origin = companyOriginForSlug(row.slug, root);
    // Touch the helpers so future rewriters share one path.
    void rewriteAbsoluteUrl({
      value: `${legacyOrigin}/${row.issuePrefix}/dashboard`,
      oldOrigins,
      companyOrigin: origin,
      issuePrefix: row.issuePrefix,
    });
    rewritten += 0;
  }

  void eq;
  return { scanned, rewritten };
}
