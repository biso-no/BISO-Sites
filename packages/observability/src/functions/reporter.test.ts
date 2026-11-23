import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReporter, reporterFromEnv } from "./reporter";

const DSN = "https://abc123@o42.ingest.de.sentry.io/777";
const CRON_BASE =
  "https://o42.ingest.de.sentry.io/api/777/cron/scheduled-dispatch/abc123/";
const ENVELOPE_URL =
  "https://o42.ingest.de.sentry.io/api/777/envelope/?sentry_key=abc123&sentry_version=7";
const MONITOR = {
  schedule: "*/5 * * * *",
  checkinMargin: 2,
  maxRuntime: 6,
  failureIssueThreshold: 2,
  recoveryThreshold: 1,
  timezone: "UTC",
};

const HEX_32 = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f-]{36}$/;
const IMPORT_STATEMENT = /^\s*import[\s{*"']/m;
const DYNAMIC_IMPORT = /\bimport\(/;
const REQUIRE_CALL = /\brequire\(/;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("disabled reporter", () => {
  it.each([
    undefined,
    "",
    "   ",
    "garbage",
    "https://nokey.sentry.io/1",
  ])("is inert for dsn %j", async (dsn) => {
    const reporter = createReporter({ dsn });
    expect(reporter.enabled).toBe(false);
    reporter.captureError(new Error("x"));
    expect(reporter.checkIn("a", "ok")).toBeUndefined();
    await reporter.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("captureError", () => {
  it("sends one scrubbed three-line envelope", async () => {
    const reporter = createReporter({
      dsn: DSN,
      environment: "staging",
      release: "biso-functions@dep1",
      tags: { function_name: "scheduled-dispatch" },
    });
    reporter.captureError(
      new Error("Konto 1234.56.78903 failed for ola@biso.no"),
      { target: "orders" }
    );
    await reporter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENVELOPE_URL);
    expect(init.headers["Content-Type"]).toBe("application/x-sentry-envelope");
    const lines = (init.body as string).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1])).toEqual({ type: "event" });
    const event = JSON.parse(lines[2]);
    expect(event.event_id).toMatch(HEX_32);
    expect(JSON.parse(lines[0]).event_id).toBe(event.event_id);
    expect(event.platform).toBe("javascript");
    expect(event.level).toBe("error");
    expect(event.environment).toBe("staging");
    expect(event.release).toBe("biso-functions@dep1");
    expect(event.tags).toEqual({
      function_name: "scheduled-dispatch",
      target: "orders",
    });
    const [entry] = event.exception.values;
    expect(entry.type).toBe("Error");
    expect(entry.value).toBe("Konto [redacted] failed for [redacted]");
    expect(entry.stacktrace.frames.length).toBeGreaterThan(0);
    expect(typeof event.timestamp).toBe("number");
  });

  it("handles non-Error values", async () => {
    const reporter = createReporter({ dsn: DSN });
    reporter.captureError("boom ola@biso.no");
    await reporter.flush();
    const event = JSON.parse(fetchMock.mock.calls[0][1].body.split("\n")[2]);
    expect(event.exception.values[0].value).toBe("boom [redacted]");
    expect(event.release).toBeUndefined();
  });

  it("does not throw when fetch throws synchronously", async () => {
    fetchMock.mockImplementation(() => {
      throw new Error("sync");
    });
    const reporter = createReporter({ dsn: DSN });
    expect(() => reporter.captureError(new Error("x"))).not.toThrow();
    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});

describe("checkIn", () => {
  it("posts the monitor config and reuses the id to close", async () => {
    const reporter = createReporter({ dsn: DSN, environment: "production" });
    const id = reporter.checkIn("scheduled-dispatch", "in_progress", {
      monitorConfig: MONITOR,
    });
    expect(id).toMatch(UUID);
    const closed = reporter.checkIn("scheduled-dispatch", "ok", {
      checkInId: id,
      durationSeconds: 3.5,
    });
    expect(closed).toBe(id);
    await reporter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${CRON_BASE}?status=in_progress&check_in_id=${id}&environment=production`
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      status: "in_progress",
      check_in_id: id,
      environment: "production",
      monitor_config: {
        schedule: { type: "crontab", value: "*/5 * * * *" },
        checkin_margin: 2,
        max_runtime: 6,
        failure_issue_threshold: 2,
        recovery_threshold: 1,
        timezone: "UTC",
      },
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${CRON_BASE}?status=ok&check_in_id=${id}&environment=production`
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      status: "ok",
      check_in_id: id,
      environment: "production",
      duration: 3.5,
    });
  });
});

describe("scrubbing of type and frame names", () => {
  it("scrubs the exception type and frame function names", async () => {
    const reporter = createReporter({ dsn: DSN });
    const error = new Error("boom");
    error.name = "Failed for kari@example.com";
    error.stack =
      "Failed for kari@example.com: boom\n    at handle for kari@example.com (/app/main.ts:1:2)";
    reporter.captureError(error);
    await reporter.flush();
    const body = fetchMock.mock.calls[0][1].body as string;
    expect(body).not.toContain("kari@example.com");
    const event = JSON.parse(body.split("\n")[2]);
    expect(event.exception.values[0].type).toContain("[redacted]");
  });
});

describe("flush", () => {
  it("resolves within the cap when fetch hangs", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const reporter = createReporter({ dsn: DSN });
    reporter.captureError(new Error("x"));
    reporter.checkIn("a", "ok");
    let done = false;
    const flushed = reporter.flush().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await flushed;
    expect(done).toBe(true);
  });

  it("resolves when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const reporter = createReporter({ dsn: DSN });
    reporter.captureError(new Error("x"));
    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});

describe("check-in ordering", () => {
  it("issues the closing check-in only after the in_progress one settled", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      const status = new URL(url).searchParams.get("status");
      events.push(`start:${status}`);
      return new Promise((resolve) => {
        setTimeout(
          () => {
            events.push(`end:${status}`);
            resolve(new Response("{}"));
          },
          status === "in_progress" ? 300 : 0
        );
      });
    });
    const reporter = createReporter({ dsn: DSN });
    const id = reporter.checkIn("a", "in_progress");
    reporter.checkIn("a", "ok", { checkInId: id });
    const flushed = reporter.flush();
    await vi.advanceTimersByTimeAsync(400);
    await flushed;
    expect(events).toEqual([
      "start:in_progress",
      "end:in_progress",
      "start:ok",
      "end:ok",
    ]);
  });

  it("still resolves within the cap when in_progress hangs", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const reporter = createReporter({ dsn: DSN });
    const id = reporter.checkIn("a", "in_progress");
    expect(() => reporter.checkIn("a", "ok", { checkInId: id })).not.toThrow();
    const flushed = reporter.flush();
    await vi.advanceTimersByTimeAsync(2001);
    await expect(flushed).resolves.toBeUndefined();
  });
});

