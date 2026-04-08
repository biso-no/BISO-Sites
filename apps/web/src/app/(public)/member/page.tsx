import { Suspense } from "react";
import { verifyMembershipStatus } from "@/app/actions/member-portal";
import { MemberPortalSkeleton } from "@/components/member-portal/shared/member-portal-skeleton";
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
