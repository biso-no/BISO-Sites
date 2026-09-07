import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { MembershipCheckResult } from "@/components/profile/membership-status-card";
import MembershipStatusCard from "@/components/profile/membership-status-card";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { checkMembership } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Your Profile | BISO",
  description: "View and manage your profile and privacy settings.",
};

// A BI (or Microsoft) OIDC link completes at /api/auth/bi-link, which runs
// the sync + cache invalidation itself and only then redirects here with
// `?linked=1` — see that route's doc comment. This page never re-runs the
// sync: it starts a brand-new request (this route group is already dynamic
// via `getLoggedInUser()`'s cookie read), so the reads below already see
// whatever the route handler just wrote. The `linked`/`error` query params
// carry no behaviour on this page — they're read by nothing here.
export default async function PublicProfilePage() {
  const [userData, identitiesResp, tNav] = await Promise.all([
    getLoggedInUser(),
    listIdentities(),
    getTranslations("common.navigation"),
  ]);

  const identities: { $id: string; provider: string }[] =
    identitiesResp?.identities || [];
  const hasBIIdentity = identities.some(
    (i) => String(i?.provider || "").toLowerCase() === "oidc"
  );
  const membership: MembershipCheckResult | null = hasBIIdentity
    ? await checkMembership()
    : null;

  // The layout redirects to /onboarding when there is no profile, so a name is
  // normally present; `user.name` and then the account label cover the gap
  // rather than the literal string "User" the previous header fell back to.
  const displayName =
    userData?.profile?.name || userData?.user.name || tNav("account.myProfile");

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/applications"
          >
            <Briefcase aria-hidden="true" className="size-4 shrink-0" />
            {tNav("account.myApplications")}
          </Link>
        }
        breadcrumbs={[{ label: tNav("account.heading") }]}
        eyebrow={tNav("account.myProfile")}
        lede={userData?.user.email}
        title={displayName}
      />

      <Section tone="paper" width="prose">
        <MembershipStatusCard
          hasBIIdentity={hasBIIdentity}
          initial={membership}
        />
      </Section>

      {userData ? (
        <Section className="border-edge border-t" tone="paper" width="prose">
          <ProfileTabs
            identities={identitiesResp?.identities}
            // `account.get()` returns a class instance, not a plain object like
            // the proxied `db` reads — spreading the whole result across the RSC
            // boundary throws. Narrow to the fields ProfileTabs actually declares.
            userData={{
              profile: userData.profile,
              user: {
                $id: userData.user.$id,
                email: userData.user.email,
              },
            }}
          />
        </Section>
      ) : null}
    </>
  );
}
