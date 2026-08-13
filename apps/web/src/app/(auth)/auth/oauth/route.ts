import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  expiredSessionCookieOptions,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from "@/lib/cookie-prefs";
import { isProd, safeRedirectPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = safeRedirectPath(
    request.nextUrl.searchParams.get("redirectTo")
  );

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account } = await createAdminClient();
  let session: Models.Session;
  try {
    session = await account.createSession(userId, secret);
  } catch (error) {
    console.error("Failed to create OAuth session:", error);
    return redirect("/auth/login?error=Login+failed");
  }

  const fetchedCookies = await cookies();
  fetchedCookies.set(SESSION_COOKIE, session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    ...(isProd && { domain: ".biso.no" }),
  });
  // Retire the pre-rename cookie — it collides with Appwrite's own
  // `a_session_biso` on appwrite.biso.no. See LEGACY_SESSION_COOKIE.
  fetchedCookies.set(LEGACY_SESSION_COOKIE, "", expiredSessionCookieOptions());

  return redirect(redirectTo);
}
