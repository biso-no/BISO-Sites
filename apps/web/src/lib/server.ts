"use server";

import { createAdminClient, createSessionClient } from "./appwrite";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ID, OAuthProvider, Query } from "@repo/api/server";

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
    const { account } = await createAdminClient();

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
    const { account } = await createAdminClient();

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

export async function createMagicLinkSession(userId: string, secret: string) {
    const { account } = await createSessionClient();

    const session = await account.updateMagicURLSession(userId, secret);

    return session;
}

  export async function getTeams(query: string[]) {
    const { account, teams } = await createSessionClient();
  
    return teams.list(query);
  }
  
  export async function getTeam(teamId: string) {
    const { account, teams } = await createSessionClient();
  
    return teams.get(teamId);
  }
