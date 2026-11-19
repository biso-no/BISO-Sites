import { createSessionClient } from "@repo/api/server";
import { setSentryUser } from "@repo/observability/user";
import type { NextRequest } from "next/server";
import { userIdFromJwt } from "./jwt-session";

/**
 * Extracts JWT from Authorization header (Bearer token)
 */
export function extractJwtFromRequest(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return;
}

/**
 * Creates an authenticated session client from request.
 * Supports both:
 * - JWT via Authorization header (for direct API calls from mobile/web clients)
 * - Session cookie (for proxied requests from Next.js web app)
 */
export function createAuthenticatedClient(req: NextRequest) {
  const jwt = extractJwtFromRequest(req);
  // Tagging only: Appwrite verifies the JWT on the first call.
  setSentryUser((jwt && userIdFromJwt(jwt)) ?? null);
  return createSessionClient(jwt);
}
