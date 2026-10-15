"use server";

import { ID, type Models, OAuthProvider } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient } from "./api-client";
import { BI_LOGIN_FAILED_PARAM, BI_LOGIN_FAILED_VALUE } from "./bi-login";
import {
  expiredSessionCookieOptions,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from "./cookie-prefs";

const _BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const BI_LOGIN_SCOPES = ["openid", "email", "profile"];

/**
 * The success and failure legs every OAuth sign-in shares.
 *
 * `redirectTo` is read off the login page's own URL (the referer) so a visitor
 * bounced to `/auth/login?redirectTo=/membership/join` lands back there once
 * `/auth/oauth` has turned the token into a session.
 */
async function oauthLegs(failureQuery: string): Promise<{
  failure: string;
  success: string;
}> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const url = new URL(requestHeaders.get("referer") || `${origin}/auth/login`);
  const redirectTo = url.searchParams.get("redirectTo");
  const encoded = redirectTo ? encodeURIComponent(redirectTo) : null;
  const success = encoded
    ? `${origin}/auth/oauth?redirectTo=${encoded}`
    : `${origin}/auth/oauth`;
  const failure = encoded
    ? `${origin}/auth/login?${failureQuery}&redirectTo=${encoded}`
    : `${origin}/auth/login?${failureQuery}`;
  return { failure, success };
}

/**
 * Sign in with a BI student account, through Appwrite's OIDC provider.
 *
 * This is the student path: Appwrite attaches the BI identity to the account
 * it signs in or creates, and `/auth/oauth` writes the student number on the
 * way back, so there is no separate "link your BI account" step. The scopes
 * match the link flow in `account-link-client.ts`.
 *
 * Appwrite cannot vouch for the email a generic OIDC provider returns, so an
 * account that already carries the student's bi.no address without a BI
 * identity is refused; the failure leg carries Appwrite's error and the login
 * page explains what to do (`readBiLoginFailure`).
 */
export async function signInWithBiStudent() {
  const { account } = await createSessionClient();
  const { failure, success } = await oauthLegs(
    `${BI_LOGIN_FAILED_PARAM}=${BI_LOGIN_FAILED_VALUE}`
  );

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Oidc,
    success,
    failure,
    BI_LOGIN_SCOPES
  );

  return redirect(redirectUrl);
}

/**
 * Staff addresses must never go through the magic-link flow.
 *
 * `account.createMagicURLToken` CREATES an Appwrite account when the email is
 * unknown, and that account has no OAuth identity. Appwrite's OAuth callback
 * resolves an existing identity by `providerUid` first; with none, it falls
 * through to matching on email, and that branch hard-fails with a 400 unless
 * the provider reports the address as verified. Appwrite's Microsoft provider
 * returns `false` unconditionally ("Microsoft explicitly does not verify
 * emails in Graph /me"), so one magic-link request against an @biso.no address
 * permanently locks that person out of the admin app. Staff sign in with
 * Microsoft on both apps instead.
 */
const STAFF_EMAIL_DOMAIN = "@biso.no";

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; reason: "staff_domain" };

export async function signInWithMagicLink(
  email: string
): Promise<MagicLinkResult> {
  if (email.trim().toLowerCase().endsWith(STAFF_EMAIL_DOMAIN)) {
    return { ok: false, reason: "staff_domain" };
  }

  const { account } = await createSessionClient();

  const origin = (await headers()).get("origin");

  await account.createMagicURLToken(
    ID.unique(),
    email,
    `${origin}/auth/callback`
  );

  return { ok: true };
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
