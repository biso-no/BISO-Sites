import { Suspense } from "react";
import { verifyMembershipStatus } from "@/app/actions/member-portal";
import { MemberPortalSkeleton } from "@/components/member-portal/shared/member-portal-skeleton";
import { Section } from "@/components/ui/section";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { MemberPortalContent } from "./member-portal-content";

interface MembershipStatus {
  active: boolean;
  categories?: number[];
  error?: string;
  membership?: {
    expiryDate?: string;
    name?: string;
  } | null;
  studentId?: number;
}

export const metadata = {
  title: "Member Portal | BISO",
  description: "Access your BISO membership, benefits, and profile settings",
};

export default async function MemberPortalPage() {
  // Get user data and authentication state
  const userData = await getLoggedInUser();

  let hasBIIdentity = false;
  let membershipStatus: MembershipStatus = {
    active: false,
    categories: undefined,
    membership: null,
    studentId: undefined,
  };

  if (userData) {
    // Check if user has BI identity linked
    const identitiesResp = await listIdentities();
    const identities = identitiesResp?.identities || [];
    hasBIIdentity = identities.some(
      (i: { provider?: string }) =>
        String(i?.provider || "").toLowerCase() === "oidc"
    );

    // Verify membership status (only if BI identity linked)
    if (hasBIIdentity) {
      membershipStatus = await verifyMembershipStatus();
    }
  }

  const portal = (
    <MemberPortalContent
      hasBIIdentity={hasBIIdentity}
      membership={membershipStatus}
      user={userData}
    />
  );

  // Chrome only, and deliberately **without** a `PageHeader`: the portal
  // renders its own `<h1>` ("Welcome back, …") in `member-portal-header`,
  // so adding the standard band gave the page two of them. It gets the v2
  // container and rhythm and keeps its own heading.
  return (
    <Suspense fallback={<MemberPortalSkeleton />}>
      <Section clearNav tone="paper">
        {portal}
      </Section>
    </Suspense>
  );
}
