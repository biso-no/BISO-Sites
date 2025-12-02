"use server";

import { ID, type Models, OAuthProvider } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const _BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

type DashboardCard = {
  id: string;
  title: string;
  groupId: string | null;
};

type Group = {
  id: string;
  name: string;
};

type DashboardConfig = {
  layout: DashboardCard[];
  groups: Group[];
};

export async function signInWithAzure() {
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
  const { account } = await createAdminClient();
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
  const { account } = await createAdminClient();
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
  const { account } = await createAdminClient();
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

async function _createMagicLinkSession(userId: string, secret: string) {
  const { account } = await createSessionClient();

  const session = await account.updateMagicURLSession(userId, secret);

  return session;
}
type Team = Models.Team;
type Teams = Models.TeamList<Models.Preferences>;
async function _getTeams(query: string[]): Promise<Teams> {
  const { account, teams } = await createSessionClient();

  return teams.list(query);
}

async function _getTeam(teamId: string): Promise<Team> {
  const { account, teams } = await createSessionClient();

  return teams.get(teamId);
}
