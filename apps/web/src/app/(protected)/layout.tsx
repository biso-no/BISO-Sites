import { redirect, unauthorized } from "next/navigation";
import { getLoggedInUser } from "@/lib/actions/user";

// Auth gating reads the session on every request — the documented use case
// for opting a layout segment out of instant-navigation validation.
export const instant = false;

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getLoggedInUser();

  if (!userData) {
    unauthorized();
  } else if (!userData.profile) {
    redirect("/onboarding?required=1");
  }

  return <>{children}</>;
}
