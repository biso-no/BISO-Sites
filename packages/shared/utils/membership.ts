import { createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "./bi-student";
import { computeMembershipStatus } from "./membership-status";

type MembershipData = Record<string, unknown>;

export type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: MembershipData;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

/**
 * Verify the current user's BISO membership by reading Finago live.
 *
 * Finago is the sole source of truth: a member added by hand there is a member
 * here. Requires `user.student_id`, which is populated when the BI student
 * account is linked.
 */
export async function checkMembership(): Promise<MembershipCheckResult> {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { ok: true, active: false };
    }

    const profile = await db
      .getRow<Users>("app", "user", user.$id)
      .catch(() => null);
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return { ok: true, active: false };
    }

    const status = await computeMembershipStatus(studentNumber);

    return {
      ok: true,
      active: status.isMember,
      membership: status.memberships[0] as unknown as
        | MembershipData
        | undefined,
      studentId: studentNumber,
      categories: status.finagoCategoryIds,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
