import type { Users } from "@repo/api/types/appwrite";
import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import { getMembershipOfferCandidates } from "@repo/shared/utils/membership-catalog";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { cookies } from "next/headers";
import { getFormatter, getTranslations } from "next-intl/server";
import { getActiveCampus } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import {
  getFeaturedBenefits,
  getMemberPortalBenefits,
  getPublicProfile,
  getUserProfile,
} from "@/app/actions/member-portal";
import { MemberPortalTabs } from "@/components/member-portal/member-portal-tabs";
import { MemberPortalHeader } from "@/components/member-portal/shared/member-portal-header";
import type { MembershipStatus } from "@/lib/actions/membership";
import { CAMPUS_COOKIE } from "@/lib/cookie-prefs";
import { getMembershipTextItems } from "@/lib/data/membership-texts";
import {
  heldThrough,
  toCurrentMembershipView,
  upcomingMembership,
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

  // An explicit "all campuses" choice in the switcher means national only.
  // Otherwise: the switcher's campus, then the profile's, then national.
  const chosenAllCampuses =
    (await cookies()).get(CAMPUS_COOKIE)?.value === "all";
  const campusId: string = chosenAllCampuses
    ? NATIONAL_CAMPUS_ID
    : ((await getActiveCampus()) ??
      (profile?.campus_id || user?.profile?.campus_id || NATIONAL_CAMPUS_ID));

  // Benefits carry no codes; a member gets one only through revealBenefit.
  const textLocale = await getLocale();
  const [benefits, featuredBenefits, plans, planCardItems, lockedItems] =
    await Promise.all([
      getMemberPortalBenefits(campusId),
      getFeaturedBenefits(campusId),
      getMembershipOfferCandidates().catch(() => []),
      getMembershipTextItems("plan_card", textLocale),
      getMembershipTextItems("portal_locked", textLocale),
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
  const offeredPlans = upgradePlans(plans, heldThrough(membership));
  const upcoming = upcomingMembership(membership);
  const tMembership = await getTranslations("memberPortal.membership");
  const format = await getFormatter();

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
        {upcoming ? (
          <Alert className="mb-6">
            <AlertDescription>
              {tMembership("upcomingMembership", {
                start: format.dateTime(new Date(upcoming.startDate), {
                  dateStyle: "long",
                }),
              })}
            </AlertDescription>
          </Alert>
        ) : null}
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
          lockedItems={lockedItems}
          membershipType={membershipType}
          planCardItems={planCardItems}
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
          startDate={startDate}
          termDays={termDays}
        />
      </div>
    </div>
  );
}
