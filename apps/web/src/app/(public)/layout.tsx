import { getLocale } from "@/app/actions/locale";
import { Footer } from "@/components/layout/footer";
import { PublicProviders } from "@/components/layout/public-providers";
import { Navigation } from "@/components/nav/mega-nav";
import { OnboardingPopout } from "@/components/onboarding/onboarding-popout";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { cachedNavFeatured } from "@/lib/data/public-content";

const EMPTY_FEATURED = { event: null, news: null, project: null };

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [membershipStatus, userData, locale] = await Promise.all([
    getMembershipStatus(),
    getLoggedInUser(),
    getLocale(),
  ]);
  // Cached, shared across all anonymous visitors; a cold-cache Appwrite
  // failure degrades to an empty featured column instead of a render error.
  const featured = await cachedNavFeatured(locale).catch(() => EMPTY_FEATURED);

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
