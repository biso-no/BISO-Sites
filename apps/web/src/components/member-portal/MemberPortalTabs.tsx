"use client";

import type {
  MemberBenefit,
  PublicProfiles,
  Users,
} from "@repo/api/types/appwrite";
import { BenefitsTab } from "./tabs/BenefitsTab";
import { MembershipTab } from "./tabs/MembershipTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { TabNavigation } from "./shared/TabNavigation";

type MemberPortalTabsProps = {
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
};

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
      benefitsCount={benefitsCount}
      defaultTab="overview"
      hasBIIdentity={hasBIIdentity}
      isMember={isMember}
    >
      <OverviewTab
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

      <ProfileTab
        biEmail={biEmail}
        publicProfile={publicProfile}
        user={profile}
      />

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

      <BenefitsTab
        benefits={benefits}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        revealedBenefits={revealedBenefits}
      />

      <SettingsTab bankAccount={bankAccount} />
    </TabNavigation>
  );
}
