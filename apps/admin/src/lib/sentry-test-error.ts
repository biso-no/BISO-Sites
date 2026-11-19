/**
 * Core of the operations page "send test error" action. Kept out of the
 * `"use server"` file so the Sentry client and the admin check are injected and
 * the logic is unit-testable without module mocks.
 */

export const SENTRY_TEST_ERROR_MESSAGE =
  "Sentry test error from the admin operations page";

const FLUSH_TIMEOUT_MS = 2000;

export type SentryTestResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: "not_configured" | "forbidden" };

export interface SentryTestDeps {
  captureException: (error: Error) => string;
  flush: (timeoutMs: number) => Promise<boolean>;
  isEnabled: () => boolean;
}

export async function runSentryTest(
  isAllowed: () => Promise<boolean>,
  loadSentry: () => Promise<SentryTestDeps>
): Promise<SentryTestResult> {
  if (!(await isAllowed())) {
    return { ok: false, reason: "forbidden" };
  }

  let sentry: SentryTestDeps;
  try {
    sentry = await loadSentry();
  } catch {
    return { ok: false, reason: "not_configured" };
  }
  if (!sentry.isEnabled()) {
    return { ok: false, reason: "not_configured" };
  }

  const eventId = sentry.captureException(new Error(SENTRY_TEST_ERROR_MESSAGE));
  await sentry.flush(FLUSH_TIMEOUT_MS);
  return { ok: true, eventId };
}
