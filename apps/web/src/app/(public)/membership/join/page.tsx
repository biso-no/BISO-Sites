import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { getPurchasableMembershipPlans } from "@/lib/membership-catalog";
import { resolveMembershipGate } from "@/lib/membership-gate";
import {
  AlreadyMemberState,
  MembershipCheckUnavailableState,
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

interface MembershipJoinPageProps {
  searchParams: Promise<{
    cancelled?: string;
    error?: string;
    linked?: string;
    oidc_failed?: string;
  }>;
}

/**
 * A BI OIDC link completes at /api/auth/bi-link, which runs the sync + cache
 * invalidation itself and only then redirects here with `?linked=1` — see
 * that route's doc comment. This page never re-runs the sync (a refresh of
 * this URL is inert), and never reads a request-memoized value that could
 * predate the write: the redirect from that route always starts a fresh
 * request, so `getLoggedInUser()`/`getMembershipStatus()` below see it.
 */
export default async function MembershipJoinPage({
  searchParams,
}: MembershipJoinPageProps) {
  const params = await searchParams;
  const linkFailed = params.oidc_failed === "1";
  // /api/checkout/return sends a membership buyer back here on a cancelled or
  // failed payment (see redirectForStatus there) instead of the shop cart,
  // since a membership order never touched the cart. Neither param changes
  // which gate state renders — payment outcome is orthogonal to purchase
  // eligibility — they only add an acknowledgement banner above it.
  const cancelled = params.cancelled === "true";
  const paymentFailed = params.error === "payment_failed";

  const [userData, status, plans, flags, t] = await Promise.all([
    getLoggedInUser(),
    getMembershipStatus(),
    getPurchasableMembershipPlans(),
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
    <Alert className="mb-8 rounded-2xl" variant="destructive">
      <AlertDescription>{t("paymentFailed.body")}</AlertDescription>
    </Alert>
  ) : (
    cancelled && (
      <Alert className="mb-8 rounded-2xl">
        <AlertDescription>{t("cancelled.body")}</AlertDescription>
      </Alert>
    )
  );

  let body: React.ReactNode;
  if (gate.state === "signed_out") {
    body = <SignedOutState />;
  } else if (gate.state === "needs_bi_link") {
    body = <NeedsBiLinkState linkFailed={linkFailed} />;
  } else if (gate.state === "needs_directory_record") {
    body = <RetryDirectoryState />;
  } else if (gate.state === "membership_check_unavailable") {
    body = <MembershipCheckUnavailableState />;
  } else if (gate.state === "already_member") {
    body = <AlreadyMemberState expiry={gate.currentExpiry} />;
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

  // Chrome only. `resolveMembershipGate`, the six gate states and the wizard
  // are the purchase flow — this package does not touch them.
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
