import type { Models } from "@repo/api";
import type { Users } from "@repo/api/types/appwrite";
import { getTranslations } from "next-intl/server";
import {
  getBenefitReveals,
  getFeaturedBenefits,
  getMemberPortalBenefits,
  getPublicProfile,
  getUserProfile,
} from "@/app/actions/member-portal";
import { MemberPortalTabs } from "@/components/member-portal/member-portal-tabs";
import { MemberPortalHeader } from "@/components/member-portal/shared/member-portal-header";

interface MembershipInfo {
  expiryDate?: string;
  name?: string;
}

interface MembershipStatus {
  active: boolean;
  categories?: number[];
  error?: string;
  membership?: MembershipInfo | null;
  studentId?: number | null;
}

interface LoggedInUser {
  profile: Users | null;
  user: Models.User<Models.Preferences>;
}

interface MemberPortalContentProps {
  hasBIIdentity: boolean;
  membership: MembershipStatus;
  user: LoggedInUser | null;
}

export async function MemberPortalContent({
  user,
  membership,
  hasBIIdentity,
}: MemberPortalContentProps) {
  const tCommon = await getTranslations("memberPortal.common");

  // Fetch profile and public profile only if user exists
  const [profile, publicProfile] = user
    ? await Promise.all([getUserProfile(), getPublicProfile(user.user.$id)])
    : [null, null];

  // Resolve the user's campus id from their profile for campus-scoped benefits
  const campusId: string | null =
    profile?.campus_id || user?.profile?.campus_id || null;

  // Fetch benefits for the member portal (all users see published benefits;
  // non-members see teasers, members see the redemption value after reveal)
  const [benefits, featuredBenefits, revealedBenefits] = await Promise.all([
    getMemberPortalBenefits(campusId),
    getFeaturedBenefits(campusId),
    user
      ? getBenefitReveals(user.user.$id)
      : Promise.resolve(new Set<string>()),
  ]);

  const isMember = membership.active;

  // Calculate membership info
  const membershipType = membership.membership?.name || "Year";
  const expiryDate =
    membership.membership?.expiryDate ||
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const startDate = new Date(
    new Date(expiryDate).getTime() - 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  const daysRemaining = Math.floor(
    (new Date(expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  // Get campus name
  const campus =
    profile?.campus?.name ||
    user?.profile?.campus?.name ||
    tCommon("allCampuses");

  // Get user name and avatar
  const userName =
    profile?.name ||
    user?.profile?.name ||
    user?.user?.name ||
    tCommon("guest");
  const userAvatar = profile?.avatar || user?.profile?.avatar || null;

  // Get student ID for BI email construction
  const studentId =
    profile?.student_id || user?.profile?.student_id || "S000000";
  const biEmail = `${studentId}@bi.no`;

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-section to-background dark:from-background dark:via-card dark:to-background">
      <MemberPortalHeader
        benefitsCount={benefits.length}
        campus={campus}
        daysRemaining={daysRemaining}
        isMember={isMember}
        membershipExpiry={expiryDate}
        userAvatar={userAvatar}
        userName={userName}
      />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <MemberPortalTabs
          bankAccount={
            profile?.bank_account ?? user?.profile?.bank_account ?? undefined
          }
          benefits={benefits}
          benefitsCount={benefits.length}
          biEmail={biEmail}
          daysRemaining={daysRemaining}
          estimatedSavings={null}
          expiryDate={expiryDate}
          featuredBenefits={featuredBenefits}
          hasBIIdentity={hasBIIdentity}
          isGuest={!user}
          isMember={isMember}
          membershipType={membershipType}
          profile={profile || user?.profile || null}
          profileAccount={user?.user ?? null}
          publicProfile={publicProfile}
          revealedBenefits={revealedBenefits}
          startDate={startDate}
          studentId={studentId}
          userName={userName}
        />
      </div>
    </div>
  );
}
