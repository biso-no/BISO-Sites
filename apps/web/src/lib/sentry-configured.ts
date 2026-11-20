/**
 * Whether this build reports to Sentry. Without a DSN the SDK sends nothing,
 * so the recording question, "Privacy settings" and "Report a problem" are
 * hidden. `NEXT_PUBLIC_SENTRY_DSN` is written literally so Next inlines it at
 * build time, giving the server and the browser the same answer.
 */
export function isSentryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}
