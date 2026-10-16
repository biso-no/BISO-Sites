"use server";

import { createSessionClient } from "@repo/api/server";
import { unstable_rethrow } from "next/navigation";
import {
  type BiIdentitySyncResult,
  syncBiStudentIdentityFor,
} from "@/lib/bi-identity-sync";

export type { BiIdentitySyncResult } from "@/lib/bi-identity-sync";

/**
 * Completes a BI student account link for the current session.
 *
 * Appwrite only supports identity linking client-side, so the OAuth2 session is
 * started in the browser and this runs on the return leg. It reads the OIDC
 * identity's BI address, derives the student id, and enriches the profile with
 * the Azure employee id that Finago stores as the customer's ExternalId.
 *
 * Writes go through the admin client: these columns are identity assertions,
 * deliberately outside the self-service SELF_SERVICE_PROFILE_FIELDS allow-list.
 */
export async function syncBiStudentIdentity(): Promise<BiIdentitySyncResult> {
  let account: Awaited<ReturnType<typeof createSessionClient>>["account"];
  try {
    ({ account } = await createSessionClient());
  } catch (error) {
    unstable_rethrow(error);
    console.error("[BI Identity] Sync failed:", error);
    return { success: false, error: "sync_failed" };
  }
  const user = await account.get().catch(() => null);
  if (!user?.$id) {
    return { success: false, error: "not_authenticated" };
  }

  const identities = await account.listIdentities().catch(() => null);
  return await syncBiStudentIdentityFor({
    email: user.email,
    identities: identities?.identities ?? [],
    userId: user.$id,
  });
}
