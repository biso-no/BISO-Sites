import type { Users } from "@repo/api/types/appwrite";
import { getMembershipOfferCandidates } from "@repo/shared/utils/membership-catalog";
import { isTransientMembershipReason } from "@repo/shared/utils/membership-gate";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  getBenefitReveals,
  getFeaturedBenefits,
  getMemberPortalBenefits,
  getPublicProfile,
  getUserProfile,
} from "@/app/actions/member-portal";
import { MemberPortalTabs } from "@/components/member-portal/member-portal-tabs";
import { MemberPortalHeader } from "@/components/member-portal/shared/member-portal-header";
import { Section } from "@/components/ui/section";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import type { MembershipStatus } from "@/lib/actions/membership";
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

/**
 * "We couldn't check" — never "you're not a member". The status comes live
 * from apps/api, and an outage there must not tell a paying member to buy a
 * membership, so the portal stops at this notice until the check answers.
 */
async function MembershipCheckUnavailable() {
  const t = await getTranslations("memberPortal.unavailable");
  return (
    <div
      className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-8"
      role="status"
    >
      <h2 className="type-heading-card text-ink">{t("title")}</h2>
      <p className="type-body max-w-(--measure) text-ink-muted">{t("body")}</p>
      <Link className={statusPanelPrimaryAction} href="/member">
        {t("retry")}
      </Link>
    </div>
  );
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
      getMembershipOfferCandidates().catch(() => []),
    ]);

  const checkFailed = isTransientMembershipReason(membership?.reason);
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

  // Get user name
  const userName =
    profile?.name ||
    user?.profile?.name ||
    user?.user?.name ||
    tCommon("guest");

  // Get student ID for BI email construction
  const studentId = profile?.student_id || user?.profile?.student_id || "";
  const biEmail = `${studentId}@bi.no`;

  return (
    <>
      <MemberPortalHeader
        campus={campus}
        checkFailed={checkFailed}
        isMember={isMember}
        membershipExpiry={expiryDate}
        userName={userName}
      />

      <Section tone="paper">
        {upcoming ? (
          <p
            className="type-body-sm mb-8 rounded-biso-md border border-edge bg-surface-sunken p-4 text-ink"
            role="status"
          >
            {tMembership("upcomingMembership", {
              start: format.dateTime(new Date(upcoming.startDate), {
                dateStyle: "long",
              }),
            })}
          </p>
        ) : null}

        {checkFailed ? (
          <MembershipCheckUnavailable />
        ) : (
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
        )}
      </Section>
    </>
  );
}
