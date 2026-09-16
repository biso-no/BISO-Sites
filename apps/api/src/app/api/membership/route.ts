import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import { getPurchasableMembershipPlans } from "@repo/shared/utils/membership-catalog";
import { resolveMembershipGate } from "@repo/shared/utils/membership-gate";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import {
  emptyMembershipStatus,
  type MembershipStatus,
} from "@repo/shared/utils/membership-status";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { getMembershipStatusForStudent } from "@/lib/membership-status-cache";

export const dynamic = "force-dynamic";

/** An invoicing department, not a campus a student joins; the web wizard hides it too. */
const NATIONAL_CAMPUS_ID = "5";

// The bi_* columns are pending an `appwrite push tables`; extend locally
// until packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
};

const NO_GATE = { currentExpiry: null, offeredPlans: [] as MembershipPlan[] };

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

function purchasableCampuses() {
  return Object.entries(CAMPUS_INVOICE_NAMES)
    .filter(([id]) => id !== NATIONAL_CAMPUS_ID)
    .map(([id, name]) => ({ id, name }));
}

function overviewBody(
  state: string,
  status: MembershipStatus,
  gate: { currentExpiry: string | null; offeredPlans: MembershipPlan[] },
  studentId: string | null,
  defaultCampusId: string | null
) {
  return {
    campuses: purchasableCampuses(),
    checkedAt: new Date(status.checkedAt).toISOString(),
    currentExpiry: gate.currentExpiry,
    defaultCampusId,
    expiredMemberships: status.expiredMemberships ?? [],
    isMember: status.isMember,
    memberships: status.memberships,
    offeredPlans: gate.offeredPlans.map((plan) => ({
      accrualMonths: plan.accrualMonths,
      duration: plan.duration,
      expiryDate: plan.expiryDate,
      id: plan.id,
      name: plan.name,
      price: plan.price,
      startDate: plan.startDate,
    })),
    reason: status.reason ?? null,
    state,
    studentId,
  };
}

/**
 * The student app's view of the caller's membership: the live 24SevenOffice
 * status (expired memberships excluded), the same purchase gate the website's
 * join page applies, and the plans on offer. Every failure to read reports
 * `membership_check_unavailable`, never "not a member".
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) => {
    const response = NextResponse.json(data, { status });
    response.headers.set("Cache-Control", "private, no-store");
    return applyCorsHeaders(response, origin);
  };

  try {
    if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ message: "Authentication required" }, 401);
    }

    let userId: string;
    try {
      const { account } = await createAuthenticatedClient(req);
      userId = (await account.get()).$id;
    } catch {
      return json({ message: "Authentication required" }, 401);
    }

    let profile: BiUser | null;
    try {
      const { db } = await createAdminClient();
      profile = await db
        .getRow<BiUser>("app", "user", userId)
        .catch((error: unknown) => {
          if (isRowNotFound(error)) {
            return null;
          }
          throw error;
        });
    } catch (error) {
      console.error("[membership] Profile read failed:", error);
      return json(
        overviewBody(
          "membership_check_unavailable",
          emptyMembershipStatus("profile_unavailable"),
          NO_GATE,
          null,
          null
        )
      );
    }

    const studentId = profile?.student_id ?? null;
    const defaultCampusId = profile?.bi_campus_id ?? null;
    const studentNumber = sanitizeStudentNumber(studentId);
    if (studentNumber === null) {
      return json(
        overviewBody(
          "needs_bi_link",
          emptyMembershipStatus(
            studentId ? "invalid_student_id" : "no_student_id"
          ),
          NO_GATE,
          studentId,
          defaultCampusId
        )
      );
    }

    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const [status, plans] = await Promise.all([
      getMembershipStatusForStudent(studentNumber, { refresh }),
      getPurchasableMembershipPlans().catch((error: unknown) => {
        console.error("[membership] Catalog read failed:", error);
        return null;
      }),
    ]);

    if (plans === null) {
      return json(
        overviewBody(
          "membership_check_unavailable",
          { ...status, reason: "catalog_unavailable" },
          NO_GATE,
          studentId,
          defaultCampusId
        )
      );
    }

    const gate = resolveMembershipGate({
      employeeId: profile?.bi_employee_id,
      isAuthenticated: true,
      plans,
      status,
      studentId,
    });

    return json(
      overviewBody(gate.state, status, gate, studentId, defaultCampusId)
    );
  } catch (error) {
    console.error("[membership] Unexpected error:", error);
    return json(
      overviewBody(
        "membership_check_unavailable",
        emptyMembershipStatus("unexpected_error"),
        NO_GATE,
        null,
        null
      )
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
