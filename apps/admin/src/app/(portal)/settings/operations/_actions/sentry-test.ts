"use server";

import { isGlobalAdmin } from "@/lib/authorization";
import { runSentryTest, type SentryTestResult } from "@/lib/sentry-test-error";

/** Sends a deliberate test error to Sentry. Global admins only. */
export async function sendSentryTestError(): Promise<SentryTestResult> {
  return await runSentryTest(isGlobalAdmin, async () => {
    // Guarded load: Sentry must never be able to break this page.
    const { captureException, flush, isEnabled } = await import(
      "@sentry/nextjs"
    );
    return { captureException, flush, isEnabled };
  });
}
