import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments, Users } from "@repo/api/types/appwrite";

/**
 * Validates the campus/department a submitter claims on a reimbursement.
 *
 * Why this exists: the expense payload carries `campus` and `department` as
 * free strings validated only by `z.string().min(1)`, and
 * `createApprovalChain` resolves the approvers to notify from exactly those
 * values. Without a check, any signed-in user can drop a reimbursement into any
 * department's queue, addressed to that department's real approvers — a request
 * arriving through the normal channel, which is what approvers are conditioned
 * to trust.
 *
 * Why it is graduated rather than a hard membership check: `department_ids` is
 * provisioned by IT (`it-users.ts`, the admin users routes) and `m365-sync`
 * writes `?? []`, so a real volunteer can legitimately have an empty list.
 * Hard-gating on it would break reimbursements at launch for those users.
 *
 * So:
 *  - the department must exist and must sit on the claimed campus — always,
 *    for everyone. This alone kills cross-campus and garbage submissions.
 *  - when the profile *does* carry departments, membership is enforced.
 *  - when it does not, the submission proceeds and is logged, so the gap is
 *    visible rather than silent.
 *
 * Backfill `department_ids` for every active user and this becomes a strict
 * check with no code change: drop the `knownDepartments.length === 0` branch.
 */

export type ExpenseOwnershipCheck =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function assertExpenseScope(params: {
  profile: Pick<Users, "$id" | "department_ids" | "campus_id">;
  campusId: string;
  departmentId: string;
}): Promise<ExpenseOwnershipCheck> {
  const { profile, campusId, departmentId } = params;
  const { db } = await createAdminClient();

  let department: Departments;
  try {
    department = await db.getRow<Departments>(
      "app",
      "departments",
      departmentId,
      [Query.select(["$id", "campus_id", "active"])]
    );
  } catch {
    return {
      ok: false,
      error: "Unknown department.",
      status: 400,
    };
  }

  if (department.campus_id !== campusId) {
    return {
      ok: false,
      error: "That department does not belong to the selected campus.",
      status: 400,
    };
  }

  const knownDepartments = profile.department_ids ?? [];

  if (knownDepartments.length === 0) {
    console.warn(
      `[expense-scope] user ${profile.$id} submitted for department ${departmentId} with no department_ids on their profile — allowed, but unverifiable. Backfill department_ids to close this.`
    );
    return { ok: true };
  }

  if (!knownDepartments.includes(departmentId)) {
    return {
      ok: false,
      error:
        "You can only submit reimbursements for a department you belong to.",
      status: 403,
    };
  }

  return { ok: true };
}
