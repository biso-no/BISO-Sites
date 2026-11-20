import { ReplayConsent } from "@/components/replay-consent";
import { requireAdminAccess } from "@/lib/authorization";
import { isSentryConfigured } from "@/lib/sentry-configured";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminAccess();
  return (
    <>
      {children}
      {/* The editor fills the window; padding the body would only add a gap. */}
      {isSentryConfigured() && <ReplayConsent reserveBodySpace={false} />}
    </>
  );
}
