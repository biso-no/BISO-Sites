import "server-only";
import { createAdminClient } from "@repo/api/server";
import {
  findActiveGrantForUser,
  type ScannerGrantRow,
} from "@repo/shared/member-pass/scanner-grants";
import type { NextRequest } from "next/server";
import { createAuthenticatedClient, extractJwtFromRequest } from "@/lib/auth";

export type ScannerAuthResult =
  | { grant: ScannerGrantRow; ok: true; userId: string }
  | {
      error: "not_authenticated" | "not_scanner";
      ok: false;
      status: 401 | 403;
    };

/**
 * Authenticates an app caller and checks they currently hold an active
 * scanner grant. Re-checked on every call (never cached) so a revoked grant
 * stops scanning on the next request.
 *
 * Requires the `Authorization: Bearer <JWT>` header explicitly — a bare
 * `createAuthenticatedClient(req)` call falls back to a session cookie when
 * no JWT is present, which would let a credentialed browser request through
 * without a JWT. Mirrors `resolveMemberPassForRequest`'s auth pattern.
 */
export async function requireScanner(
  req: NextRequest,
  now: Date
): Promise<ScannerAuthResult> {
  if (!extractJwtFromRequest(req)) {
    return { error: "not_authenticated", ok: false, status: 401 };
  }

  let userId: string;
  try {
    const { account } = await createAuthenticatedClient(req);
    const user = await account.get();
    userId = user.$id;
  } catch {
    return { error: "not_authenticated", ok: false, status: 401 };
  }

  const { db } = await createAdminClient();
  const grant = await findActiveGrantForUser(db, userId, now);
  if (!grant) {
    return { error: "not_scanner", ok: false, status: 403 };
  }

  return { grant, ok: true, userId };
}
