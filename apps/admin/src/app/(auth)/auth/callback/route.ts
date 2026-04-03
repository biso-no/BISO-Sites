import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { syncM365Permissions } from "@/lib/m365-sync";
import { isProd } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");
  const _url = request.nextUrl.protocol + request.headers.get("host");

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  // Attempt to sync M365 teams from a cached provider token.
  // Will silently no-op if no valid Microsoft token is available.
  await syncM365Permissions(userId).catch((err) =>
    console.warn("Magic link M365 sync skipped:", err)
  );

  const fetchedCookies = await cookies();

  fetchedCookies.set("a_session_biso_admin", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    domain: isProd ? ".biso.no" : "localhost",
  });

  // Redirect to the original destination if available
  if (redirectTo) {
    return redirect(decodeURIComponent(redirectTo));
  }

  // Default redirect to homepage
  return redirect("/");
}
