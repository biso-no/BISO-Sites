"use server";

import { ID, type Models, OAuthProvider } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient } from "./api-client";
import {
  expiredSessionCookieOptions,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from "./cookie-prefs";

const _BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

async function _signInWithAzure() {
  const { account } = await createSessionClient();

  const origin = (await headers()).get("origin");

  // Get the redirectTo parameter from the URL if it exists
  const url = new URL(
    (await headers()).get("referer") || `${origin}/auth/login`
  );
  const redirectTo = url.searchParams.get("redirectTo");

  // Include the redirectTo parameter in the success URL
  const successUrl = redirectTo
    ? `${origin}/auth/oauth?redirectTo=${redirectTo}`
    : `${origin}/auth/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Microsoft,
    successUrl,
    `${origin}/auth/login`
  );

  return redirect(redirectUrl);
}

export async function signInWithGoogle() {
  const { account } = await createSessionClient();
  const origin = (await headers()).get("origin");

  const url = new URL(
    (await headers()).get("referer") || `${origin}/auth/login`
  );
  const redirectTo = url.searchParams.get("redirectTo");

  const successUrl = redirectTo
    ? `${origin}/auth/oauth?redirectTo=${redirectTo}`
    : `${origin}/auth/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Google,
    successUrl,
    `${origin}/auth/login`
  );

  return redirect(redirectUrl);
}

export async function signInWithFacebook() {
  const { account } = await createSessionClient();
  const origin = (await headers()).get("origin");

  const url = new URL(
    (await headers()).get("referer") || `${origin}/auth/login`
  );
  const redirectTo = url.searchParams.get("redirectTo");

  const successUrl = redirectTo
    ? `${origin}/auth/oauth?redirectTo=${redirectTo}`
    : `${origin}/auth/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Facebook,
    successUrl,
    `${origin}/auth/login`
  );

  return redirect(redirectUrl);
}

export async function signInWithApple() {
  const { account } = await createSessionClient();
  const origin = (await headers()).get("origin");

  const url = new URL(
    (await headers()).get("referer") || `${origin}/auth/login`
  );
  const redirectTo = url.searchParams.get("redirectTo");

  const successUrl = redirectTo
    ? `${origin}/auth/oauth?redirectTo=${redirectTo}`
    : `${origin}/auth/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Apple,
    successUrl,
    `${origin}/auth/login`
  );

  return redirect(redirectUrl);
}

export async function signInWithMagicLink(email: string) {
  const { account } = await createSessionClient();

  const origin = (await headers()).get("origin");

  /*
    if (email.includes("@biso.no")) {
        return redirect(`${origin}/auth/login?restrictedDomain=true`);
    }
    */

  const redirectUrl = await account.createMagicURLToken(
    ID.unique(),
    email,
    `${origin}/auth/callback`
  );

  return !!redirectUrl;
}

export async function signOut() {
  // Best-effort revocation: an already-expired or server-side-deleted session
  // makes this 401. That must not stop us from clearing the cookies, or the
  // browser keeps replaying a dead session and the user can never sign out.
  try {
    const { account } = await createSessionClient();
    await account.deleteSession("current");
  } catch (error) {
    console.error("[signOut] session revocation failed:", error);
  }

  // Expire with the original name/domain/path — a bare `cookies().delete()`
  // omits the `Domain` attribute and silently no-ops against the `.biso.no`
  // cookie in production. The legacy name is cleared too; sessions issued
  // before the 2026-08-13 rename are still read via the fallback.
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", expiredSessionCookieOptions());
  cookieStore.set(LEGACY_SESSION_COOKIE, "", expiredSessionCookieOptions());

  apiClient.clearCache();

  return redirect("/");
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
