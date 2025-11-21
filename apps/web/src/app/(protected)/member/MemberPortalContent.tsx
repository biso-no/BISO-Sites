import {
  calculateEstimatedSavings,
  getBenefitReveals,
  getMemberBenefits,
  getPublicProfile,
  getUserProfile,
} from "@/app/actions/memberPortal";
import {
  MemberPortalHeader,
  MemberPortalTabs,
} from "@/components/member-portal";

interface MemberPortalContentProps {
  user: any;
  membership: any;
  hasBIIdentity: boolean;
}

export async function MemberPortalContent({
  user,
  membership,
  hasBIIdentity,
}: MemberPortalContentProps) {
  // Fetch profile and public profile for all users
  const [profile, publicProfile] = await Promise.all([
    getUserProfile(),
    getPublicProfile(user.user.$id),
  ]);

  // Only fetch member-specific data if they're an active member
  const isMember = membership.active;
  const [benefits, revealedBenefits, estimatedSavings] = isMember
    ? await Promise.all([
        getMemberBenefits(user.user.$id),
        getBenefitReveals(user.user.$id),
        calculateEstimatedSavings(user.user.$id),
      ])
    : [[], new Set<string>(), 0];

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
  const campus = profile?.campus?.name || user.profile?.campus?.name || "Oslo";

  // Get user name and avatar
  const userName =
    profile?.name || user.profile?.name || user.user.name || "User";
  const userAvatar = profile?.avatar || user.profile?.avatar || null;

  // Get student ID for BI email construction
  const studentId =
    profile?.student_id || user.profile?.student_id || "S000000";
  const biEmail = `${studentId}@bi.no`;

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <MemberPortalHeader
        userName={userName}
        userAvatar={userAvatar}
        campus={campus}
        membershipExpiry={expiryDate}
        daysRemaining={daysRemaining}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <MemberPortalTabs
          membershipType={membershipType}
          benefitsCount={benefits.length}
          daysRemaining={daysRemaining}
          estimatedSavings={estimatedSavings}
          startDate={startDate}
          expiryDate={expiryDate}
          benefits={benefits}
          revealedBenefits={revealedBenefits}
          isMember={isMember}
          hasBIIdentity={hasBIIdentity}
          profile={profile || user.profile || user.user}
          publicProfile={publicProfile}
          biEmail={biEmail}
          userName={userName}
          studentId={studentId}
          bankAccount={profile?.bank_account || user.profile?.bank_account}
        />
      </div>
    </div>
  );
}
