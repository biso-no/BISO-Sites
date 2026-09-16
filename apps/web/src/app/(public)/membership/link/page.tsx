import type { Users } from "@repo/api/types/appwrite";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopHeroShell } from "@/components/shop/shop-hero-shell";
import { getLoggedInUser } from "@/lib/actions/user";
import { resolveMembershipLinkState } from "@/lib/membership-link-state";
import { NeedsBiLinkState, SignedOutState } from "../join/gate-states";
import { RetryDirectoryState } from "../join/retry-directory-state";
import { LinkedState } from "./linked-state";

export const metadata: Metadata = {
  description:
    "Link your BI student account so the BISO app can verify your membership.",
  title: "Link your BI student account | BISO",
};

// The bi_* columns are pending an `appwrite push tables`; extend locally
// until packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & { bi_employee_id?: string | null };

interface MembershipLinkPageProps {
  searchParams: Promise<{ oidc_failed?: string }>;
}

/**
 * Where the app sends a student to link their BI account. BI's tenant is
 * reachable only through Appwrite's OIDC provider, and only a browser holding
 * the student's own BISO session can link through it, so this page reuses the
 * join page's link flow and hands the student back to the app when done.
 * A refused link (`?link_error=already_linked`) is announced by
 * `AccountLinkSessionCleanup` in the root layout.
 */
export default async function MembershipLinkPage({
  searchParams,
}: MembershipLinkPageProps) {
  const params = await searchParams;
  const [userData, t] = await Promise.all([
    getLoggedInUser(),
    getTranslations("membership.link"),
  ]);
  const profile = userData?.profile as BiUser | null | undefined;

  const state = resolveMembershipLinkState({
    employeeId: profile?.bi_employee_id,
    isAuthenticated: Boolean(userData?.user),
    studentId: profile?.student_id,
  });

  let body: React.ReactNode;
  if (state === "signed_out") {
    body = <SignedOutState redirectTo="/membership/link" />;
  } else if (state === "needs_bi_link") {
    body = (
      <NeedsBiLinkState
        linkFailed={params.oidc_failed === "1"}
        returnTo="/membership/link"
      />
    );
  } else if (state === "needs_directory_record") {
    body = <RetryDirectoryState />;
  } else {
    body = <LinkedState email={userData?.user.email ?? ""} />;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <ShopHeroShell
        heightClass="h-[32vh] min-h-[240px]"
        subtitle={t("subtitle")}
        title={t("title")}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">{body}</div>
    </div>
  );
}
