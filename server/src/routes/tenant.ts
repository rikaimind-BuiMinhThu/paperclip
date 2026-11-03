import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { companies } from "@paperclipai/db";
import { validateCompanySlug } from "@paperclipai/shared";
import { companyService } from "../services/companies.js";
import {
  adminOrigin,
  apexOrigin,
  companyOriginForSlug,
  resolveAdminSubdomain,
  resolveRootDomain,
} from "../services/tenant-host.js";
import { resolveCompanyPublicOrigin } from "../services/tenant-public-url.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { validate } from "../middleware/validate.js";
import { updateCompanySlugSchema } from "@paperclipai/shared";

function requestProto(req: { header: (name: string) => string | undefined; protocol?: string }) {
  const forwarded = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return req.protocol === "https" ? "https" : "http";
}

export function tenantRoutes(db: Db) {
  const router = Router();
  const companiesSvc = companyService(db);
  const rootDomain = resolveRootDomain();
  const adminSubdomain = resolveAdminSubdomain();

  /** Bootstrap context for the current host. */
  router.get("/tenant", async (req, res) => {
    const tenant = req.tenant;
    const proto = requestProto(req);
    const hostTenancyEnabled = Boolean(rootDomain);

    if (!tenant || !tenant.hostTenancyEnabled) {
      res.json({
        hostTenancyEnabled: false,
        kind: "legacy",
        rootDomain: null,
        company: null,
        origins: {
          apex: null,
          admin: null,
        },
      });
      return;
    }

    res.json({
      hostTenancyEnabled: true,
      kind: tenant.kind,
      rootDomain: tenant.rootDomain,
      company:
        tenant.kind === "company" && tenant.companyId
          ? {
              id: tenant.companyId,
              name: tenant.companyName,
              slug: tenant.companySlug,
              issuePrefix: tenant.issuePrefix,
              origin: tenant.companySlug && tenant.rootDomain
                ? companyOriginForSlug(tenant.companySlug, tenant.rootDomain, proto)
                : null,
            }
          : null,
      origins: {
        apex: tenant.rootDomain ? apexOrigin(tenant.rootDomain, proto) : null,
        admin: tenant.rootDomain
          ? adminOrigin(tenant.rootDomain, adminSubdomain, proto)
          : null,
      },
    });
  });

  /**
   * Apex "Go to my company": resolve slug → absolute company origin.
   * Does not reveal whether a slug exists beyond redirect/404 semantics for UX:
   * unknown slugs return 404.
   */
  router.get("/tenant/resolve", async (req, res) => {
    if (!rootDomain) {
      res.status(404).json({ error: "Host tenancy is not enabled" });
      return;
    }
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const validated = validateCompanySlug(raw);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const company = await companiesSvc.getBySlug(validated.slug);
    if (!company || company.status === "archived") {
      res.status(404).json({ error: "Company not found", code: "company_not_found" });
      return;
    }

    const proto = requestProto(req);
    const origin = companyOriginForSlug(company.slug, rootDomain, proto);
    res.json({
      slug: company.slug,
      name: company.name,
      issuePrefix: company.issuePrefix,
      origin,
      authUrl: `${origin}/auth`,
      boardUrl: `${origin}/dashboard`,
    });
  });

  /** Suggest a free slug from a company name (apex create + settings). */
  router.get("/tenant/slug-availability", async (req, res) => {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const validated = validateCompanySlug(raw);
    if (!validated.ok) {
      res.json({ slug: raw, available: false, reason: validated.error });
      return;
    }
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, validated.slug))
      .then((rows) => rows[0] ?? null);
    res.json({
      slug: validated.slug,
      available: !existing,
      reason: existing ? "Company slug is already taken" : null,
    });
  });

  router.patch(
    "/companies/:companyId/slug",
    validate(updateCompanySlugSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      if (req.tenant?.hostTenancyEnabled && req.tenant.kind === "company") {
        if (req.tenant.companyId !== companyId) {
          res.status(403).json({ error: "Company mismatch for this host" });
          return;
        }
      }
      const actor = getActorInfo(req);
      const updated = await companiesSvc.updateSlug(companyId, req.body.slug, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
      });
      if (!updated) {
        res.status(404).json({ error: "Company not found" });
        return;
      }
      const origin = resolveCompanyPublicOrigin({
        slug: updated.slug,
        proto: requestProto(req),
      });
      res.json({
        ...updated,
        origin,
        warning:
          "The previous subdomain is freed immediately and will not redirect. Update bookmarks and OAuth callbacks.",
      });
    },
  );

  return router;
}
