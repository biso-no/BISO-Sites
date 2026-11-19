import { shouldPropagateTraceForUrl } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  buildBrowserOptions,
  buildServerOptions,
  DATA_COLLECTION,
  resolveEnvironment,
  SAMPLE_RATES,
  SERVER_TRACE_PROPAGATION_TARGETS,
} from "./options";
import {
  scrubBreadcrumb,
  scrubEvent,
  scrubLog,
  scrubMetric,
  scrubSpan,
} from "./scrub";

// The SDK's own matcher, so the test sees what the server SDK decides.
const propagatesTo = (url: string) =>
  shouldPropagateTraceForUrl(url, SERVER_TRACE_PROPAGATION_TARGETS);

describe("buildServerOptions", () => {
  it("is disabled without a DSN", () => {
    const base = { app: "web", environment: "development" } as const;
    expect(buildServerOptions({ ...base, dsn: undefined }).enabled).toBe(false);
    expect(buildServerOptions({ ...base, dsn: "  " }).enabled).toBe(false);
  });

  it("is enabled with a trimmed DSN", () => {
    const o = buildServerOptions({
      app: "web",
      dsn: " https://k@o1.ingest.de.sentry.io/2 ",
      environment: "production",
    });
    expect(o.enabled).toBe(true);
    expect(o.dsn).toBe("https://k@o1.ingest.de.sentry.io/2");
    expect(o.initialScope.tags.app).toBe("web");
  });

  it("uses 100% server traces for every app", () => {
    for (const app of ["web", "admin", "api", "docs"] as const) {
      const o = buildServerOptions({ app, dsn: "x", environment: "e" });
      expect(o.tracesSampleRate).toBe(SAMPLE_RATES[app].serverTraces);
      expect(o.tracesSampleRate).toBe(1);
    }
  });

  it("carries all five scrub hooks", () => {
    const o = buildServerOptions({ app: "api", dsn: "x", environment: "e" });
    expect(o.beforeSend).toBe(scrubEvent);
    expect(o.beforeBreadcrumb).toBe(scrubBreadcrumb);
    expect(o.beforeSendLog).toBe(scrubLog);
    expect(o.beforeSendSpan).toBe(scrubSpan);
    expect(o.beforeSendMetric).toBe(scrubMetric);
  });

  it("does not ignore aborted requests on the server", () => {
    const o = buildServerOptions({ app: "api", dsn: "x", environment: "e" });
    const ignoreErrors = (o as { ignoreErrors?: unknown[] }).ignoreErrors;
    expect(ignoreErrors ?? []).not.toContain("AbortError");
    expect(o).not.toHaveProperty("denyUrls");
  });

  it("propagates traces only to the BISO server targets", () => {
    const o = buildServerOptions({ app: "web", dsn: "x", environment: "e" });
    expect(o.tracePropagationTargets).toBe(SERVER_TRACE_PROPAGATION_TARGETS);
  });
});

describe("buildBrowserOptions", () => {
  it("uses per-app browser trace rates", () => {
    const rate = (app: "web" | "admin" | "docs") =>
      buildBrowserOptions({ app, dsn: "x", environment: "e" }).tracesSampleRate;
    expect(rate("web")).toBe(0.25);
    expect(rate("admin")).toBe(1);
    expect(rate("docs")).toBe(0.25);
  });

  it("keeps replay off and privacy settings strict", () => {
    const o = buildBrowserOptions({ app: "web", dsn: "x", environment: "e" });
    expect(o.replaysSessionSampleRate).toBe(0);
    expect(o.replaysOnErrorSampleRate).toBe(0);
    expect(o.dataCollection).toEqual(DATA_COLLECTION);
    expect(o.beforeSend).toBe(scrubEvent);
  });

  it("ignores browser noise such as aborted requests", () => {
    const o = buildBrowserOptions({ app: "web", dsn: "x", environment: "e" });
    expect(o.ignoreErrors).toContain("AbortError");
    expect(o.denyUrls.length).toBeGreaterThan(0);
  });

  // Unset, the browser SDK adds trace headers to same-origin requests only.
  // Any explicit list would also match cross-origin URLs such as api.biso.no,
  // whose CORS preflight then fails.
  it("leaves trace propagation at the SDK's same-origin default", () => {
    for (const app of ["web", "admin", "docs"] as const) {
      const o = buildBrowserOptions({ app, dsn: "x", environment: "e" });
      expect(o).not.toHaveProperty("tracePropagationTargets");
    }
  });
});

describe("SERVER_TRACE_PROPAGATION_TARGETS", () => {
  it("matches the BISO Sites and localhost on any port", () => {
    for (const url of [
      "https://biso.no",
      "https://biso.no/x",
      "https://www.biso.no/events?x=1",
      "https://admin.biso.no/api/x",
      "https://api.biso.no/api/expenses/submit",
      "https://docs.biso.no/docs",
      "http://localhost:3003/api/x",
      "http://localhost/x",
    ]) {
      expect(propagatesTo(url), url).toBe(true);
    }
  });

  it("never matches Appwrite, third parties or lookalike origins", () => {
    for (const url of [
      "https://appwrite.biso.no/v1/account",
      "https://api.vipps.no/epayment/v1/payments",
      "https://apitest.vipps.no/accesstoken/get",
      "https://api.stripe.com/v1/checkout/sessions",
      "https://graph.microsoft.com/v1.0/users",
      "https://login.microsoftonline.com/x/oauth2/v2.0/token",
      "https://api.openai.com/v1/responses",
      "https://api.anthropic.com/v1/messages",
      "https://biso.no.example.com/x",
      "https://evilbiso.no/x",
      "http://biso.no/x",
      "http://localhost.example.com/x",
      "/api/x",
    ]) {
      expect(propagatesTo(url), url).toBe(false);
    }
  });
});

describe("resolveEnvironment", () => {
  it("prefers an explicit value and falls back to NODE_ENV", () => {
    expect(resolveEnvironment(undefined, "production")).toBe("production");
    expect(resolveEnvironment(undefined, "development")).toBe("development");
    expect(resolveEnvironment("staging", "production")).toBe("staging");
    expect(resolveEnvironment("  ", "production")).toBe("production");
  });
});
