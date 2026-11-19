/**
 * Golden tests: real `console` calls go through Sentry's own console
 * integrations (logs and breadcrumbs) on a real client, then through the
 * scrubbers, exactly as on the server.
 */
import {
  type Breadcrumb,
  consoleIntegration,
  consoleLoggingIntegration,
  createTransport,
  type Log,
  resolvedSyncPromise,
  setCurrentClient,
} from "@sentry/core";
import { ServerRuntimeClient } from "@sentry/core/server";
import { NoObjectGeneratedError, TypeValidationError } from "ai";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REDACTED, scrubBreadcrumb, scrubLog } from "./scrub";

const MODEL_OUTPUT = {
  overall_score: 2,
  summary:
    "Kari Nordmann lacks finance experience; her cover letter mentions her divorce.",
};
const PERSONAL = ["Kari", "Nordmann", "divorce", "overall_score"];
const IP = "84.215.12.34";

/** What `generateObject` throws when the model's JSON fails the schema. */
const screeningError = () =>
  new NoObjectGeneratedError({
    message: "No object generated: response did not match schema.",
    cause: new TypeValidationError({
      value: MODEL_OUTPUT,
      cause: new Error("Expected number, received string"),
    }),
    text: JSON.stringify(MODEL_OUTPUT),
    response: {
      id: "resp-1",
      modelId: "claude-haiku-5-5",
      timestamp: new Date(0),
    },
    usage: { inputTokens: 1200, outputTokens: 80 } as never,
    finishReason: "stop",
  });

/** The `[request-error]` shape before `logServerRequestError` cleaned it. */
const requestError = () => ({
  app: "web",
  error: {
    digest: "123",
    message: "fetch failed for ola@biso.no",
    name: "Error",
    stack: "Error: fetch failed for ola@biso.no\n    at handler (route.ts:1:1)",
  },
  request: {
    headers: {
      cookie: "a_session=s3cr3t",
      referer: "https://biso.no/auth/verify?userId=u-77",
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": IP,
      "x-real-ip": IP,
    },
    method: "GET",
    path: "/auth/verify?secret=abc123",
  },
});

const logs: Log[] = [];
const breadcrumbs: Breadcrumb[] = [];

const everything = (): string => JSON.stringify({ breadcrumbs, logs });

const expectNoPersonalData = (): void => {
  const sent = everything();
  for (const word of [...PERSONAL, IP, "abc123", "u-77", "s3cr3t", "ola@"]) {
    expect(sent).not.toContain(word);
  }
};

beforeAll(() => {
  // Silence the real console before Sentry wraps it.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const client = new ServerRuntimeClient({
    // A client needs a DSN to run its integrations; the transport sends nothing.
    dsn: "https://key@o1.ingest.de.sentry.io/2",
    integrations: [
      consoleLoggingIntegration({ levels: ["warn", "error"] }),
      consoleIntegration({ levels: ["warn", "error"] }),
    ],
    stackParser: () => [],
    transport: (options) =>
      createTransport(options, () => resolvedSyncPromise({})),
    // Record what would be sent; send nothing.
    beforeBreadcrumb: (breadcrumb) => {
      breadcrumbs.push(scrubBreadcrumb(breadcrumb));
      return null;
    },
    beforeSendLog: (log) => {
      logs.push(scrubLog(log));
      return null;
    },
  });
  setCurrentClient(client);
  client.init();
});

beforeEach(() => {
  logs.length = 0;
  breadcrumbs.length = 0;
});

const onlyLog = (): Log => {
  expect(logs).toHaveLength(1);
  return logs[0] as Log;
};

