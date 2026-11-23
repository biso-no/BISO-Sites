/**
 * Whether this build reports to Sentry: true when `NEXT_PUBLIC_SENTRY_DSN` is
 * set at build time. Without it the SDK sends nothing, so the recording
 * question, "Privacy settings" and "Report a problem" are hidden. The name is
 * written literally so Next inlines the value into the server and browser
 * bundles, which then give the same answer.
 */
export function isSentryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}
