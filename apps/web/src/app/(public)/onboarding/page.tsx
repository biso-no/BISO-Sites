import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getLoggedInUser } from "@/lib/actions/user";

export const metadata: Metadata = {
  description: "Set up your BISO profile to access events, benefits, and more.",
  title: "Set up your profile | BISO",
};

interface OnboardingPageProps {
  searchParams: Promise<{
    linked?: string;
    oidc_failed?: string;
    required?: string;
  }>;
}

// A BI OIDC link completes at /api/auth/bi-link, which runs the sync + cache
// invalidation itself and only then redirects here with `?linked=1` — see
// that route's doc comment. This page never re-runs the sync: `params.linked`
// below is read purely as a UI flag (mid-OAuth-flow bookkeeping), not a
// trigger — a refresh of this URL is now inert instead of re-running the
// Graph call and the DB write.
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;

  const userData = await getLoggedInUser();

  if (!userData) {
    redirect("/auth/login?redirectTo=/onboarding");
  }

  // Already has a profile and not mid-OAuth-flow → nothing to do here
  if (userData.profile && params.linked !== "1") {
    redirect("/profile");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-dark">
      {/* Radial brand-blue glow centred behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[520px] w-[520px] rounded-full bg-brand/10 blur-3xl" />
      </div>
      <OnboardingFlow
        initialName={userData.user.name ?? ""}
        linkedBi={params.linked === "1"}
        required={params.required === "1"}
      />
    </div>
  );
}
