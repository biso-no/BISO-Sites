import "server-only";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import {
  buildHolder,
  memberPassStateFor,
} from "@repo/shared/member-pass/state";
import type {
  MemberPassHolder,
  MemberPassState,
} from "@repo/shared/member-pass/types";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import type { NextRequest } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { getMembershipStatusForStudent } from "@/lib/membership-status-cache";

export type ResolvedMemberPass =
  | { state: "unauthenticated" }
  | { state: Exclude<MemberPassState, "active"> }
  | { holder: MemberPassHolder; state: "active"; userId: string };

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

/**
 * The app caller's pass, gated on a live membership check. Mirrors the
 * website's `resolveMemberPass`, but authenticates the caller from the
 * request's `Authorization: Bearer <JWT>` header instead of a session cookie,
 * and reads the profile's `student_id` through the admin client rather than
 * through a cached server action.
 */
export async function resolveMemberPassForRequest(
  req: NextRequest
): Promise<ResolvedMemberPass> {
  let userId: string;
  let accountName = "";
  try {
    const { account } = await createAuthenticatedClient(req);
    const user = await account.get();
    userId = user.$id;
    accountName = user.name?.trim() ?? "";
  } catch {
    return { state: "unauthenticated" };
  }

  let profile: Users | null;
  try {
    const { db } = await createAdminClient();
    profile = await db
      .getRow<Users>("app", "user", userId)
      .catch((error: unknown) => {
        if (isRowNotFound(error)) {
          return null;
        }
        throw error;
      });
  } catch (error) {
    console.error("[Member Pass] Profile read failed:", error);
    return { state: "unavailable" };
  }

  const studentNumber = sanitizeStudentNumber(profile?.student_id ?? null);
  if (studentNumber === null) {
    return { state: "no_bi_identity" };
  }

  const status = await getMembershipStatusForStudent(studentNumber);
  const state = memberPassStateFor(status);
  if (state !== "active") {
    return { state };
  }

  const name = profile?.name?.trim() || accountName;
  const holder = buildHolder(name, status);
  if (!holder) {
    return { state: "unavailable" };
  }
  return { holder, state: "active", userId };
}
