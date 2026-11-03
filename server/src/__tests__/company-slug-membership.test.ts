import { describe, expect, it } from "vitest";
import {
  companySlugForAttempt,
  deriveCompanySlugBase,
  preferIssuePrefixOrNameSlug,
  validateCompanySlug,
} from "@paperclipai/shared";
import { isCompanySlugConflict } from "../services/company-slug.js";
import {
  canUserJoinCompany,
} from "../services/company-membership-collapse.js";
import { classifyTenantHost } from "../services/tenant-host.js";
import { stripCompanyPrefixFromPath } from "../services/tenant-public-url.js";

describe("company slug helpers", () => {
  it("derives and validates slugs", () => {
    expect(deriveCompanySlugBase("Acme Corp")).toBe("acme-corp");
    expect(preferIssuePrefixOrNameSlug({ name: "Acme", issuePrefix: "ACM" })).toBe("acm");
    expect(companySlugForAttempt("acme", 2)).toBe("acme-2");
    expect(validateCompanySlug("admin").ok).toBe(false);
    expect(validateCompanySlug("acme-ops")).toEqual({ ok: true, slug: "acme-ops" });
  });

  it("detects slug unique violations", () => {
    expect(
      isCompanySlugConflict({ code: "23505", constraint: "companies_slug_idx" }),
    ).toBe(true);
    expect(isCompanySlugConflict({ code: "23505", constraint: "other" })).toBe(false);
  });

  it("strips legacy issue-prefix paths", () => {
    expect(stripCompanyPrefixFromPath("/PAP/dashboard", "PAP")).toBe("/dashboard");
    expect(stripCompanyPrefixFromPath("/issues/1", "PAP")).toBe("/issues/1");
  });
});

describe("tenant host classification", () => {
  const root = "kujira-ai-workforce.com";

  it("maps apex, admin, company, and unknown", () => {
    expect(classifyTenantHost({ hostname: root, rootDomain: root }).kind).toBe("apex");
    expect(classifyTenantHost({ hostname: `admin.${root}`, rootDomain: root }).kind).toBe("admin");
    expect(classifyTenantHost({ hostname: `acme.${root}`, rootDomain: root })).toMatchObject({
      kind: "company",
      slug: "acme",
    });
    expect(classifyTenantHost({ hostname: "evil.example", rootDomain: root }).kind).toBe("unknown");
  });
});

describe("canUserJoinCompany", () => {
  it("allows instance admins without querying memberships deeply when flagged", async () => {
    const gate = await canUserJoinCompany(
      {
        select: () => ({
          from: () => ({
            where: async () => [{ userId: "admin" }],
          }),
        }),
      } as never,
      "admin",
      null,
      { isInstanceAdmin: true },
    );
    expect(gate).toEqual({ ok: true });
  });
});
