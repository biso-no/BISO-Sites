import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MemberPass } from "@/components/member-pass/member-pass";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";

export const metadata: Metadata = {
  title: "Your Profile | BISO",
  description: "View and manage your profile and privacy settings.",
};

// A BI sign-in writes the student number at /auth/oauth before redirecting
// here, and this route group is dynamic via `getLoggedInUser()`'s cookie
// read, so the reads below already see it. Nothing on this page links or
// syncs anything.
export default async function PublicProfilePage() {
  const [userData, identitiesResp, tNav, tMembership] = await Promise.all([
    getLoggedInUser(),
    listIdentities(),
    getTranslations("common.navigation"),
    getTranslations("memberPortal.membership"),
  ]);

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

      {/* The live member pass, up front. It reads its own state from
          /api/member-pass — active pass, not a member, expired, or no BI
          sign-in — so the page passes it nothing. */}
      <Section tone="paper" width="prose">
        <SectionHeading>{tMembership("yourPass")}</SectionHeading>
        <div className="max-w-md">
          <MemberPass />
        </div>
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
