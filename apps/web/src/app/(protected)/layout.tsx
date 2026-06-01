import { redirect, unauthorized } from "next/navigation";
import { getLoggedInUser } from "@/lib/actions/user";

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
