import { createSessionClient } from "@repo/api/server";
import type { NextRequest } from "next/server";

/**
 * Extracts JWT from Authorization header (Bearer token)
 */
export function extractJwtFromRequest(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

/**
 * Creates an authenticated session client from request.
 * Supports both:
 * - JWT via Authorization header (for direct API calls from mobile/web clients)
 * - Session cookie (for proxied requests from Next.js web app)
 */
export async function createAuthenticatedClient(req: NextRequest) {
  const jwt = extractJwtFromRequest(req);
  return createSessionClient(jwt);
}
