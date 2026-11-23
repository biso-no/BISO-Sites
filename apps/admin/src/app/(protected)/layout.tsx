import { unauthorized } from "next/navigation";
import { ReplayConsent } from "@/components/replay-consent";
import { getLoggedInUser } from "@/lib/actions/user";
import { isSentryConfigured } from "@/lib/sentry-configured";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getLoggedInUser();

  if (!user) {
    unauthorized();
  }

  return (
    <>
      {children}
      {isSentryConfigured() && <ReplayConsent />}
    </>
  );
}
