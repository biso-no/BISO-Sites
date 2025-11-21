import { Suspense } from "react";
import { verifyMembershipStatus } from "@/app/actions/memberPortal";
import { MemberPortalSkeleton } from "@/components/member-portal/shared/MemberPortalSkeleton";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { MemberPortalContent } from "./MemberPortalContent";

export const metadata = {
  title: "Member Portal | BISO",
  description: "Access your BISO membership, benefits, and profile settings",
};

export default async function MemberPortalPage() {
  // Get user data and authentication state
  const userData = await getLoggedInUser();

  // Check if user has BI identity linked
  const identitiesResp = await listIdentities();
  const identities = identitiesResp?.identities || [];
  const hasBIIdentity = identities.some(
    (i: any) => String(i?.provider || "").toLowerCase() === "oidc"
  );

  // Verify membership status (only if BI identity linked)
  let membershipStatus: any = {
    active: false,
    membership: null,
    studentId: null,
  };
  if (hasBIIdentity) {
    membershipStatus = await verifyMembershipStatus();
  }

  // Always show portal when signed in, but pass membership status
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
