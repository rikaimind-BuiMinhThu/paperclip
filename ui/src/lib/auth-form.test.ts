import { describe, expect, it } from "vitest";
import { validateEmailAuthForm } from "./auth-form";

describe("validateEmailAuthForm", () => {
  it("accepts a sign-in with email and password", () => {
    expect(validateEmailAuthForm({
      mode: "sign_in",
      name: "",
      email: "jane@example.com",
      password: "secret",
      confirmPassword: "",
    })).toBeNull();
  });

  it("requires a name, a real email, eight characters, and a matching confirmation", () => {
    const base = {
      mode: "sign_up" as const,
      name: "Jane",
      email: "jane@example.com",
      password: "correct-horse",
      confirmPassword: "correct-horse",
    };
    expect(validateEmailAuthForm({ ...base, name: "  " })).toBe("name");
    expect(validateEmailAuthForm({ ...base, email: "not-an-email" })).toBe("email");
    expect(validateEmailAuthForm({ ...base, password: "short", confirmPassword: "short" })).toBe("password");
    expect(validateEmailAuthForm({ ...base, confirmPassword: "other-password" })).toBe("confirm");
    expect(validateEmailAuthForm(base)).toBeNull();
  });
});
