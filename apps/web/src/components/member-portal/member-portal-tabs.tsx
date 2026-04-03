"use client";

import type {
  CampusBenefit,
  PublicProfiles,
  Users,
} from "@repo/api/types/appwrite";
import { TabNavigation } from "./shared/tab-navigation";
import { BenefitsTab } from "./tabs/benefits-tab";
import { HomeTab } from "./tabs/home-tab";
import { MembershipTab } from "./tabs/membership-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { CampusTab } from "./tabs/campus-tab";
import { OpportunitiesTab } from "./tabs/opportunities-tab";

interface MemberPortalTabsProps {
  membershipType: string;
  benefitsCount: number;
  daysRemaining: number;
  estimatedSavings: number;
  startDate: string;
  expiryDate: string;
  benefits: CampusBenefit[];
  featuredBenefits?: CampusBenefit[];
  revealedBenefits: Set<string>;
  isMember: boolean;
  hasBIIdentity: boolean;
  profile: Users | null;
  publicProfile: PublicProfiles | null;
  biEmail: string;
  userName: string;
  studentId: string;
  bankAccount?: string;
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
  isMember,
  hasBIIdentity,
  profile,
  publicProfile,
  biEmail,
  userName,
  studentId,
  bankAccount,
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
      isGuest={!profile}
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
        autoRenew={false}
        currentPlan="year"
        daysRemaining={daysRemaining}
        expiryDate={expiryDate}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        studentId={studentId}
        userName={userName}
      />

      <ProfileTab
        biEmail={biEmail}
        publicProfile={publicProfile}
        user={profile}
      />
    </TabNavigation>
  );
}
