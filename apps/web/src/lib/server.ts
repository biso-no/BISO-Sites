"use server";

import { createSessionClient } from "@repo/api/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ID, OAuthProvider, Query, Models } from "@repo/api";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

interface DashboardCard {
    id: string;
    title: string;
    groupId: string | null;
  }
  
  interface Group {
    id: string;
    name: string;
  }
  
  interface DashboardConfig {
    layout: DashboardCard[];
    groups: Group[];
  }

export async function signInWithAzure() {
    const { account } = await createSessionClient();

    const origin = (await headers()).get("origin");
    
    // Get the redirectTo parameter from the URL if it exists
    const url = new URL((await headers()).get("referer") || `${origin}/auth/login`);
    const redirectTo = url.searchParams.get("redirectTo");
    
    // Include the redirectTo parameter in the success URL
    const successUrl = redirectTo ? 
        `${origin}/auth/oauth?redirectTo=${redirectTo}` : 
        `${origin}/auth/oauth`;

    const redirectUrl = await account.createOAuth2Token(
        OAuthProvider.Microsoft,
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

    return redirectUrl ? true : false;
}

async function createMagicLinkSession(userId: string, secret: string) {
    const { account } = await createSessionClient();

    const session = await account.updateMagicURLSession(userId, secret);

    return session;
}
type Team = Models.Team
type Teams = Models.TeamList<Models.Preferences>
  async function getTeams(query: string[]): Promise<Teams> {
    const { account, teams } = await createSessionClient();
  
    return teams.list(query);
  }
  
  async function getTeam(teamId: string): Promise<Team> {
    const { account, teams } = await createSessionClient();
  
    return teams.get(teamId);
  }
