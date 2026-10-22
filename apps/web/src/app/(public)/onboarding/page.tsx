import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { getMembershipTextItems } from "@/lib/data/membership-texts";

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

  const items = await getMembershipTextItems("onboarding", await getLocale());

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
        items={items}
        linkedBi={params.linked === "1" || hasBiIdentity}
        required={params.required === "1"}
      />
    </div>
  );
}
