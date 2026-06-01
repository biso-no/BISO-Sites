import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { syncM365Permissions } from "@/lib/m365-sync"; // Import the utility
import { isProd, sanitizeRedirectTarget } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account } = await createAdminClient();

  let session: Awaited<ReturnType<typeof account.createSession>>;
  try {
    session = await account.createSession(userId, secret);
  } catch (error) {
    // A replayed/expired/invalid OAuth secret (or Appwrite being unreachable)
    // must not surface as a raw 500 mid-login — send the user back to the
    // login screen with an error flag instead of a dead end.
    console.error("Failed to create session from OAuth token:", error);
    return redirect("/auth/login?error=session_failed");
  }

  // --- ⚡️ BLOCKING SYNC START ---
  // We await this so permissions are ready immediately upon redirect.
  // Microsoft Graph is fast (<500ms usually), so this is acceptable UX.
  // syncM365Permissions swallows its own errors, but guard here too so a
  // sync failure can never block the (already valid) session from being set.
  try {
    await syncM365Permissions(userId);
  } catch (error) {
    console.error("M365 permission sync failed during OAuth callback:", error);
  }
  // --- ⚡️ BLOCKING SYNC END ---

  const fetchedCookies = await cookies();

  fetchedCookies.set("a_session_biso_admin", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    domain: isProd ? ".biso.no" : "localhost",
  });

  return redirect(sanitizeRedirectTarget(redirectTo));
}
