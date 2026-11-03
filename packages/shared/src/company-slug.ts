/**
 * Company host slug helpers for subdomain tenancy
 * (`{slug}.{PAPERCLIP_ROOT_DOMAIN}`).
 */

export const RESERVED_COMPANY_SLUGS = [
  "www",
  "api",
  "auth",
  "admin",
  "app",
  "static",
  "cdn",
  "mail",
  "status",
  "support",
  "help",
  "docs",
  "home",
  "invite",
  "oauth",
  "assets",
  "health",
  "localhost",
] as const;

const RESERVED_SLUG_SET = new Set<string>(RESERVED_COMPANY_SLUGS);

/** Max DNS label length for a company subdomain. */
export const COMPANY_SLUG_MAX_LENGTH = 63;

/**
 * Valid company slug: lowercase DNS label, 1–63 chars,
 * starts/ends with alphanumeric, hyphens allowed in the middle.
 */
export const COMPANY_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isReservedCompanySlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.trim().toLowerCase());
}

/**
 * Normalize free text into a candidate DNS label (may be empty or reserved).
 */
export function normalizeCompanySlugCandidate(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, COMPANY_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Derive a preferred slug from a company name.
 * Falls back to `"company"` when the name yields nothing usable.
 */
export function deriveCompanySlugBase(name: string): string {
  const fromName = normalizeCompanySlugCandidate(name);
  if (fromName && !isReservedCompanySlug(fromName) && COMPANY_SLUG_PATTERN.test(fromName)) {
    return fromName;
  }
  if (fromName.length >= 1) {
    const padded = fromName.padEnd(1, "x");
    if (COMPANY_SLUG_PATTERN.test(padded) && !isReservedCompanySlug(padded)) {
      return padded;
    }
  }
  return "company";
}

/**
 * Prefer lowercased issuePrefix when it is a valid free slug shape; else name.
 */
export function preferIssuePrefixOrNameSlug(input: {
  name: string;
  issuePrefix?: string | null;
}): string {
  const prefix = input.issuePrefix?.trim().toLowerCase() ?? "";
  if (
    prefix
    && COMPANY_SLUG_PATTERN.test(prefix)
    && !isReservedCompanySlug(prefix)
  ) {
    return prefix;
  }
  return deriveCompanySlugBase(input.name);
}

/**
 * Disambiguating suffix for the nth allocation attempt: "", "-2", "-3", ...
 */
export function companySlugSuffixForAttempt(attempt: number): string {
  if (attempt <= 1) return "";
  return `-${attempt}`;
}

/**
 * Build a collision-safe candidate from a base and attempt number,
 * truncated to fit DNS length limits.
 */
export function companySlugForAttempt(base: string, attempt: number): string {
  const suffix = companySlugSuffixForAttempt(attempt);
  const maxBase = COMPANY_SLUG_MAX_LENGTH - suffix.length;
  const truncated = base.slice(0, Math.max(1, maxBase)).replace(/-+$/g, "") || "company";
  const candidate = `${truncated}${suffix}`;
  if (COMPANY_SLUG_PATTERN.test(candidate) && !isReservedCompanySlug(candidate)) {
    return candidate;
  }
  return `company${suffix || "-2"}`;
}

export type CompanySlugValidation =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export function validateCompanySlug(raw: string): CompanySlugValidation {
  const slug = normalizeCompanySlugCandidate(raw);
  if (!slug) {
    return { ok: false, error: "Slug is required" };
  }
  if (!COMPANY_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "Slug must be a lowercase DNS label (letters, digits, hyphens)",
    };
  }
  if (isReservedCompanySlug(slug)) {
    return { ok: false, error: "This slug is reserved" };
  }
  return { ok: true, slug };
}
