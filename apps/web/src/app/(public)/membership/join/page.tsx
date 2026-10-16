import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { getMembershipOfferCandidates } from "@repo/shared/utils/membership-catalog";
import { resolveMembershipGate } from "@repo/shared/utils/membership-gate";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { upcomingMembership } from "@/lib/member-portal-membership";
import {
  AlreadyMemberState,
  MembershipCheckUnavailableState,
  NeedsBiSignInState,
  NoPlansAvailableState,
  SignedOutState,
} from "./gate-states";
import { JoinWizard } from "./join-wizard";
import { RetryDirectoryState } from "./retry-directory-state";
import { RetryStudentSyncState } from "./retry-student-sync-state";

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

interface MembershipJoinPageProps {
  searchParams: Promise<{
    cancelled?: string;
    error?: string;
    linked?: string;
  }>;
}

/**
 * A BI sign-in completes at /auth/oauth, which writes the student number
 * itself and only then redirects here. This page never runs that sync (a
 * refresh of this URL is inert), and never reads a request-memoized value
 * that could predate the write: the redirect always starts a fresh request,
 * so `getLoggedInUser()`/`getMembershipStatus()` below see it.
 */
export default async function MembershipJoinPage({
  searchParams,
}: MembershipJoinPageProps) {
  const params = await searchParams;
  // apps/api's /api/payment/return sends a membership buyer back here on a
  // cancelled or failed payment (see redirectForStatus there) instead of the
  // shop cart, since a membership order never touched the cart — the web
  // /api/checkout/return only forwards there. Neither param changes
  // which gate state renders — payment outcome is orthogonal to purchase
  // eligibility — they only add an acknowledgement banner above it.
  const cancelled = params.cancelled === "true";
  const paymentFailed = params.error === "payment_failed";

  const [userData, status, plans, flags, t] = await Promise.all([
    getLoggedInUser(),
    getMembershipStatus(),
    getMembershipOfferCandidates(),
    getFeatureFlagStates(),
    getTranslations("membership.join"),
  ]);

  const [tCommon, tNav] = await Promise.all([
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const profile = userData?.profile as BiUser | null | undefined;

  const gate = resolveMembershipGate({
    employeeId: profile?.bi_employee_id,
    isAuthenticated: Boolean(userData?.user),
    plans,
    status,
    studentId: userData?.profile?.student_id,
  });

  const notice = paymentFailed ? (
    <p
      className="type-body-sm mb-8 rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
      role="alert"
    >
      {t("paymentFailed.body")}
    </p>
  ) : (
    cancelled && (
      <p
        className="type-body-sm mb-8 rounded-biso-md border border-edge bg-surface-sunken p-4 text-ink"
        role="status"
      >
        {t("cancelled.body")}
      </p>
    )
  );

  let body: React.ReactNode;
  if (gate.state === "signed_out") {
    body = <SignedOutState />;
  } else if (gate.state === "needs_bi_link") {
    // Signed in with BI already, yet no student number: offering another BI
    // sign-in would loop. Retry the sync instead.
    const identities = (await listIdentities())?.identities ?? [];
    const hasBiIdentity = identities.some(
      (identity) => identity.provider.toLowerCase() === "oidc"
    );
    body = hasBiIdentity ? <RetryStudentSyncState /> : <NeedsBiSignInState />;
  } else if (gate.state === "needs_directory_record") {
    body = <RetryDirectoryState />;
  } else if (gate.state === "membership_check_unavailable") {
    body = <MembershipCheckUnavailableState />;
  } else if (gate.state === "already_member") {
    body = (
      <AlreadyMemberState
        expiry={gate.currentExpiry}
        startsOn={upcomingMembership(status)?.startDate ?? null}
      />
    );
  } else if (gate.state === "no_plans_available") {
    body = <NoPlansAvailableState />;
  } else {
    body = (
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

  // Chrome only. `resolveMembershipGate`, the gate states and the wizard are
  // the purchase flow; the merge restyled their surfaces, not their logic.
  return (
    <ShopPageShell
      breadcrumbs={[
        { label: tCommon("breadcrumbs.home"), href: "/" },
        { label: tNav("becomeMember"), href: "/membership" },
        { label: t("title") },
      ]}
      lede={t("subtitle")}
      title={t("title")}
      width="prose"
    >
      {notice}
      {body}
    </ShopPageShell>
  );
}
