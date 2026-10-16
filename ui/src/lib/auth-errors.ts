import { AuthApiError } from "@/api/auth";

const ACCOUNT_EXISTS_CODES = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

const INVALID_CREDENTIAL_CODES = new Set([
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "INVALID_PASSWORD",
]);

export type AuthFormErrorKey =
  | "accountExists"
  | "invalidCredentials"
  | "googleCancelled"
  | "googleFailed"
  | "googleNotLinked"
  | "failed";

export function authFormErrorKey(error: unknown): AuthFormErrorKey | null {
  const code = error instanceof AuthApiError ? error.code : null;
  if (code && ACCOUNT_EXISTS_CODES.has(code)) return "accountExists";
  if (code && INVALID_CREDENTIAL_CODES.has(code)) return "invalidCredentials";
  if (code === "google_start_failed") return "googleFailed";
  return null;
}

export function oauthReturnErrorKey(code: string | null): AuthFormErrorKey | null {
  if (!code) return null;
  if (code === "access_denied") return "googleCancelled";
  if (
    code === "unable_to_link_account"
    || code === "account_not_linked"
    || code === "account_already_linked_to_different_user"
    || code === "email_does_not_match"
  ) {
    return "googleNotLinked";
  }
  return "googleFailed";
}

export function safeAuthErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.trim();
  if (!message || message.length > 180) return null;
  if (/token|secret|stack|at\s+\//i.test(message)) return null;
  return message;
}
