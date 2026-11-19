import { readFileSync } from "node:fs";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
// Relative, not `@repo/observability/build`: Next transpiles this file with
// tsconfig `paths`, which maps `@repo/*` to `../../packages/*` and misses the
// package `exports` (the source lives under `src/`).
import { sentryBuildOptions } from "../../packages/observability/src/build";

const redirectRules = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "redirects.json"), "utf8")
) as { source: string; destination: string }[];

const withMDX = createMDX();

/**
 * No site may frame docs. Private values render inside docs pages after
 * sign-in, so a framing page could otherwise overlay or clickjack them.
 * `frame-ancestors` is the modern control; `X-Frame-Options` covers old
 * browsers.
 */
const NO_FRAMING_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@repo/api",
    "@repo/i18n",
    "@repo/ui",
    "@repo/connectors",
    "@repo/shared",
    "@repo/ai",
    "@repo/observability",
    "@repo/payment",
    "@repo/typescript-config",
  ],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // The Site runs on Bun, which resolves `@sentry/nextjs` through its `bun`
  // export condition. Tracing follows only the `node` condition, so the Bun
  // entry and what it loads would be missing from the standalone output.
  outputFileTracingIncludes: {
    "/*": [
      "../../node_modules/@sentry/nextjs/build/cjs/**/*.js",
      "../../node_modules/@sentry/bun/package.json",
      "../../node_modules/@sentry/bun/build/cjs/**/*.js",
      "../../node_modules/@sentry/server-utils/build/cjs/**/*.js",
    ],
  },
  headers() {
    return Promise.resolve([
      { source: "/:path*", headers: NO_FRAMING_HEADERS },
    ]);
  },
  redirects() {
    return Promise.resolve(
      redirectRules.map((rule) => ({ ...rule, permanent: false }))
    );
  },
};

// Sentry's wrapper goes outermost. It turns on browser source maps for the
// upload and deletes them from the output afterwards.
export default withSentryConfig(withMDX(config), sentryBuildOptions("docs"));
