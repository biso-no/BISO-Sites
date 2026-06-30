import { getNavFeatured } from "@/app/actions/nav";
import { Footer } from "@/components/layout/footer";
import { PublicProviders } from "@/components/layout/public-providers";
import { Navigation } from "@/components/nav/mega-nav";
import { OnboardingPopout } from "@/components/onboarding/onboarding-popout";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [membershipStatus, userData, featured] = await Promise.all([
    getMembershipStatus(),
    getLoggedInUser(),
    getNavFeatured(),
  ]);

  const needsOnboarding = !!userData?.user && !userData?.profile;

  // Non-PII identity for Umami's identify(): the stable Appwrite account id plus
  // segmentation attributes. getLoggedInUser() is null for anonymous sessions,
  // so only genuine authenticated members are ever identified. Never include
  // name/email/phone — names are resolved admin-side from the account id.
  const memberIdentity = userData?.user
    ? {
        accountId: userData.user.$id,
        campus: (userData.user.prefs as { campusId?: string } | undefined)
          ?.campusId,
        role: userData.user.labels?.length
          ? userData.user.labels.join(",")
          : undefined,
        isMember: membershipStatus?.isMember ?? false,
      }
    : null;

  return (
    <PublicProviders
      initialMembershipStatus={membershipStatus}
      memberIdentity={memberIdentity}
    >
      <Navigation featured={featured} />
      <main>
        <div>{children}</div>
      </main>
      <Footer />
      <OnboardingPopout needsOnboarding={needsOnboarding} />
    </PublicProviders>
  );
}
