"use client";

import type { MemberBenefit, PublicProfiles, Users } from "@repo/api/types/appwrite";
import {
  BenefitsTab,
  MembershipTab,
  OverviewTab,
  ProfileTab,
  SettingsTab,
  TabNavigation,
} from "@/components/member-portal";

interface MemberPortalTabsProps {
  membershipType: string;
  benefitsCount: number;
  daysRemaining: number;
  estimatedSavings: number;
  startDate: string;
  expiryDate: string;
  benefits: MemberBenefit[];
  revealedBenefits: Set<string>;
  isMember: boolean;
  hasBIIdentity: boolean;
  profile: Users;
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
      defaultTab="overview"
      benefitsCount={benefitsCount}
      isMember={isMember}
      hasBIIdentity={hasBIIdentity}
    >
      <OverviewTab
        membershipType={membershipType}
        benefitsCount={benefitsCount}
        daysRemaining={daysRemaining}
        estimatedSavings={estimatedSavings}
        startDate={startDate}
        expiryDate={expiryDate}
        benefits={benefits}
        revealedBenefits={revealedBenefits}
        isMember={isMember}
        hasBIIdentity={hasBIIdentity}
        onTabChange={handleTabChange}
      />

      <ProfileTab user={profile} publicProfile={publicProfile} biEmail={biEmail} />

      <MembershipTab
        userName={userName}
        studentId={studentId}
        currentPlan="year"
        expiryDate={expiryDate}
        daysRemaining={daysRemaining}
        autoRenew={false}
        isMember={isMember}
        hasBIIdentity={hasBIIdentity}
      />

      <BenefitsTab
        benefits={benefits}
        revealedBenefits={revealedBenefits}
        isMember={isMember}
        hasBIIdentity={hasBIIdentity}
      />

      <SettingsTab bankAccount={bankAccount} />
    </TabNavigation>
  );
}
