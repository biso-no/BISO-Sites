import { describe, expect, mock, test } from "bun:test";
import {
  runSentryTest,
  SENTRY_TEST_ERROR_MESSAGE,
  type SentryTestDeps,
} from "./sentry-test-error";

function makeDeps(enabled: boolean): SentryTestDeps {
  return {
    captureException: mock(() => "event-123"),
    flush: mock(async () => true),
    isEnabled: () => enabled,
  };
}

describe("runSentryTest", () => {
  test("returns forbidden for non-global-admins without loading Sentry", async () => {
    const load = mock(async () => makeDeps(true));
    const result = await runSentryTest(async () => false, load);
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(load).not.toHaveBeenCalled();
  });

  test("returns not_configured when Sentry is not enabled", async () => {
    const deps = makeDeps(false);
    const result = await runSentryTest(
      async () => true,
      async () => deps
    );
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(deps.captureException).not.toHaveBeenCalled();
  });

  test("returns not_configured when Sentry fails to load", async () => {
    const result = await runSentryTest(
      async () => true,
      () => Promise.reject(new Error("load failed"))
    );
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  test("captures the test error, flushes and returns the event id", async () => {
    const deps = makeDeps(true);
    const result = await runSentryTest(
      async () => true,
      async () => deps
    );
    expect(result).toEqual({ ok: true, eventId: "event-123" });
    const [error] = (deps.captureException as ReturnType<typeof mock>).mock
      .calls[0] as [Error];
    expect(error.message).toBe(SENTRY_TEST_ERROR_MESSAGE);
    expect(deps.flush).toHaveBeenCalledWith(2000);
  });
});
