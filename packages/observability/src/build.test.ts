import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveRelease,
  SENTRY_TRANSPILE_PACKAGES,
  sentryBuildOptions,
} from "./build";

const SENTRY_INCLUDE_GLOB = /node_modules\/@sentry\//;

describe("resolveRelease", () => {
  it("prefers SENTRY_RELEASE", () => {
    expect(resolveRelease("web", { SENTRY_RELEASE: "custom-1" })).toBe(
      "custom-1"
    );
  });

  it("uses the Appwrite commit hash", () => {
    expect(
      resolveRelease("api", { APPWRITE_VCS_COMMIT_HASH: "abcdef1234567890ff" })
    ).toBe("biso-api@abcdef123456");
  });

  it("falls back to git, then undefined", () => {
    expect(resolveRelease("docs", {}, () => "0123456789abcdef")).toBe(
      "biso-docs@0123456789ab"
    );
    expect(resolveRelease("docs", {}, () => undefined)).toBeUndefined();
  });
});

describe("sentryBuildOptions", () => {
  it("returns upload options for the app project", () => {
    const o = sentryBuildOptions("admin");
    expect(o.org).toBe("bi-student-organisation");
    expect(o.project).toBe("biso-admin");
    expect(o.authToken).toBe(process.env.SENTRY_AUTH_TOKEN);
    expect(o.release.name).toBe(resolveRelease("admin"));
    expect(o.sourcemaps.deleteSourcemapsAfterUpload).toBe(true);
    expect(o.widenClientFileUpload).toBe(true);
    expect(o.telemetry).toBe(false);
    expect(typeof o.errorHandler).toBe("function");
    expect(() => o.errorHandler(new Error("boom"))).not.toThrow();
  });

  it("drops the SDK's debug logging from the bundles", () => {
    expect(sentryBuildOptions("web").bundleSizeOptimizations).toEqual({
      excludeDebugStatements: true,
    });
  });
});

describe("SENTRY_TRANSPILE_PACKAGES", () => {
  // Transpiled, `@sentry/nextjs` stays bundled on Bun builds, so no app needs
  // the `outputFileTracingIncludes` globs that slowed builds on Next 16.3.
  it("bundles the server SDK", () => {
    expect(SENTRY_TRANSPILE_PACKAGES).toEqual(["@sentry/nextjs"]);
  });
});

describe("next.config files", () => {
  const apps = ["web", "admin", "api", "docs"] as const;
  const configs = apps.map((app) => ({
    app,
    source: readFileSync(
      fileURLToPath(
        new URL(`../../../apps/${app}/next.config.ts`, import.meta.url)
      ),
      "utf8"
    ),
  }));

  it.each(configs)("$app transpiles the Sentry SDK", ({ source }) => {
    expect(source).toContain("...SENTRY_TRANSPILE_PACKAGES");
  });

  it.each(configs)("$app adds no Sentry trace includes", ({ source }) => {
    expect(source).not.toMatch(SENTRY_INCLUDE_GLOB);
  });
});
