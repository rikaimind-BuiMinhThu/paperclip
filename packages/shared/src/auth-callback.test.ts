import { describe, expect, it } from "vitest";
import { resolveAuthCallbackUrl } from "./auth-callback.js";

describe("resolveAuthCallbackUrl", () => {
  it("keeps same-origin invite, onboarding, and CLI paths", () => {
    expect(resolveAuthCallbackUrl("/invite/ABC")).toBe("/invite/ABC");
    expect(resolveAuthCallbackUrl("/cli-auth/challenge?token=abc")).toBe("/cli-auth/challenge?token=abc");
    expect(resolveAuthCallbackUrl("/board-claim?token=one#step")).toBe("/board-claim?token=one#step");
    expect(resolveAuthCallbackUrl("/TEST/issues/TEST-1?tab=activity#comment")).toBe(
      "/TEST/issues/TEST-1?tab=activity#comment",
    );
  });

  it("rejects open redirects and login loops", () => {
    expect(resolveAuthCallbackUrl("https://evil.test/phish")).toBe("/");
    expect(resolveAuthCallbackUrl("//evil.test")).toBe("/");
    expect(resolveAuthCallbackUrl("/\\evil.test")).toBe("/");
    expect(resolveAuthCallbackUrl("/\n/evil.test")).toBe("/");
    expect(resolveAuthCallbackUrl("/auth?next=/invite/ABC")).toBe("/");
    expect(resolveAuthCallbackUrl("/auth/")).toBe("/");
    expect(resolveAuthCallbackUrl(null)).toBe("/");
    expect(resolveAuthCallbackUrl("")).toBe("/");
  });
});
