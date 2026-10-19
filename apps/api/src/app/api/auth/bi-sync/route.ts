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
  // only used when the claim names the same user the account lookup returned.
  const sessionId =
    userIdFromJwt(jwt) === userId ? sessionIdFromJwt(jwt) : null;

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
