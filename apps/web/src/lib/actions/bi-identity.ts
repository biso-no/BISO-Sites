"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import { parseBiStudentEmail } from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import { revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

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

    await db.updateRow<BiUser>("app", "user", user.$id, update);

    // The live membership check is keyed by the numeric student id; drop the
    // cached "no_student_id" result so status is correct immediately.
    revalidateTag(membershipCacheTag(parsed.studentNumber), { expire: 0 });

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
