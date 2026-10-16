import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { resolveAuthCallbackUrl } from "@paperclipai/shared";
import {
  buildAuthProvidersResponse,
  googleOAuthConfigStatus,
  resolveGoogleOAuthCredentials,
  stripGoogleOAuthTokens,
} from "../auth/google-auth.js";
import { buildGoogleAuthOptions, createBetterAuthHandler } from "../auth/better-auth.js";

const ORIGIN = "http://127.0.0.1:3100";
const EMAIL = "john@example.com";
const PASSWORD = "correct-horse";

describe("Google auth configuration", () => {
  it("keeps Google disabled unless both credentials are present", () => {
    expect(resolveGoogleOAuthCredentials({})).toBeNull();
    expect(googleOAuthConfigStatus({})).toBe("missing");
    expect(resolveGoogleOAuthCredentials({ GOOGLE_CLIENT_ID: "id-only" })).toBeNull();
    expect(googleOAuthConfigStatus({ GOOGLE_CLIENT_SECRET: "secret-only" })).toBe("incomplete");
    expect(buildAuthProvidersResponse({})).toEqual({
      emailPassword: true,
      providers: [],
    });
  });

  it("enables Google from either env name without putting secrets in the capability payload", () => {
    const fromGoogle = resolveGoogleOAuthCredentials({
      GOOGLE_CLIENT_ID: " google-id ",
      GOOGLE_CLIENT_SECRET: " google-secret ",
      PAPERCLIP_GOOGLE_CLIENT_ID: "alias-id",
      PAPERCLIP_GOOGLE_CLIENT_SECRET: "alias-secret",
    });
    expect(fromGoogle).toEqual({ clientId: "google-id", clientSecret: "google-secret" });

    const fromAlias = resolveGoogleOAuthCredentials({
      PAPERCLIP_GOOGLE_CLIENT_ID: "alias-id",
      PAPERCLIP_GOOGLE_CLIENT_SECRET: "alias-secret",
    });
    expect(fromAlias).toEqual({ clientId: "alias-id", clientSecret: "alias-secret" });

    const capability = buildAuthProvidersResponse({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    expect(capability).toEqual({
      emailPassword: true,
      providers: [{ id: "google", name: "Google" }],
    });
    expect(JSON.stringify(capability)).not.toContain("google-id");
    expect(JSON.stringify(capability)).not.toContain("google-secret");
  });

  it("keeps email and password enabled and does not disable local email verification", () => {
    const options = buildGoogleAuthOptions({
      clientId: "google-id",
      clientSecret: "google-secret",
      disableSignUp: false,
    });
    expect(options.socialProviders.google.clientId).toBe("google-id");
    expect(options.socialProviders.google.includeGrantedScopes).toBe(false);
    expect(options.socialProviders.google.accessType).toBe("online");
    expect(options.account.accountLinking).toMatchObject({
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
    });
    expect(options.account.accountLinking).not.toHaveProperty("requireLocalEmailVerified", false);
    expect(resolveAuthCallbackUrl("https://evil.test")).toBe("/");
  });

  it("strips Google tokens and leaves credential passwords alone", () => {
    expect(stripGoogleOAuthTokens({
      providerId: "google",
      accessToken: "access",
      refreshToken: "refresh",
      idToken: "id",
    })).toEqual({
      providerId: "google",
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    expect(stripGoogleOAuthTokens({
      providerId: "credential",
      password: "hashed",
    })).toEqual({
      providerId: "credential",
      password: "hashed",
    });
  });
});

describe("Google account linking", () => {
  const memory: Record<string, Array<Record<string, unknown>>> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  let auth: ReturnType<typeof betterAuth>;
  let app: express.Express;

  beforeEach(() => {
    memory.user = [];
    memory.session = [];
    memory.account = [];
    memory.verification = [];
    auth = betterAuth({
      baseURL: ORIGIN,
      secret: "google-auth-test-secret-google-auth-test-secret",
      trustedOrigins: [ORIGIN],
      database: memoryAdapter(memory),
      emailAndPassword: { enabled: true, disableSignUp: false },
      rateLimit: { enabled: false },
      // Vitest sets NODE_ENV=test, and Better Auth skips origin checks in
      // that environment unless this is explicit. Production leaves the check on.
      advanced: { disableOriginCheck: false },
      ...buildGoogleAuthOptions({
        clientId: "google-id",
        clientSecret: "google-secret",
        disableSignUp: false,
      }),
    });
    app = express();
    app.all("/api/auth/{*authPath}", createBetterAuthHandler(auth));
  });

  async function signUp(email = EMAIL) {
    const response = await request(app)
      .post("/api/auth/sign-up/email")
      .set("origin", ORIGIN)
      .send({ email, password: PASSWORD, name: "John" });
    expect(response.status).toBe(200);
    return response.body.user as { id: string; email: string; emailVerified: boolean };
  }

  async function linkGoogle(email: string, emailVerified = true) {
    const context = await auth.$context;
    return handleOAuthUserInfo({
      context: {
        ...context,
        trustedProviders: ["google"],
      },
    } as never, {
      userInfo: {
        id: `google-${email}`,
        email,
        name: "John Google",
        emailVerified,
      },
      account: {
        providerId: "google",
        issuer: "https://accounts.google.com",
        accountId: `google-${email}`,
        accessToken: "access-token-should-not-persist",
        refreshToken: "refresh-token-should-not-persist",
        idToken: "id-token-should-not-persist",
      },
      callbackURL: "/invite/ABC",
    });
  }

  it("rejects an absolute callback URL and accepts an invite path", async () => {
    const rejected = await request(app)
      .post("/api/auth/sign-in/social")
      .set("origin", ORIGIN)
      .send({
        provider: "google",
        callbackURL: "https://evil.test/phish",
        disableRedirect: true,
      });
    expect(rejected.status).toBe(403);

    const accepted = await request(app)
      .post("/api/auth/sign-in/social")
      .set("origin", ORIGIN)
      .send({
        provider: "google",
        callbackURL: "/invite/ABC",
        disableRedirect: true,
      });
    expect(accepted.status).toBe(200);
    expect(accepted.body.url).toContain("https://accounts.google.com/");
    expect(accepted.body.url).toContain(encodeURIComponent(`${ORIGIN}/api/auth/callback/google`));
    expect(accepted.body.url).not.toContain("access_type=offline");
  });

  it("does not link Google onto an unverified email/password user", async () => {
    const user = await signUp();
    expect(user.emailVerified).toBe(false);

    const linked = await linkGoogle(EMAIL, true);
    expect(linked.error).toBe("account not linked");
    expect(memory.user).toHaveLength(1);
    expect(memory.account.map((account) => account.providerId)).toEqual(["credential"]);
  });

  it("links Google onto the same user when the local email is already verified", async () => {
    const user = await signUp();
    const context = await auth.$context;
    await context.internalAdapter.updateUser(user.id, { emailVerified: true });

    const linked = await linkGoogle(EMAIL, true);
    expect(linked.error).toBeNull();
    expect(linked.data?.user.id).toBe(user.id);
    expect(memory.user).toHaveLength(1);
    const providers = memory.account.map((account) => account.providerId).sort();
    expect(providers).toEqual(["credential", "google"]);
    const google = memory.account.find((account) => account.providerId === "google");
    expect(google).toMatchObject({
      userId: user.id,
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    expect(JSON.stringify(memory)).not.toContain("access-token-should-not-persist");
    expect(JSON.stringify(memory)).not.toContain("refresh-token-should-not-persist");
  });

  it("creates one user for a new verified Google account", async () => {
    const linked = await linkGoogle("new@example.com", true);
    expect(linked.error).toBeNull();
    expect(linked.isRegister).toBe(true);
    expect(memory.user).toHaveLength(1);
    expect(memory.user[0]).toMatchObject({
      email: "new@example.com",
      emailVerified: true,
    });
    expect(memory.account).toHaveLength(1);
    expect(memory.account[0]?.providerId).toBe("google");
    expect(memory.account[0]?.accessToken).toBeNull();
  });
});
