"use server";

import { OAuthProvider } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { redirect } from "next/navigation";
import { sanitizeRedirectTarget } from "./utils";

const TRAILING_SLASH_REGEX = /\/+$/;

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

  return redirect(redirectUrl);
}
