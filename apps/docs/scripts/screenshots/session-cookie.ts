/**
 * The admin reads its session from this cookie. The admin defines the name
 * once, in `apps/admin/src/lib/session-cookie.ts`; a test keeps this copy in
 * step.
 */
export const ADMIN_SESSION_COOKIE = "biso_session_admin";

/** A cookie in the shape Playwright's `context.addCookies()` takes. */
export interface AdminSessionCookie {
  httpOnly: boolean;
  name: string;
  sameSite: "Lax";
  secure: boolean;
  url: string;
  value: string;
}

/**
 * The admin's session cookie for a locally running admin. It is set by URL,
 * so the browser scopes it to that host only. There is deliberately no
 * `domain`: the production `.biso.no` domain must never be used here.
 */
export function adminSessionCookie(
  adminUrl: string,
  secret: string
): AdminSessionCookie {
  const url = new URL(adminUrl);
  return {
    httpOnly: true,
    name: ADMIN_SESSION_COOKIE,
    sameSite: "Lax",
    secure: url.protocol === "https:",
    url: url.origin,
    value: secret,
  };
}
