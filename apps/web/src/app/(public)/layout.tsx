import { Footer } from "@/components/layout/footer";
import { Navigation } from "@/components/layout/nav";
import { PublicProviders } from "@/components/layout/public-providers";
import { OnboardingPopout } from "@/components/onboarding/onboarding-popout";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [membershipStatus, userData] = await Promise.all([
    getMembershipStatus(),
    getLoggedInUser(),
  ]);

  const needsOnboarding = !!userData?.user && !userData?.profile;

  return (
    <PublicProviders initialMembershipStatus={membershipStatus}>
      <Navigation />
      <main>
        <div>{children}</div>
      </main>
      <Footer />
      <OnboardingPopout needsOnboarding={needsOnboarding} />
    </PublicProviders>
  );
}
