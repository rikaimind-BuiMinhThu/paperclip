import { describe, expect, it } from "vitest";
import { AuthApiError } from "@/api/auth";
import { authFormErrorKey, oauthReturnErrorKey, safeAuthErrorMessage } from "./auth-errors";

describe("auth errors", () => {
  it("maps known Better Auth codes to friendly keys", () => {
    expect(authFormErrorKey(new AuthApiError("User already exists. Use another email.", 422, null, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"))).toBe("accountExists");
    expect(authFormErrorKey(new AuthApiError("Invalid email or password", 401, null, "INVALID_EMAIL_OR_PASSWORD"))).toBe("invalidCredentials");
    expect(oauthReturnErrorKey("access_denied")).toBe("googleCancelled");
    expect(oauthReturnErrorKey("account_not_linked")).toBe("googleNotLinked");
    expect(oauthReturnErrorKey("state_mismatch")).toBe("googleFailed");
  });

  it("hides token-like messages", () => {
    expect(safeAuthErrorMessage(new Error("access token ya29.secret"))).toBeNull();
    expect(safeAuthErrorMessage(new Error("Invalid email or password"))).toBe("Invalid email or password");
  });
});
