import { shouldIgnoreSpan, shouldPropagateTraceForUrl } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  buildBrowserOptions,
  buildServerOptions,
  DATA_COLLECTION,
  resolveEnvironment,
  SAMPLE_RATES,
  SENTRY_TUNNEL_PATH,
  SERVER_TRACE_PROPAGATION_TARGETS,
  TUNNEL_IGNORE_SPANS,
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

  it("ignores the tunnel's own spans only where the app serves a tunnel", () => {
    const base = { dsn: "x", environment: "e" } as const;
    expect(
      buildServerOptions({ ...base, app: "web", tunnel: true }).ignoreSpans
    ).toBe(TUNNEL_IGNORE_SPANS);
    expect(buildServerOptions({ ...base, app: "api" })).not.toHaveProperty(
      "ignoreSpans"
    );
  });
});

describe("buildBrowserOptions", () => {
  it("uses per-app browser trace rates", () => {
    const rate = (app: "web" | "admin" | "docs", parentSampled?: boolean) =>
      buildBrowserOptions({ app, dsn: "x", environment: "e" }).tracesSampler({
        parentSampled,
      } as never);
    expect(rate("web", true)).toBe(0.25);
    expect(rate("web", false)).toBe(0.25);
    expect(rate("admin", true)).toBe(1);
    expect(rate("docs", true)).toBe(0.25);
  });

  // The SDK prefers tracesSampler over tracesSampleRate, but a leftover rate
  // would invite the two to drift apart.
  it("sets the sampler without a tracesSampleRate", () => {
    const o = buildBrowserOptions({ app: "web", dsn: "x", environment: "e" });
    expect(o).not.toHaveProperty("tracesSampleRate");
  });

  it("profiles 10% of web and admin sessions, per trace, and docs none", () => {
    for (const app of ["web", "admin"] as const) {
      const o = buildBrowserOptions({ app, dsn: "x", environment: "e" });
      expect(o.profileSessionSampleRate).toBe(0.1);
      expect(o.profileLifecycle).toBe("trace");
    }
    const docs = buildBrowserOptions({
      app: "docs",
      dsn: "x",
      environment: "e",
    });
    expect(docs.profileSessionSampleRate).toBe(0);
    expect(docs).not.toHaveProperty("profileLifecycle");
  });

  it("keeps replay off and privacy settings strict", () => {
    const o = buildBrowserOptions({ app: "web", dsn: "x", environment: "e" });
    expect(o.replaysSessionSampleRate).toBe(0);
    expect(o.replaysOnErrorSampleRate).toBe(0);
    expect(o.dataCollection).toEqual(DATA_COLLECTION);
    expect(o.beforeSend).toBe(scrubEvent);
  });

  // Applied by the replay controller once a visitor says yes, never at init.
  it("records 25% of consenting visits and every one with an error", () => {
    for (const app of ["web", "admin"] as const) {
      expect(SAMPLE_RATES[app].replaySessions).toBe(0.25);
      expect(SAMPLE_RATES[app].replayOnError).toBe(1);
      const o = buildBrowserOptions({ app, dsn: "x", environment: "e" });
      expect(o.replaysSessionSampleRate).toBe(0);
      expect(o.replaysOnErrorSampleRate).toBe(0);
    }
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

  it("sends envelopes through the tunnel only where the app serves one", () => {
    const base = { dsn: "x", environment: "e" } as const;
    expect(
      buildBrowserOptions({ ...base, app: "web", tunnel: true }).tunnel
    ).toBe(SENTRY_TUNNEL_PATH);
    expect(buildBrowserOptions({ ...base, app: "docs" })).not.toHaveProperty(
      "tunnel"
    );
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

describe("TUNNEL_IGNORE_SPANS", () => {
  const ignored = (attributes: Record<string, string>) =>
    shouldIgnoreSpan(
      { description: "BaseServer.handleRequest", op: undefined, attributes },
      TUNNEL_IGNORE_SPANS
    );

  it("matches Next's request and route handler spans for the tunnel", () => {
    for (const target of [
      SENTRY_TUNNEL_PATH,
      `${SENTRY_TUNNEL_PATH}/`,
      `${SENTRY_TUNNEL_PATH}?x=1`,
    ]) {
      expect(
        ignored({
          "next.span_type": "BaseServer.handleRequest",
          "http.target": target,
        }),
        target
      ).toBe(true);
    }
    expect(
      ignored({
        "next.span_type": "AppRouteRouteHandlers.runHandler",
        "next.route": `${SENTRY_TUNNEL_PATH}/route`,
      })
    ).toBe(true);
  });

  it("keeps every other request", () => {
    expect(
      ignored({
        "next.span_type": "BaseServer.handleRequest",
        "http.target": "/api/relay-other",
      })
    ).toBe(false);
    expect(
      ignored({
        "next.span_type": "BaseServer.handleRequest",
        "http.target": "/api/expenses/submit",
      })
    ).toBe(false);
    expect(
      ignored({
        "next.span_type": "AppRouteRouteHandlers.runHandler",
        "next.route": "/api/health",
      })
    ).toBe(false);
    expect(ignored({ "http.target": SENTRY_TUNNEL_PATH })).toBe(false);
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