describe("console logs and breadcrumbs", () => {
  it("reduces an AI SDK error argument to its name", () => {
    console.warn(
      "AI screening failed for application app-1:",
      screeningError()
    );

    const log = onlyLog();
    expect(log.message).toBe(
      "AI screening failed for application app-1: AI_NoObjectGeneratedError"
    );
    expect(log.attributes?.["sentry.message.parameter.0"]).toBe(
      "AI_NoObjectGeneratedError"
    );
    expect(breadcrumbs[0]?.message).toBe(log.message);
    expectNoPersonalData();
  });

  it("drops IPs, cookies and queries from a string plus request object", () => {
    console.error("[request-error]", requestError());

    const log = onlyLog();
    const message = String(log.message);
    expect(message).toContain("[request-error] ");
    expect(message).toContain('"path":"/auth/verify"');
    expect(message).toContain('"error":"Error: fetch failed for [redacted]"');
    expect(message).toContain('"user-agent":"Mozilla/5.0"');
    expect(log.attributes?.["sentry.message.parameter.0"]).toMatchObject({
      request: {
        headers: {
          cookie: REDACTED,
          referer: "https://biso.no/auth/verify",
          "x-forwarded-for": REDACTED,
          "x-real-ip": REDACTED,
        },
        path: "/auth/verify",
      },
    });
    expectNoPersonalData();
  });

  it("reduces a bare error to its name, or its name and scrubbed message", () => {
    console.error(screeningError());
    console.error(new TypeError("bad input from ola@biso.no"));

    expect(logs.map((log) => log.message)).toEqual([
      "AI_NoObjectGeneratedError",
      "TypeError: bad input from [redacted]",
    ]);
    expect(breadcrumbs.map((crumb) => crumb.message)).toEqual([
      "AI_NoObjectGeneratedError",
      "TypeError: bad input from [redacted]",
    ]);
    expectNoPersonalData();
  });

  it("cleans an object logged first, its attributes and later arguments", () => {
    console.error(
      { ...requestError(), cause: screeningError(), text: "Kari Nordmann" },
      "while screening",
      screeningError()
    );

    const log = onlyLog();
    expect(log.attributes).not.toHaveProperty("text");
    expect(log.attributes).not.toHaveProperty("cause");
    expect(log.attributes?.error).toBe("Error: fetch failed for [redacted]");
    expect(log.attributes?.request).toMatchObject({
      headers: { "x-forwarded-for": REDACTED },
      path: "/auth/verify",
    });
    expect(log.attributes?.["sentry.message.parameter.0"]).toBe(
      "AI_NoObjectGeneratedError"
    );
    expect(String(log.message)).toContain(
      "while screening AI_NoObjectGeneratedError"
    );
    expectNoPersonalData();
  });

  it("cleans arguments a format string would substitute", () => {
    console.warn("screening %s failed", screeningError());

    expect(onlyLog().message).toBe(
      "screening %s failed AI_NoObjectGeneratedError"
    );
    expectNoPersonalData();
  });

  describe("breadcrumb size", () => {
    const consoleCrumb = (...args: unknown[]): Breadcrumb => ({
      category: "console",
      level: "log",
      data: { arguments: args },
      message: "",
    });

    it("bounds a large cyclic graph in time and size", () => {
      const nodes: Record<string, unknown>[] = Array.from(
        { length: 40 },
        (_, i) => ({ id: i })
      );
      for (const [i, node] of nodes.entries()) {
        for (let p = 0; p < 7; p++) {
          node[`link${p}`] = nodes[(i + p + 1) % nodes.length];
        }
      }
      const started = performance.now();
      const out = scrubBreadcrumb(consoleCrumb("graph", nodes[0]));
      expect(performance.now() - started).toBeLessThan(50);
      expect(String(out.message).length).toBeLessThanOrEqual(2048);
    });

    it("caps a 300-row array argument with an ellipsis", () => {
      const rows = Array.from({ length: 300 }, (_, i) => ({
        id: i,
        status: "paid",
        total: i * 10,
      }));
      const out = scrubBreadcrumb(consoleCrumb("orders", rows));
      expect(String(out.message).length).toBeLessThanOrEqual(2048);
      expect(String(out.message).endsWith("…")).toBe(true);
    });
  });
});
