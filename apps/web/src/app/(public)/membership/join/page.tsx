import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import type { Metadata } from "next";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { getPurchasableMembershipPlans } from "@/lib/membership-catalog";
import { resolveMembershipGate } from "@/lib/membership-gate";
import {
  AlreadyMemberState,
  NeedsBiLinkState,
  NoPlansAvailableState,
  SignedOutState,
} from "./gate-states";
import { JoinWizard } from "./join-wizard";
import { RetryDirectoryState } from "./retry-directory-state";

export const metadata: Metadata = {
  title: "Join BISO | BISO",
  description: "Buy your BISO membership.",
};

// The bi_* columns are pending an `appwrite push tables`; extend locally
// until packages/api/types/appwrite.ts is regenerated. Mirrors the pattern
// in src/lib/actions/bi-identity.ts and src/app/actions/membership-purchase.ts.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
};

export default async function MembershipJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>;
}) {
  const params = await searchParams;
  if (params.linked === "1") {
    // Completes the BI account link started by NeedsBiLinkState's OIDC
    // redirect: writes student_id + bi_employee_id before the gate below
    // re-evaluates, so the very next render can move past `needs_bi_link`.
    await syncBiStudentIdentity();
  }

  const [userData, status, plans, flags] = await Promise.all([
    getLoggedInUser(),
    getMembershipStatus(),
    getPurchasableMembershipPlans(),
    getFeatureFlagStates(),
  ]);

  const profile = userData?.profile as BiUser | null | undefined;

  const gate = resolveMembershipGate({
    employeeId: profile?.bi_employee_id,
    isAuthenticated: Boolean(userData?.user),
    plans,
    status,
    studentId: userData?.profile?.student_id,
  });

  if (gate.state === "signed_out") {
    return <SignedOutState />;
  }
  if (gate.state === "needs_bi_link") {
    return <NeedsBiLinkState />;
  }
  if (gate.state === "needs_directory_record") {
    return <RetryDirectoryState />;
  }
  if (gate.state === "already_member") {
    return <AlreadyMemberState expiry={gate.currentExpiry} />;
  }
  if (gate.state === "no_plans_available") {
    return <NoPlansAvailableState />;
  }

  return (
    <JoinWizard
      currentExpiry={gate.currentExpiry}
      defaultCampusId={profile?.bi_campus_id ?? null}
      plans={gate.offeredPlans}
      providers={{
        stripe: flags.payments_stripe,
        vipps: flags.payments_vipps,
      }}
    />
  );
}
