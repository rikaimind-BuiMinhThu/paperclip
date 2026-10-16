# Google sign-in

Paperclip signs people in with Better Auth. Google is an optional social provider on that same user, session, and company-membership path. It does not add a second user table.

Email and password stay enabled. If Google credentials are missing or only one of the pair is set, the server still starts and the login page hides **Continue with Google**.

`local_trusted` does not show this login page. `authenticated` + `private` and `authenticated` + `public` both allow Google and email/password, with the same public-exposure rules as the rest of Better Auth.

## Environment

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`PAPERCLIP_GOOGLE_CLIENT_ID` and `PAPERCLIP_GOOGLE_CLIENT_SECRET` are aliases. When both names are set, `GOOGLE_*` is used.

Never put the client secret in the frontend. `GET /api/auth/providers` returns only:

```json
{
  "emailPassword": true,
  "providers": [{ "id": "google", "name": "Google" }]
}
```

## Google Cloud Console

1. Open Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth client ID.
3. Application type: Web application.

Authorized JavaScript origins:

```text
http://localhost:3100
https://your-production-domain.com
```

Authorized redirect URI. Better Auth is mounted at `/api/auth`, so the callback is:

```text
http://localhost:3100/api/auth/callback/google
https://your-production-domain.com/api/auth/callback/google
```

Use the instance's real public origin in production (`PAPERCLIP_PUBLIC_URL` or `BETTER_AUTH_URL`). The port above is the repo default (`PORT=3100`).

Requested scopes are `openid`, `email`, and `profile`. The provider asks for online access only, so this setup does not request Gmail, Drive, Calendar, or a refresh token.

## Account linking

Google can attach to an existing email/password user only under Better Auth's verified-email rules:

- The local user must already have `emailVerified: true`.
- Google is the only trusted provider.
- A different email never links onto that user.

Paperclip does not verify email on password signup, so a later Google sign-in with the same address does not take over that unverified row. Verify the local email first, or sign in with the password.

## After sign-in

`/auth?next=/invite/ABC` returns to that path after Google or email login. Only same-origin relative paths are accepted. Absolute and protocol-relative URLs are dropped.
