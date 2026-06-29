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

  return (
    <PublicProviders initialMembershipStatus={membershipStatus}>
      <Navigation featured={featured} />
      <main>
        <div>{children}</div>
      </main>
      <Footer />
      <OnboardingPopout needsOnboarding={needsOnboarding} />
    </PublicProviders>
  );
}
