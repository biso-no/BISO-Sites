import { Suspense } from "react";
import { MemberPortalSkeleton } from "@/components/member-portal/shared/member-portal-skeleton";
import type { MembershipStatus } from "@/lib/actions/membership";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { MemberPortalContent } from "./member-portal-content";

export const metadata = {
  title: "Member Portal | BISO",
  description: "Access your BISO membership, benefits, and profile settings",
};

export default async function MemberPortalPage() {
  // Get user data and authentication state
  const userData = await getLoggedInUser();

  let hasBIIdentity = false;
  let membershipStatus: MembershipStatus | null = null;

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
      membershipStatus = await getMembershipStatus();
    }
  }

  // Always show portal, pass null if not signed in
  return (
    <Suspense fallback={<MemberPortalSkeleton />}>
      <MemberPortalContent
        hasBIIdentity={hasBIIdentity}
        membership={membershipStatus}
        user={userData}
      />
    </Suspense>
  );
}
