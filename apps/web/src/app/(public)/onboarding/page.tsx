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
