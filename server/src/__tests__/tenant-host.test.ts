import { describe, expect, it } from "vitest";
import { classifyTenantHost } from "../services/tenant-host.js";

describe("classifyTenantHost", () => {
  const rootDomain = "kujira-ai-workforce.com";

  it("marks legacy when root domain unset", () => {
    expect(classifyTenantHost({ hostname: "anything.example", rootDomain: null }).kind).toBe(
      "legacy",
    );
  });

  it("classifies apex and www", () => {
    expect(classifyTenantHost({ hostname: rootDomain, rootDomain }).kind).toBe("apex");
    expect(classifyTenantHost({ hostname: `www.${rootDomain}`, rootDomain }).kind).toBe("apex");
  });

  it("classifies admin host", () => {
    expect(
      classifyTenantHost({ hostname: `admin.${rootDomain}`, rootDomain }).kind,
    ).toBe("admin");
  });

  it("classifies company slug", () => {
    const result = classifyTenantHost({ hostname: `acme.${rootDomain}`, rootDomain });
    expect(result.kind).toBe("company");
    expect(result.slug).toBe("acme");
  });

  it("returns unknown for unregistered hosts", () => {
    expect(classifyTenantHost({ hostname: "evil.example.com", rootDomain }).kind).toBe(
      "unknown",
    );
  });

  it("supports *.localhost in development", () => {
    const result = classifyTenantHost({
      hostname: "acme.localhost",
      rootDomain,
    });
    expect(result.kind).toBe("company");
    expect(result.slug).toBe("acme");
  });
});
