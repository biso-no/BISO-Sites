"use server";

import { ID, type Models, OAuthProvider } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeRedirectTarget } from "./utils";

const TRAILING_SLASH_REGEX = /\/+$/;

/**
 * Authoritative origin for OAuth/magic-link success/failure URLs. Read from
 * NEXT_PUBLIC_BASE_URL only — the Origin and Referer request headers are
 * attacker-controllable and would otherwise let a hostile referer steer the
 * Appwrite OAuth callback to a third-party domain (still gated by Appwrite's
 * platform allow-list, but defense in depth).
 */
async function getCanonicalOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(TRAILING_SLASH_REGEX, "");
  }
  const headerOrigin = (await headers()).get("origin");
  if (headerOrigin) {
    return headerOrigin.replace(TRAILING_SLASH_REGEX, "");
  }
  throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
}

export async function signInWithAzure(redirectToParam?: string) {
  const { account } = await createAdminClient();

  const origin = await getCanonicalOrigin();

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

export async function signInWithMagicLink(email: string): Promise<boolean> {
  const { account } = await createSessionClient();

  const origin = await getCanonicalOrigin();

  try {
    await account.createMagicURLToken(
      ID.unique(),
      email,
      `${origin}/auth/callback`
    );
    return true;
  } catch (error) {
    console.error("Failed to send magic link:", error);
    return false;
  }
}

async function _createMagicLinkSession(userId: string, secret: string) {
  const { account } = await createSessionClient();

  const session = await account.updateMagicURLSession(userId, secret);

  return session;
}
type Team = Models.Team;
type Teams = Models.TeamList<Models.Preferences>;
async function _getTeams(query: string[]): Promise<Teams> {
  const { teams } = await createSessionClient();

  return teams.list(query);
}

async function _getTeam(teamId: string): Promise<Team> {
  const { teams } = await createSessionClient();

  return teams.get(teamId);
}
