/**
 * Host → tenant resolution for company subdomain tenancy.
 *
 * Active when `PAPERCLIP_ROOT_DOMAIN` is set. Apex and `www` are marketing-only.
 * `admin` is the platform-admin host. Other labels look up `companies.slug`.
 */

export type TenantKind = "legacy" | "apex" | "admin" | "company" | "unknown";

export interface TenantResolution {
  kind: TenantKind;
  hostname: string;
  /** Present when kind === "company". */
  slug: string | null;
  rootDomain: string | null;
  hostTenancyEnabled: boolean;
}

export function normalizeHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  try {
    return new URL(`http://${first}`).hostname.trim().toLowerCase();
  } catch {
    return first.trim().toLowerCase();
  }
}

export function resolveRootDomain(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.PAPERCLIP_ROOT_DOMAIN?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  return raw.replace(/^\.+|\.+$/g, "") || null;
}

export function resolveAdminSubdomain(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PAPERCLIP_ADMIN_SUBDOMAIN?.trim().toLowerCase() ?? "admin";
  return raw || "admin";
}

/**
 * Dev override: `X-Paperclip-Company-Slug` or `?__companySlug=` when host
 * tenancy is enabled and the request host is loopback / unmatched.
 */
export function readDevCompanySlugOverride(
  headers: { get?: (name: string) => string | null | undefined } | Record<string, unknown>,
  querySlug?: string | null,
): string | null {
  const fromQuery = querySlug?.trim().toLowerCase() || null;
  if (fromQuery) return fromQuery;

  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as { get: (name: string) => string | null | undefined }).get(
      "x-paperclip-company-slug",
    );
    return value?.trim().toLowerCase() || null;
  }

  const record = headers as Record<string, unknown>;
  const raw = record["x-paperclip-company-slug"] ?? record["X-Paperclip-Company-Slug"];
  if (typeof raw === "string") return raw.trim().toLowerCase() || null;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim().toLowerCase() || null;
  return null;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".localhost")
  );
}

/**
 * Pure host classification (no DB). Company lookup happens in middleware.
 */
export function classifyTenantHost(input: {
  hostname: string | null;
  rootDomain: string | null;
  adminSubdomain?: string;
  devSlugOverride?: string | null;
}): TenantResolution {
  const rootDomain = input.rootDomain;
  const hostname = input.hostname;

  if (!rootDomain) {
    return {
      kind: "legacy",
      hostname: hostname ?? "",
      slug: null,
      rootDomain: null,
      hostTenancyEnabled: false,
    };
  }

  if (!hostname) {
    return {
      kind: "unknown",
      hostname: "",
      slug: null,
      rootDomain,
      hostTenancyEnabled: true,
    };
  }

  const adminSubdomain = (input.adminSubdomain ?? "admin").toLowerCase();

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return {
      kind: "apex",
      hostname,
      slug: null,
      rootDomain,
      hostTenancyEnabled: true,
    };
  }

  if (hostname === `${adminSubdomain}.${rootDomain}`) {
    return {
      kind: "admin",
      hostname,
      slug: null,
      rootDomain,
      hostTenancyEnabled: true,
    };
  }

  const suffix = `.${rootDomain}`;
  if (hostname.endsWith(suffix)) {
    const label = hostname.slice(0, -suffix.length);
    if (label && !label.includes(".")) {
      return {
        kind: "company",
        hostname,
        slug: label,
        rootDomain,
        hostTenancyEnabled: true,
      };
    }
  }

  // Local / unmatched hosts: allow explicit slug override in development.
  if (input.devSlugOverride && (isLoopbackHost(hostname) || process.env.NODE_ENV !== "production")) {
    if (input.devSlugOverride === adminSubdomain) {
      return {
        kind: "admin",
        hostname,
        slug: null,
        rootDomain,
        hostTenancyEnabled: true,
      };
    }
    if (input.devSlugOverride === "apex" || input.devSlugOverride === "www") {
      return {
        kind: "apex",
        hostname,
        slug: null,
        rootDomain,
        hostTenancyEnabled: true,
      };
    }
    return {
      kind: "company",
      hostname,
      slug: input.devSlugOverride,
      rootDomain,
      hostTenancyEnabled: true,
    };
  }

  // `*.localhost` convenience: `acme.localhost` → company acme when root is set.
  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length);
    if (label && !label.includes(".")) {
      if (label === adminSubdomain) {
        return {
          kind: "admin",
          hostname,
          slug: null,
          rootDomain,
          hostTenancyEnabled: true,
        };
      }
      return {
        kind: "company",
        hostname,
        slug: label,
        rootDomain,
        hostTenancyEnabled: true,
      };
    }
  }

  return {
    kind: "unknown",
    hostname,
    slug: null,
    rootDomain,
    hostTenancyEnabled: true,
  };
}

export function companyOriginForSlug(slug: string, rootDomain: string, proto = "https"): string {
  return `${proto}://${slug}.${rootDomain}`;
}

export function apexOrigin(rootDomain: string, proto = "https"): string {
  return `${proto}://${rootDomain}`;
}

export function adminOrigin(rootDomain: string, adminSubdomain = "admin", proto = "https"): string {
  return `${proto}://${adminSubdomain}.${rootDomain}`;
}
