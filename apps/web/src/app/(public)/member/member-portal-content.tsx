import type { Users } from "@repo/api/types/appwrite";
import { getPurchasableMembershipPlans } from "@repo/shared/utils/membership-catalog";
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
import type { MembershipStatus } from "@/lib/actions/membership";
import {
  toCurrentMembershipView,
  upgradePlans,
} from "@/lib/member-portal-membership";

interface AccountSummary {
  email: string;
  name: string;
}

interface LoggedInUser {
  profile: Users | null;
  user: { $id: string; name: string; email: string };
}

interface MemberPortalContentProps {
  hasBIIdentity: boolean;
  membership: MembershipStatus | null;
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
  const [benefits, featuredBenefits, revealedBenefits, plans] =
    await Promise.all([
      getMemberPortalBenefits(campusId),
      getFeaturedBenefits(campusId),
      user
        ? getBenefitReveals(user.user.$id)
        : Promise.resolve(new Set<string>()),
      getPurchasableMembershipPlans().catch(() => []),
    ]);

  const current = membership ? toCurrentMembershipView(membership) : null;
  const isMember = current !== null;
  const tDuration = await getTranslations("memberPass.duration");
  const membershipType = current?.duration
    ? tDuration(current.duration)
    : (current?.name ?? "");
  const expiryDate = current?.expiryDate ?? "";
  const startDate = current?.startDate ?? "";
  const daysRemaining = current?.daysRemaining ?? 0;
  const termDays = current?.termDays ?? 1;
  const offeredPlans = upgradePlans(plans, current);

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
  const studentId = profile?.student_id || user?.profile?.student_id || "";
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
          current={current}
          daysRemaining={daysRemaining}
          estimatedSavings={null}
          expiryDate={expiryDate}
          featuredBenefits={featuredBenefits}
          hasBIIdentity={hasBIIdentity}
          isGuest={!user}
          isMember={isMember}
          membershipType={membershipType}
          plans={offeredPlans}
          profile={profile || user?.profile || null}
          profileAccount={
            user?.user
              ? ({
                  name: user.user.name,
                  email: user.user.email,
                } satisfies AccountSummary)
              : null
          }
          publicProfile={publicProfile}
          revealedBenefits={revealedBenefits}
          startDate={startDate}
          termDays={termDays}
        />
      </div>
    </div>
  );
}
