import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { getMembershipStatusForStudent } from "@/lib/membership-status-cache";

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 404;
}

/**
 * Live membership from the profile's BI student number, refreshed as the
 * membership route's `?refresh=1` is: a student who bought a membership a
 * moment ago must be able to apply at once. No student number, no member.
 */
export async function isMemberByProfile(userId: string): Promise<boolean> {
  const { db } = await createAdminClient();
  const profile = await db
    .getRow<Users>("app", "user", userId)
    .catch((error: unknown) => {
      if (isRowNotFound(error)) {
        return null;
      }
      throw error;
    });
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  if (studentNumber === null) {
    return false;
  }
  const status = await getMembershipStatusForStudent(studentNumber, {
    refresh: true,
  });
  return status.isMember;
}
