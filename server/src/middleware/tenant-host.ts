import type { Request, RequestHandler, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, invites } from "@paperclipai/db";
import {
  classifyTenantHost,
  companyOriginForSlug,
  normalizeHostname,
  readDevCompanySlugOverride,
  resolveAdminSubdomain,
  resolveRootDomain,
  type TenantKind,
  type TenantResolution,
} from "../services/tenant-host.js";
import { createHash } from "node:crypto";

export type RequestTenant = TenantResolution & {
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  issuePrefix: string | null;
};

declare global {
  namespace Express {
    interface Request {
      tenant?: RequestTenant;
    }
  }
}

function extractHostname(req: Request): string | null {
  const forwarded = req.header("x-forwarded-host");
  const host = req.header("host");
  return normalizeHostname(forwarded || host || null);
}

function wantsJson(req: Request): boolean {
  return req.path.startsWith("/api") || req.accepts(["json", "html", "text"]) === "json";
}

function sendCompanyNotFound(req: Request, res: Response) {
  if (wantsJson(req)) {
    res.status(404).json({ error: "Company not found", code: "company_not_found" });
    return;
  }
  res
    .status(404)
    .type("html")
    .send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Company not found</title></head>
<body>
  <h1>Company not found</h1>
  <p>No company is registered for this subdomain.</p>
</body>
</html>`);
}

function emptyTenant(resolution: TenantResolution): RequestTenant {
  return {
    ...resolution,
    companyId: null,
    companyName: null,
    companySlug: null,
    issuePrefix: null,
  };
}

export function tenantHostMiddleware(db: Db): RequestHandler {
  const rootDomain = resolveRootDomain();
  const adminSubdomain = resolveAdminSubdomain();

  return async (req, res, next) => {
    try {
      const hostname = extractHostname(req);
      const querySlug =
        typeof req.query.__companySlug === "string" ? req.query.__companySlug : null;
      const devSlugOverride =
        process.env.NODE_ENV === "production"
          ? null
          : readDevCompanySlugOverride(req.headers, querySlug);

      const resolution = classifyTenantHost({
        hostname,
        rootDomain,
        adminSubdomain,
        devSlugOverride,
      });

      if (!resolution.hostTenancyEnabled) {
        req.tenant = emptyTenant(resolution);
        next();
        return;
      }

      if (resolution.kind === "unknown") {
        sendCompanyNotFound(req, res);
        return;
      }

      if (resolution.kind === "apex" || resolution.kind === "admin") {
        req.tenant = emptyTenant(resolution);
        // Apex invite links from emails that still use the root origin:
        // `/invite/{token}` → company host `/invite/{token}`.
        if (
          resolution.kind === "apex"
          && req.method === "GET"
          && resolution.rootDomain
        ) {
          const match = req.path.match(/^\/invite\/([^/]+)\/?$/);
          if (match?.[1]) {
            const token = match[1];
            const tokenHash = createHash("sha256").update(token).digest("hex");
            const invite = await db
              .select({
                companyId: invites.companyId,
              })
              .from(invites)
              .where(
                and(
                  eq(invites.tokenHash, tokenHash),
                  isNull(invites.revokedAt),
                  isNull(invites.acceptedAt),
                ),
              )
              .then((rows) => rows[0] ?? null);
            if (invite?.companyId) {
              const company = await db
                .select({ slug: companies.slug })
                .from(companies)
                .where(eq(companies.id, invite.companyId))
                .then((rows) => rows[0] ?? null);
              if (company?.slug) {
                const proto =
                  req.header("x-forwarded-proto")?.split(",")[0]?.trim()
                  || (req.protocol === "https" ? "https" : "http");
                const origin = companyOriginForSlug(
                  company.slug,
                  resolution.rootDomain,
                  proto,
                );
                res.redirect(302, `${origin}/invite/${encodeURIComponent(token)}`);
                return;
              }
            }
          }
        }
        next();
        return;
      }

      if (resolution.kind === "company" && resolution.slug) {
        const row = await db
          .select({
            id: companies.id,
            name: companies.name,
            slug: companies.slug,
            issuePrefix: companies.issuePrefix,
            status: companies.status,
          })
          .from(companies)
          .where(eq(companies.slug, resolution.slug))
          .then((rows) => rows[0] ?? null);

        if (!row || row.status === "archived") {
          sendCompanyNotFound(req, res);
          return;
        }

        req.tenant = {
          ...resolution,
          companyId: row.id,
          companyName: row.name,
          companySlug: row.slug,
          issuePrefix: row.issuePrefix,
        };
        next();
        return;
      }

      req.tenant = emptyTenant(resolution);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function assertHostCompanyAccess(req: Request, companyId: string): boolean {
  const tenant = req.tenant;
  if (!tenant?.hostTenancyEnabled) return true;
  if (tenant.kind === "admin" && req.actor?.isInstanceAdmin) return true;
  if (tenant.kind === "company" && tenant.companyId === companyId) return true;
  return false;
}

export function tenantKind(req: Request): TenantKind {
  return req.tenant?.kind ?? "legacy";
}
