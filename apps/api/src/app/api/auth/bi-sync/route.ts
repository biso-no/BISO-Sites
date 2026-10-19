import { createAdminClient } from "@repo/api/server";
import {
  type BiIdentitySyncResult,
  syncBiStudentIdentityAfterSignIn,
} from "@repo/shared/utils/bi-identity-sync";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, extractJwtFromRequest } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { sessionIdFromJwt, userIdFromJwt } from "@/lib/jwt-session";

export const runtime = "nodejs";

/**
 * Session providers a BI sign-in leaves behind: `oauth2` for a session the app
 * made with `createSession(userId, secret)` from the OAuth2 token, `oidc` for
 * one Appwrite created straight from the OIDC provider.
 */
const BI_SIGN_IN_SESSION_PROVIDERS: ReadonlySet<string> = new Set([
  "oauth2",
  "oidc",
]);

/**
 * The JWT's session, when it may be the one kept by the sync's lockout.
 *
 * The lockout (`lockOutPriorHolders`) ends every OTHER session and rotates the
 * password of an account a BI sign-in has just merged into. Email/password
 * sign-up is open, so whoever pre-registered a student's bi.no address can
 * hold a password session on that same account and call this route too. This
 * provider check is what stops that password session (or a login-link one)
 * from claiming the lockout and ending the student's session instead of its
 * own: only a session the BI sign-in itself produced is kept. Anything else,
 * including a lookup failure, skips the lockout rather than guess.
 */
async function biSignInSessionId(
  userId: string,
  sessionId: string
): Promise<string | null> {
  let provider: string | null = null;
  try {
    const { users } = await createAdminClient();
    const { sessions } = await users.listSessions({ userId });
    provider =
      sessions.find((session) => session.$id === sessionId)?.provider ?? null;
  } catch (error) {
    console.warn(
      `[bi-sync] Could not look up session ${sessionId} of ${userId}; lockout skipped:`,
      error
    );
    return null;
  }
  if (provider && BI_SIGN_IN_SESSION_PROVIDERS.has(provider.toLowerCase())) {
    return sessionId;
  }
  console.warn(
    `[bi-sync] Session ${sessionId} of ${userId} is not a BI sign-in (provider: ${provider ?? "not found"}); lockout skipped`
  );
  return null;
}

/**
 * Writes the BI student number onto the caller's profile after the app signed
 * in with the BI account (Appwrite's OIDC provider). The web does the same on
 * its OAuth return route; both share `syncBiStudentIdentityAfterSignIn`.
 *
 * Domain outcomes (no BI identity, already linked, ...) are 200 responses so
 * the app reads one shape; only a missing or rejected JWT is a 401.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const jwt = extractJwtFromRequest(req);
  if (!jwt) {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  let userId: string;
  try {
    const { account } = await createAuthenticatedClient(req);
    userId = (await account.get()).$id;
  } catch {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  // Appwrite has accepted the JWT, so its claims are genuine. The session is
  // only used when the claim names the same user the account lookup returned,
  // and only kept by the lockout when it is a BI sign-in (see above).
  const claimedSessionId =
    userIdFromJwt(jwt) === userId ? sessionIdFromJwt(jwt) : null;
  const sessionId = claimedSessionId
    ? await biSignInSessionId(userId, claimedSessionId)
    : null;

  try {
    const result: BiIdentitySyncResult = await syncBiStudentIdentityAfterSignIn(
      userId,
      sessionId ? { currentSessionId: sessionId } : {}
    );
    return json(result);
  } catch (error) {
    console.error("[bi-sync] Sync threw:", error);
    return json({ success: false, error: "sync_failed" });
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
