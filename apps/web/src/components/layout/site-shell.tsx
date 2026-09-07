import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
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
import type { NavAccount } from "@/lib/types/nav";

const EMPTY_FEATURED = { event: null, news: null, project: null };
const MAX_INITIALS = 2;
const WHITESPACE = /\s+/;

/** "Markus Heien" → "MH". Derived server-side so the client never recomputes. */
function initialsFor(name: string): string {
  const initials = name
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "?";
}

/**
 * The site chrome — providers, mega-menu navigation, footer — shared by the
 * `(public)` and `(protected)` route groups.
 *
 * `(protected)` renders this too so the personal routes (`/profile`,
 * `/applications`, `/fs`) are not chrome-less dead ends: the account menu that
 * leads users there is also how they get back out. The auth gate stays in
 * `(protected)/layout.tsx` and runs before this component.
 */
export async function SiteShell({ children }: { children: React.ReactNode }) {
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

  // Only pay for the flag read when there is someone to show the entry to.
  // `getLoggedInUser()` already excludes anonymous sessions, so `account` is
  // null for guests and the nav renders a sign-in link instead.
  let account: NavAccount | null = null;
  if (userData?.user) {
    const name = userData.profile?.name || userData.user.name || "";
    account = {
      email: userData.user.email || null,
      initials: initialsFor(name || userData.user.email || ""),
      name: name || userData.user.email || "",
      showFinancialServices: await isFeatureEnabled("expenses_module"),
    };
  }

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
      <Navigation account={account} featured={featured} />
      <main>
        <div>{children}</div>
      </main>
      <Footer />
      <OnboardingPopout needsOnboarding={needsOnboarding} />
    </PublicProviders>
  );
}
