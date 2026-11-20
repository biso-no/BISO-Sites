import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { reporterFromEnv } from "@repo/observability/functions";
import { reportResponse } from "./report";

const DSN = "https://abc123@o42.ingest.de.sentry.io/777";
const realFetch = globalThis.fetch;
let calls: { body: string; url: string }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = ((url: string, init?: { body?: string }) => {
    calls.push({ body: String(init?.body ?? ""), url: String(url) });
    return Promise.resolve(new Response("{}"));
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("reportResponse", () => {
  it("sends one error naming the status, tagged with the function", async () => {
    const reporter = reporterFromEnv({ SENTRY_DSN: DSN }, "content-notifier");
    reportResponse(reporter, 500);
    await reporter.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/envelope/");
    expect(calls[0]?.body).toContain("content-notifier answered 500");
    expect(calls[0]?.body).toContain("content-notifier");
  });

  it("stays quiet for 2xx responses and skips", async () => {
    const reporter = reporterFromEnv({ SENTRY_DSN: DSN }, "content-notifier");
    reportResponse(reporter, 200);
    reportResponse(reporter, 304);
    await reporter.flush();
    expect(calls).toHaveLength(0);
  });

  it("does not report 401 or 403, but reports other 4xx and 5xx", async () => {
    const reporter = reporterFromEnv({ SENTRY_DSN: DSN }, "content-notifier");
    reportResponse(reporter, 401);
    reportResponse(reporter, 403);
    await reporter.flush();
    expect(calls).toHaveLength(0);
    reportResponse(reporter, 404);
    reportResponse(reporter, 502);
    await reporter.flush();
    expect(calls).toHaveLength(2);
  });

  it("makes no network call without a DSN", async () => {
    const reporter = reporterFromEnv({}, "content-notifier");
    reportResponse(reporter, 502);
    await reporter.flush();
    expect(calls).toHaveLength(0);
  });
});
