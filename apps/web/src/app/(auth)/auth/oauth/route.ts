import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { isAccountLinkError } from "@/lib/account-link-return";
import { syncBiStudentIdentityAfterSignIn } from "@/lib/bi-identity-sync";
import {
  BI_LOGIN_FAILED_PARAM,
  BI_LOGIN_FAILED_VALUE,
  oauthReturnDestination,
} from "@/lib/bi-login";
import {
  expiredSessionCookieOptions,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from "@/lib/cookie-prefs";
import { isProd, safeRedirectPath } from "@/lib/utils";

/**
 * Whether the account already has a profile row — read BEFORE the BI sync,
 * which creates one for a student with none. A read failure counts as "has
 * one": sending an established member through onboarding because Appwrite
 * blinked is the worse mistake.
 */
async function hasProfileRow(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  userId: string
): Promise<boolean> {
  try {
    await db.getRow("app", "user", userId);
    return true;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return code !== 404;
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = safeRedirectPath(
    request.nextUrl.searchParams.get("redirectTo")
  );

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account, db } = await createAdminClient();
  let session: Models.Session;
  try {
    session = await account.createSession(userId, secret);
  } catch (error) {
    console.error("Failed to create OAuth session:", error);
    // The login page turns this marker into its generic BI failure copy; a
    // bare `error=` string matches none of its known codes and shows nothing.
    return redirect(
      `/auth/login?${BI_LOGIN_FAILED_PARAM}=${BI_LOGIN_FAILED_VALUE}`
    );
  }

  // A BI student sign-in attaches the OIDC identity to the account, so the
  // student number can be written right here, with no separate link step.
  // Any other OAuth provider reports `no_bi_identity` and nothing is written.
  // The sync must never block the sign-in: a Graph outage is reported as a
  // partial result and the membership gate offers the retry.
  const hadProfile = await hasProfileRow(db, session.userId);
  const sync = await syncBiStudentIdentityAfterSignIn(session.userId, {
    currentSessionId: session.$id,
  }).catch((error: unknown) => {
    unstable_rethrow(error);
    console.error("[BI Identity] Sign-in sync failed:", error);
    return { success: false as const, error: "sync_failed" as const };
  });
  const linkedBi = sync.success || sync.error === "directory_unavailable";
  // A refused or failed link is told, not hidden: the root layout shows a
  // toast for `link_error`, the same one the browser-side link flow uses. A
  // sign-in with no BI identity at all is simply not a BI sign-in.
  const linkError =
    !linkedBi &&
    sync.error !== "no_bi_identity" &&
    isAccountLinkError(sync.error)
      ? sync.error
      : null;

  const fetchedCookies = await cookies();
  fetchedCookies.set(SESSION_COOKIE, session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    // Safari drops Secure cookies on http://localhost. See admin oauth route.
    secure: isProd,
    ...(isProd && { domain: ".biso.no" }),
  });
  // Retire the pre-rename cookie — it collides with Appwrite's own
  // `a_session_biso` on appwrite.biso.no. See LEGACY_SESSION_COOKIE.
  fetchedCookies.set(LEGACY_SESSION_COOKIE, "", expiredSessionCookieOptions());

  const destination = oauthReturnDestination({
    hadProfile,
    linkedBi,
    redirectTo,
  });
  if (!linkError) {
    return redirect(destination);
  }
  const separator = destination.includes("?") ? "&" : "?";
  return redirect(`${destination}${separator}link_error=${linkError}`);
}
