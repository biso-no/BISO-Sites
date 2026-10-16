import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";

export const metadata: Metadata = {
  description: "Set up your BISO profile to access events, benefits, and more.",
  title: "Set up your profile | BISO",
};

interface OnboardingPageProps {
  searchParams: Promise<{
    link_error?: string;
    linked?: string;
    required?: string;
  }>;
}

// A BI sign-in completes at /auth/oauth, which writes the student number
// itself and sends a brand-new student here with `?linked=1`. This page never
// runs that sync: `params.linked` is read purely as a UI flag, so a refresh
// of this URL is inert.
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;

  const userData = await getLoggedInUser();

  if (!userData) {
    redirect("/auth/login?redirectTo=/onboarding");
  }

  // Already has a profile and not mid-OAuth-flow → nothing to do here
  if (userData.profile && params.linked !== "1" && !params.link_error) {
    redirect("/profile");
  }

  // An account that already carries a BI identity has nothing to gain from
  // the "sign in with BI" step, whether or not this visit came straight from
  // the sign-in; a failed student sync is reported by the toast instead.
  const identities = (await listIdentities())?.identities ?? [];
  const hasBiIdentity = identities.some(
    (identity) => identity.provider.toLowerCase() === "oidc"
  );

  return (
    // `pt-20` clears the fixed 80px nav. `<main>` adds no offset — every page
    // provides its own (that is what `<Section clearNav>` does) — and this one
    // never did, so the flow's first rows sat behind the header. The flow's own
    // container is already sized `min-h-[calc(100vh-5rem)]`, i.e. it was
    // written expecting exactly this offset.
    // The flow's card sits on the navy field itself; the blurred glow that
    // used to sit behind it was decoration (no glows, no blur in v2).
    <div className="min-h-screen bg-deep pt-20">
      <OnboardingFlow
        initialName={userData.user.name ?? ""}
        linkedBi={params.linked === "1" || hasBiIdentity}
        required={params.required === "1"}
      />
    </div>
  );
}
