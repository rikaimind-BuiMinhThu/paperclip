const CONTROL_CHARS = /[\\\u0000-\u0020]/;

/**
 * Post-login destination for Better Auth `callbackURL`.
 * Only same-origin relative paths are allowed. Protocol-relative URLs,
 * absolute URLs, and paths that bounce back to the login form are rejected.
 */
export function resolveAuthCallbackUrl(next?: string | null): string {
  const value = typeof next === "string" ? next.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//") || CONTROL_CHARS.test(value)) return "/";
  try {
    const url = new URL(value, "https://tenant.invalid");
    if (url.origin !== "https://tenant.invalid") return "/";
    if (url.pathname.replace(/\/+$/, "") === "/auth") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
