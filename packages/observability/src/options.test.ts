import { describe, expect, it } from "vitest";
import {
  buildBrowserOptions,
  buildServerOptions,
  DATA_COLLECTION,
  resolveEnvironment,
  SAMPLE_RATES,
  TRACE_PROPAGATION_TARGETS,
} from "./options";
import { scrubEvent } from "./scrub";

const matches = (url: string) =>
  TRACE_PROPAGATION_TARGETS.some((t) =>
    typeof t === "string" ? url.includes(t) : t.test(url)
  );

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
});

describe("TRACE_PROPAGATION_TARGETS", () => {
  it("matches BISO origins and relative URLs", () => {
    expect(matches("/api/x")).toBe(true);
    expect(matches("https://biso.no/x")).toBe(true);
    expect(matches("https://api.biso.no/api/x")).toBe(true);
  });

  it("never matches Appwrite or lookalike origins", () => {
    expect(matches("https://appwrite.biso.no/v1/account")).toBe(false);
    expect(matches("https://evil.biso.no.example.com")).toBe(false);
    expect(matches("//cdn.example.com/x")).toBe(false);
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
