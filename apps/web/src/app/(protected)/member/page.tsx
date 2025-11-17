import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getLoggedInUser, listIdentities } from '@/lib/actions/user'
import { 
  verifyMembershipStatus, 
  getUserProfile, 
  getMemberBenefits,
  getBenefitReveals,
  getPublicProfile,
  calculateEstimatedSavings
} from '@/app/actions/memberPortal'
import {
  SignedOutState,
  NoBIEmailState,
  NotMemberState,
  MemberPortalHeader,
  TabNavigation,
  MemberPortalSkeleton
} from '@/components/member-portal'
import { MemberPortalContent } from './MemberPortalContent'

export const metadata = {
  title: 'Member Portal | BISO',
  description: 'Access your BISO membership, benefits, and profile settings'
}

export default async function MemberPortalPage() {
  // Get user data and authentication state
  const userData = await getLoggedInUser()
  
  if (!userData) {
    return <SignedOutState />
  }

  // Check if user has BI identity linked
  const identitiesResp = await listIdentities()
  const identities = identitiesResp?.identities || []
  const hasBIIdentity = identities.some((i: any) => 
    String(i?.provider || '').toLowerCase() === 'oidc'
  )

  // Verify membership status (only if BI identity linked)
  let membershipStatus: any = { active: false, membership: null, studentId: null }
  if (hasBIIdentity) {
    membershipStatus = await verifyMembershipStatus()
  }

  // Always show portal when signed in, but pass membership status
  return (
    <Suspense fallback={<MemberPortalSkeleton />}>
      <MemberPortalContent 
        user={userData}
        membership={membershipStatus}
        hasBIIdentity={hasBIIdentity}
      />
    </Suspense>
  )
}
