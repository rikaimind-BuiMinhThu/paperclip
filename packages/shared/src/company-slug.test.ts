import { describe, expect, it } from "vitest";
import {
  companySlugForAttempt,
  deriveCompanySlugBase,
  isReservedCompanySlug,
  normalizeCompanySlugCandidate,
  preferIssuePrefixOrNameSlug,
  validateCompanySlug,
} from "./company-slug.js";

describe("company-slug", () => {
  it("normalizes names into dns labels", () => {
    expect(normalizeCompanySlugCandidate("Acme Corp!")).toBe("acme-corp");
    expect(normalizeCompanySlugCandidate("  Foo--Bar  ")).toBe("foo-bar");
  });

  it("blocks reserved slugs", () => {
    expect(isReservedCompanySlug("admin")).toBe(true);
    expect(isReservedCompanySlug("acme")).toBe(false);
    expect(validateCompanySlug("www").ok).toBe(false);
  });

  it("derives a base from a name", () => {
    expect(deriveCompanySlugBase("Acme Corp")).toBe("acme-corp");
    expect(deriveCompanySlugBase("!!!")).toBe("company");
  });

  it("prefers a valid issue prefix", () => {
    expect(preferIssuePrefixOrNameSlug({ name: "Acme Corp", issuePrefix: "ACM" })).toBe("acm");
    expect(preferIssuePrefixOrNameSlug({ name: "Acme Corp", issuePrefix: "PAP" })).toBe("pap");
  });

  it("builds collision suffixes", () => {
    expect(companySlugForAttempt("acme", 1)).toBe("acme");
    expect(companySlugForAttempt("acme", 2)).toBe("acme-2");
  });

  it("validates good slugs", () => {
    expect(validateCompanySlug("acme-ops")).toEqual({ ok: true, slug: "acme-ops" });
  });
});
