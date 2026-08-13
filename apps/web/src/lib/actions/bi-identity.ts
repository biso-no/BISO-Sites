"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import { parseBiStudentEmail } from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import { revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { buildProfileRowPermissions } from "@/lib/actions/profile-permissions";

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

/**
 * True when an Appwrite SDK error's `code` indicates the row was not found.
 * Mirrors the identical helper in
 * `packages/connectors/src/24sevenoffice/membership-sync.ts`.
 */
function isRowNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 404
  );
}

export type BiIdentitySyncResult =
  | {
      campusHint: string | null;
      hasEmployeeId: boolean;
      studentId: string;
      success: true;
    }
  | {
      error:
        | "not_authenticated"
        | "no_bi_identity"
        | "invalid_bi_email"
        | "directory_unavailable";
      success: false;
    };

/**
 * Completes a BI student account link.
 *
 * Appwrite only supports identity linking client-side, so the OAuth2 session is
 * started in the browser and this runs on the return leg. It reads the OIDC
 * identity's BI address, derives the student id, and enriches the profile with
 * the Azure employee id that Finago uses as the customer number.
 *
 * Writes go through the admin client: these columns are identity assertions,
 * deliberately outside the self-service PROFILE_WRITABLE_FIELDS allow-list.
 */
export async function syncBiStudentIdentity(): Promise<BiIdentitySyncResult> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { success: false, error: "not_authenticated" };
    }

    const identities = await account.listIdentities().catch(() => null);
    const biIdentity = identities?.identities.find(
      (identity) => identity.provider.toLowerCase() === "oidc"
    );
    if (!biIdentity) {
      return { success: false, error: "no_bi_identity" };
    }

    const parsed =
      parseBiStudentEmail(biIdentity.providerEmail) ??
      parseBiStudentEmail(biIdentity.providerUid);
    if (!parsed) {
      return { success: false, error: "invalid_bi_email" };
    }

    let employeeId: string | null = null;
    let campusHint: string | null = null;
    let directoryFailed = false;

    try {
      const directoryUser = await getBiDirectoryUser(
        `${parsed.studentId}@bi.no`
      );
      employeeId = directoryUser?.employeeId ?? null;
      campusHint = directoryUser?.campusHint ?? null;
    } catch (error) {
      directoryFailed = true;
      console.error("[BI Identity] Directory lookup failed:", error);
    }

    const { db } = await createAdminClient();
    const update: Partial<BiUser> = {
      student_id: parsed.studentId,
      bi_linked_at: new Date().toISOString(),
    };
    if (employeeId) {
      update.bi_employee_id = employeeId;
    }
    if (campusHint) {
      const existing = (await db
        .getRow<BiUser>("app", "user", user.$id)
        .catch(() => null)) as BiUser | null;
      if (!existing?.bi_campus_id) {
        update.bi_campus_id = campusHint;
      }
    }

    try {
      await db.updateRow<BiUser>("app", "user", user.$id, update);
    } catch (error) {
      if (!isRowNotFoundError(error)) {
        throw error;
      }
      // The profile row is created LAZILY — only at the final onboarding
      // wizard step (see `updateProfile` in `src/lib/actions/user.ts`) —
      // while this BI-link step runs earlier, on the very first return leg.
      // A brand-new user linking during onboarding has no row yet for
      // updateRow to find, every time. Create it instead, using the same
      // shape/permissions `updateProfile` falls back to for the identical
      // gap. `PROFILE_WRITABLE_FIELDS` stays untouched — these bi_* columns
      // remain outside self-service by design; this write goes through the
      // admin client, same as the update above.
      //
      // createRow's typed signature wants the full row; we're seeding a
      // partial profile the user fills in over time (same gap `updateProfile`
      // hits). Omit the generic so the Appwrite SDK accepts the partial
      // payload.
      await db.createRow(
        "app",
        "user",
        user.$id,
        update,
        buildProfileRowPermissions(user.$id)
      );
    }

    // The live membership check is keyed by the numeric student id; drop the
    // cached "no_student_id" result so status is correct immediately. This is
    // wrapped on its own: `revalidateTag` throws unconditionally when called
    // during a Server Component render phase (verified against the pinned
    // next@16.3.0 in this repo), and `unstable_rethrow` below does not
    // recognize that error as one of its control-flow signals, so it would
    // otherwise fall through to the catch and misreport a write that just
    // succeeded as `directory_unavailable`. The write above has already
    // landed by this point regardless of what happens here.
    try {
      revalidateTag(membershipCacheTag(parsed.studentNumber), { expire: 0 });
    } catch (error) {
      unstable_rethrow(error);
      console.error("[BI Identity] Cache invalidation failed:", error);
    }

    if (directoryFailed) {
      return { success: false, error: "directory_unavailable" };
    }

    return {
      success: true,
      studentId: parsed.studentId,
      hasEmployeeId: Boolean(employeeId),
      campusHint,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[BI Identity] Sync failed:", error);
    return { success: false, error: "directory_unavailable" };
  }
}
