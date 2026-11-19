import { describe, expect, mock, test } from "bun:test";
import {
  runSentryTest,
  SENTRY_TEST_ERROR_MESSAGE,
  type SentryTestDeps,
  sentryTestMessage,
} from "./sentry-test-error";

function makeDeps(enabled: boolean, flushed = true): SentryTestDeps {
  return {
    captureException: mock(() => "event-123"),
    flush: mock(async () => flushed),
    isEnabled: () => enabled,
  };
}

const LABELS = {
  eventId: "Sent. Event id:",
  forbidden: "Only global admins",
  notConfigured: "Not configured",
  queued: "Queued, not confirmed. Event id:",
};

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
    expect(result).toEqual({ ok: true, eventId: "event-123", flushed: true });
    const [error] = (deps.captureException as ReturnType<typeof mock>).mock
      .calls[0] as [Error];
    expect(error.message).toBe(SENTRY_TEST_ERROR_MESSAGE);
    expect(deps.flush).toHaveBeenCalledWith(2000);
  });

  test("reports an event still queued when the flush times out", async () => {
    const result = await runSentryTest(
      async () => true,
      async () => makeDeps(true, false)
    );
    expect(result).toEqual({ ok: true, eventId: "event-123", flushed: false });
  });
});

describe("sentryTestMessage", () => {
  test("says sent only when the flush confirmed it", () => {
    expect(
      sentryTestMessage({ ok: true, eventId: "e1", flushed: true }, LABELS)
    ).toBe("Sent. Event id: e1");
    expect(
      sentryTestMessage({ ok: true, eventId: "e1", flushed: false }, LABELS)
    ).toBe("Queued, not confirmed. Event id: e1");
  });

  test("names why nothing was sent", () => {
    expect(sentryTestMessage({ ok: false, reason: "forbidden" }, LABELS)).toBe(
      "Only global admins"
    );
    expect(
      sentryTestMessage({ ok: false, reason: "not_configured" }, LABELS)
    ).toBe("Not configured");
  });
});
