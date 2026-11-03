import {
  adminOrigin,
  apexOrigin,
  companyOriginForSlug,
  resolveAdminSubdomain,
  resolveRootDomain,
} from "./tenant-host.js";

/**
 * Build the browser origin for a company when host tenancy is enabled.
 * Falls back to a single public URL when root domain is unset (legacy).
 */
export function resolveCompanyPublicOrigin(input: {
  slug: string | null | undefined;
  legacyPublicUrl?: string | null;
  proto?: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const env = input.env ?? process.env;
  const root = resolveRootDomain(env);
  const slug = input.slug?.trim().toLowerCase() ?? "";
  if (root && slug) {
    return companyOriginForSlug(slug, root, input.proto ?? "https");
  }
  const legacy = input.legacyPublicUrl?.trim() || env.PAPERCLIP_PUBLIC_URL?.trim() || "";
  return legacy ? legacy.replace(/\/+$/, "") : null;
}

export function resolveApexPublicOrigin(input?: {
  legacyPublicUrl?: string | null;
  proto?: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const env = input?.env ?? process.env;
  const root = resolveRootDomain(env);
  if (root) return apexOrigin(root, input?.proto ?? "https");
  const legacy =
    input?.legacyPublicUrl?.trim()
    || env.PAPERCLIP_PUBLIC_URL?.trim()
    || "";
  return legacy ? legacy.replace(/\/+$/, "") : null;
}

export function resolveAdminPublicOrigin(input?: {
  proto?: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const env = input?.env ?? process.env;
  const root = resolveRootDomain(env);
  if (!root) return null;
  return adminOrigin(root, resolveAdminSubdomain(env), input?.proto ?? "https");
}

/**
 * Rewrite a path that may still carry `/{issuePrefix}/...` into a host-tenancy
 * relative path (`/...`).
 */
export function stripCompanyPrefixFromPath(
  path: string,
  issuePrefix: string | null | undefined,
): string {
  if (!issuePrefix) return path;
  const prefix = `/${issuePrefix}`.toLowerCase();
  const match = path.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!match) return path;
  const pathname = match[1] ?? path;
  const rest = `${match[2] ?? ""}${match[3] ?? ""}`;
  if (pathname.toLowerCase() === prefix) return `/${rest}`;
  if (pathname.toLowerCase().startsWith(`${prefix}/`)) {
    return `${pathname.slice(prefix.length)}${rest}`;
  }
  return path;
}
