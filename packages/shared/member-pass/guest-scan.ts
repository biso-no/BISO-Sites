import { createAdminClient } from "@repo/api/server";
import { hashGuestToken, isLinkUsable } from "./guest-links";
import { findLinkByTokenHash } from "./scan-store";
import type { ScannerLinkRow } from "./scan-types";

const MAX_TOKEN_LENGTH = 128;

/**
 * Looks up a usable (unrevoked, unexpired) guest scanner link by its raw
 * token. Kept out of `(scan)/scan/actions.ts` — a `"use server"` file — so it
 * is not itself callable as a public server action: it returns the whole
 * `ScannerLinkRow` (created_by, campus_id, token_hash, $createdAt), which
 * must never be exposed to anyone holding only the token.
 */
export async function resolveGuestLink(
  token: string
): Promise<ScannerLinkRow | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  const { db } = await createAdminClient();
  const link = await findLinkByTokenHash(db, hashGuestToken(token));
  return isLinkUsable(link, new Date()) ? link : null;
}
