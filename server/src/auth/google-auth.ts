import type { AuthProvidersResponse } from "@paperclipai/shared";

const GOOGLE_PROVIDER = {
  id: "google",
  name: "Google",
} as const;

type Env = Record<string, string | undefined>;

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export type GoogleOAuthConfigStatus = "enabled" | "missing" | "incomplete";

function credentialPair(env: Env, idKey: string, secretKey: string): GoogleOAuthCredentials | null {
  const clientId = env[idKey]?.trim() ?? "";
  const clientSecret = env[secretKey]?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function hasAnyGoogleCredential(env: Env): boolean {
  return [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.PAPERCLIP_GOOGLE_CLIENT_ID,
    env.PAPERCLIP_GOOGLE_CLIENT_SECRET,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}

/**
 * Google is enabled only when a complete client id and secret pair exists.
 * `GOOGLE_*` wins over the `PAPERCLIP_GOOGLE_*` alias. A half-set pair does
 * not enable the provider and must not crash startup.
 */
export function resolveGoogleOAuthCredentials(env: Env = process.env): GoogleOAuthCredentials | null {
  return (
    credentialPair(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")
    ?? credentialPair(env, "PAPERCLIP_GOOGLE_CLIENT_ID", "PAPERCLIP_GOOGLE_CLIENT_SECRET")
  );
}

export function googleOAuthConfigStatus(env: Env = process.env): GoogleOAuthConfigStatus {
  if (resolveGoogleOAuthCredentials(env)) return "enabled";
  return hasAnyGoogleCredential(env) ? "incomplete" : "missing";
}

export function buildAuthProvidersResponse(env: Env = process.env): AuthProvidersResponse {
  const google = resolveGoogleOAuthCredentials(env);
  return {
    emailPassword: true,
    providers: google ? [GOOGLE_PROVIDER] : [],
  };
}

type GoogleAccountRecord = {
  providerId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
};

/**
 * Authentication only needs the Google account binding. Drop the OAuth
 * tokens before they are written so a database copy cannot replay them.
 */
export function stripGoogleOAuthTokens<T extends GoogleAccountRecord>(account: T): T {
  if (account.providerId !== "google") return account;
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
  };
}
