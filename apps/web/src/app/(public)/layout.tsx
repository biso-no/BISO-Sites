import { cookies } from "next/headers";
import { getLocale } from "@/app/actions/locale";
import { Footer } from "@/components/layout/footer";
import { PublicProviders } from "@/components/layout/public-providers";
import { Navigation } from "@/components/nav/mega-nav";
import { OnboardingPopout } from "@/components/onboarding/onboarding-popout";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import { sessionNavFeatured } from "@/lib/data/nav-featured";
import { cachedNavFeatured } from "@/lib/data/public-content";

const EMPTY_FEATURED = { event: null, news: null, project: null };

// Request-bound gating (session → membership status) lives in this layout, so
// there is no meaningful static shell for it yet. `instant = false` exempts
// THIS segment from instant-navigation validation — the root layout's export
// does not cascade; each segment opts out for itself. Descendant pages remain
// validated. Follow-up: stream membership via Suspense to restore instant
// navigation for the public tree.
export const instant = false;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [membershipStatus, userData, locale, cookieStore] = await Promise.all([
    getMembershipStatus(),
    getLoggedInUser(),
    getLocale(),
    cookies(),
  ]);
  // Anonymous visitors (all bot/monitor traffic) share one cached result;
  // session holders get a per-request read so member-only rows still surface
  // in the nav. A failure degrades to an empty featured column, and never
  // poisons the shared cache.
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE));
  const featured = await (hasSession
    ? sessionNavFeatured(locale)
    : cachedNavFeatured(locale)
  ).catch(() => EMPTY_FEATURED);

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
