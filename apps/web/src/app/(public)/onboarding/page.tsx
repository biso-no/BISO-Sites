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
    // `pt-20` clears the fixed 80px nav. `<main>` adds no offset — every page
    // provides its own (that is what `<Section clearNav>` does) — and this one
    // never did, so the flow's first rows sat behind the header. The flow's own
    // container is already sized `min-h-[calc(100vh-5rem)]`, i.e. it was
    // written expecting exactly this offset.
    <div className="relative min-h-screen overflow-hidden bg-deep pt-20">
      {/* Radial glow centred behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[520px] w-[520px] rounded-full bg-sky/10 blur-3xl" />
      </div>
      <OnboardingFlow
        initialName={userData.user.name ?? ""}
        linkedBi={params.linked === "1"}
        required={params.required === "1"}
      />
    </div>
  );
}