describe("reporterFromEnv", () => {
  it("reads env and tags the function", async () => {
    const reporter = reporterFromEnv(
      {
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "dev",
        APPWRITE_FUNCTION_DEPLOYMENT: "d9",
      },
      "member-roster-sync"
    );
    reporter.captureError(new Error("x"));
    await reporter.flush();
    const event = JSON.parse(fetchMock.mock.calls[0][1].body.split("\n")[2]);
    expect(event.release).toBe("biso-functions@d9");
    expect(event.environment).toBe("dev");
    expect(event.tags).toEqual({ function_name: "member-roster-sync" });
    expect(event.tags).not.toHaveProperty("function");
  });

  it("is inert without SENTRY_DSN", () => {
    expect(reporterFromEnv({}, "x").enabled).toBe(false);
  });

  it("defaults the environment to production when SENTRY_ENVIRONMENT is unset", async () => {
    const reporter = reporterFromEnv({ SENTRY_DSN: DSN }, "x");
    reporter.captureError(new Error("x"));
    await reporter.flush();
    const event = JSON.parse(fetchMock.mock.calls[0][1].body.split("\n")[2]);
    expect(event.environment).toBe("production");
  });
});

describe("source", () => {
  it("has no import or require statements", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./reporter.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(IMPORT_STATEMENT);
    expect(source).not.toMatch(DYNAMIC_IMPORT);
    expect(source).not.toMatch(REQUIRE_CALL);
  });
});
