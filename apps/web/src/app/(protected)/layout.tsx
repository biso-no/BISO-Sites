import { redirect, unauthorized } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { getLoggedInUser } from "@/lib/actions/user";

// Auth gating reads the session on every request — the documented use case
// for opting a layout segment out of instant-navigation validation.
export const instant = false;

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `getLoggedInUser()` is request-memoized with `cache()`, so the shell's own
  // call below reuses this result rather than re-reading the session.
  const userData = await getLoggedInUser();

  if (!userData) {
    unauthorized();
  } else if (!userData.profile) {
    redirect("/onboarding?required=1");
  }

  // Same chrome as `(public)`: without it the personal routes reachable from
  // the account menu would render with no header and no way back into the site.
  return <SiteShell>{children}</SiteShell>;
}
