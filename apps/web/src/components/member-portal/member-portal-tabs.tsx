"use client";

import type {
  CampusBenefits,
  PublicProfiles,
  Users,
} from "@repo/api/types/appwrite";
import type {
  CurrentMembershipView,
  PlanView,
} from "@/lib/member-portal-membership";
import { TabNavigation } from "./shared/tab-navigation";
import { BenefitsTab } from "./tabs/benefits-tab";
import { CampusTab } from "./tabs/campus-tab";
import { HomeTab } from "./tabs/home-tab";
import { MembershipTab } from "./tabs/membership-tab";
import { OpportunitiesTab } from "./tabs/opportunities-tab";
import { ProfileTab } from "./tabs/profile-tab";

interface MemberPortalTabsProps {
  bankAccount?: string;
  benefits: CampusBenefits[];
  benefitsCount: number;
  biEmail: string;
  current: CurrentMembershipView | null;
  daysRemaining: number;
  estimatedSavings: number | null;
  expiryDate: string;
  featuredBenefits?: CampusBenefits[];
  hasBIIdentity: boolean;
  isGuest: boolean;
  isMember: boolean;
  membershipType: string;
  plans: PlanView[];
  profile: Users | null;
  profileAccount: { name: string; email: string } | null;
  publicProfile: PublicProfiles | null;
  revealedBenefits: Set<string>;
  startDate: string;
  termDays: number;
}

export function MemberPortalTabs({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  featuredBenefits = [],
  revealedBenefits,
  isGuest,
  isMember,
  hasBIIdentity,
  profile,
  profileAccount,
  publicProfile,
  biEmail,
  current,
  plans,
  termDays,
  bankAccount: _bankAccount,
}: MemberPortalTabsProps) {
  const handleTabChange = (tab: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  };

  return (
    <TabNavigation
      benefitsCount={benefitsCount}
      defaultTab="home"
      hasBIIdentity={hasBIIdentity}
      isGuest={isGuest}
      isMember={isMember}
    >
      <HomeTab
        benefits={benefits}
        benefitsCount={benefitsCount}
        daysRemaining={daysRemaining}
        estimatedSavings={estimatedSavings}
        expiryDate={expiryDate}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        membershipType={membershipType}
        onTabChange={handleTabChange}
        revealedBenefits={revealedBenefits}
        startDate={startDate}
        termDays={termDays}
      />

      <BenefitsTab
        benefits={benefits}
        featuredBenefits={featuredBenefits}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        revealedBenefits={revealedBenefits}
      />

      <CampusTab />

      <OpportunitiesTab />

      <MembershipTab
        current={current}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        plans={plans}
      />

      <ProfileTab
        accountUser={profileAccount}
        biEmail={biEmail}
        publicProfile={publicProfile}
        user={profile}
      />
    </TabNavigation>
  );
}
