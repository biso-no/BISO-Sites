/**
 * Core of the operations page "send test error" action, and the line the page
 * shows for its result. Kept out of the `"use server"` file so the Sentry
 * client and the admin check are injected and the logic is unit-testable
 * without module mocks.
 */

export const SENTRY_TEST_ERROR_MESSAGE =
  "Sentry test error from the admin operations page";

const FLUSH_TIMEOUT_MS = 2000;

export type SentryTestResult =
  /** `flushed` is false when the event was still queued after the wait. */
  | { ok: true; eventId: string; flushed: boolean }
  | { ok: false; reason: "not_configured" | "forbidden" };

/** What the page says for each result, in its language. */
export interface SentryTestResultLabels {
  /** Sent and confirmed; the event id follows. */
  eventId: string;
  forbidden: string;
  notConfigured: string;
  /** Still queued when the wait ended; the event id follows. */
  queued: string;
}

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
  const flushed = await sentry.flush(FLUSH_TIMEOUT_MS);
  return { ok: true, eventId, flushed };
}

/** The line the operations page shows for a result. */
export function sentryTestMessage(
  result: SentryTestResult,
  labels: SentryTestResultLabels
): string {
  if (result.ok) {
    return `${result.flushed ? labels.eventId : labels.queued} ${result.eventId}`;
  }
  return result.reason === "forbidden"
    ? labels.forbidden
    : labels.notConfigured;
}
