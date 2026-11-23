import "@/app/styles.css";
import { ReplayConsent } from "@/components/replay-consent";
import { isSentryConfigured } from "@/lib/sentry-configured";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* The sign-in page scrolls the body, which makes room for the bar. */}
      {isSentryConfigured() && <ReplayConsent />}
    </>
  );
}
