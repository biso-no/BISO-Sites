"use server";

import { OAuthProvider } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isProd, sanitizeRedirectTarget } from "./utils";

const TRAILING_SLASH_REGEX = /\/+$/;

/**
 * The cookie name Appwrite itself issues for project `biso`
 * (`a_session_<projectId>`). Never ours — admin's session lives in
 * `a_session_biso_admin`.
 */
const APPWRITE_OWN_SESSION_COOKIE = "a_session_biso";

/**
 * Expire any `.biso.no`-scoped `a_session_biso` cookie before starting OAuth.
 *
 * apps/web used to store the public site's Appwrite session under that exact
 * name, scoped to `.biso.no`. Appwrite is hosted at appwrite.biso.no, so the
 * browser attached that session to the OAuth navigation and Appwrite treated
 * the *web* visitor as the account being signed in — rejecting admin sign-in
 * with `409 user_already_exists` even though the admin's Microsoft identity was
 * correctly linked. apps/web no longer writes this cookie, but 30-day cookies
 * issued before that fix are still in browsers, so clear it on the way past.
 */
async function clearCollidingAppwriteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  if (!cookieStore.get(APPWRITE_OWN_SESSION_COOKIE)) {
    return;
  }
  cookieStore.set(APPWRITE_OWN_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    ...(isProd && { domain: ".biso.no" }),
  });
}

/**
 * Authoritative origin for OAuth success/failure URLs. Read from
 * NEXT_PUBLIC_BASE_URL only — the Origin and Referer request headers are
 * attacker-controllable and would otherwise let a hostile referer steer the
 * Appwrite OAuth callback to a third-party domain (still gated by Appwrite's
 * platform allow-list, but defense in depth).
 */
function getCanonicalOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(TRAILING_SLASH_REGEX, "");
  }
  throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
}

export async function signInWithAzure(redirectToParam?: string) {
  const { account } = await createAdminClient();

  const origin = getCanonicalOrigin();

  // Sanitize the redirect target so a hostile caller cannot steer the
  // post-OAuth redirect to a third-party origin.
  const safeRedirectTo =
    redirectToParam && sanitizeRedirectTarget(redirectToParam) !== "/"
      ? sanitizeRedirectTarget(redirectToParam)
      : null;

  const successUrl = safeRedirectTo
    ? `${origin}/auth/oauth?redirectTo=${encodeURIComponent(safeRedirectTo)}`
    : `${origin}/auth/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Microsoft,
    successUrl,
    `${origin}/auth/login`
  );

  // Must happen before the redirect throws, so the Set-Cookie lands on this
  // response and the browser drops the cookie before it reaches Appwrite.
  await clearCollidingAppwriteSessionCookie();

  return redirect(redirectUrl);
}
