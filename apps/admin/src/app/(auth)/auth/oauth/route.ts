// app/auth/callback/route.ts (or wherever your file is)
import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { syncM365Permissions } from "@/lib/m365-sync"; // Import the utility
import { isProd } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  // --- ⚡️ BLOCKING SYNC START ---
  // We await this so permissions are ready immediately upon redirect.
  // Microsoft Graph is fast (<500ms usually), so this is acceptable UX.
  await syncM365Permissions(userId);
  // --- ⚡️ BLOCKING SYNC END ---

  const fetchedCookies = await cookies();

  fetchedCookies.set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    domain: isProd ? ".biso.no" : "localhost",
  });

  if (redirectTo) {
    return redirect(decodeURIComponent(redirectTo));
  }

  return redirect("/");
}
