import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// Relative, not `@repo/observability/build`: Next transpiles this file with
// tsconfig `paths`, which maps `@repo/*` to `../../packages/*` and misses the
// package `exports` (the source lives under `src/`).
import { sentryBuildOptions } from "../../packages/observability/src/build";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Pages that open the camera to scan member passes.
const SCANNER_SOURCES = ["/members/scan", "/scan/:path*"];

const baseConfig: NextConfig = {
  transpilePackages: [
    "@repo/api",
    "@repo/i18n",
    "@repo/ui",
    "@repo/connectors",
    "@repo/shared",
    "@repo/ai",
    "@repo/editor",
    "@repo/observability",
    "@repo/payment",
    "@repo/tours",
    "@repo/typescript-config",
  ],
  reactStrictMode: true,
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "appwrite.biso.no",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "biso.no",
        port: "",
        pathname: "/**",
      },
      {
        // Cover images for events mirrored from Tickster.
        protocol: "https",
        hostname: "static.tickster.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // biome-ignore lint/suspicious/useAwait: Next.js requires redirects() to be async.
  async redirects() {
    // Old top-level routes that moved during the nav restructure. Permanent
    // so bookmarks and the assistant's old navigation targets keep working.
    return [
      {
        destination: "/settings/operations",
        permanent: true,
        source: "/operations",
      },
      {
        destination: "/settings/feature-flags",
        permanent: true,
        source: "/feature-flags",
      },
      {
        destination: "/settings/payments",
        permanent: true,
        source: "/payment-settings",
      },
      {
        destination: "/inbox/approvals",
        permanent: true,
        source: "/approvals",
      },
      {
        destination: "/inbox/submissions",
        permanent: true,
        source: "/submissions",
      },
      {
        destination: "/inbox/submissions/:topic",
        permanent: true,
        source: "/submissions/:topic",
      },
    ];
  },

  // biome-ignore lint/suspicious/useAwait: Next.js requires headers() to be async.
  async headers() {
    // Baseline hardening for an internal CMS. A Content-Security-Policy is
    // intentionally omitted for now — it needs per-route nonces to avoid
    // breaking Next's inline runtime scripts — and is tracked as follow-up.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Lets the browser profile this page for Sentry (Chromium only).
          { key: "Document-Policy", value: "js-profiling" },
        ],
      },
      // The member pass scanners need the camera. When two rules set the
      // same key, Next applies the last one, so these must stay after the
      // catch-all above.
      ...SCANNER_SOURCES.map((source) => ({
        source,
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      })),
    ];
  },

  experimental: {
    serverActions: {
      // 4 MB covers the largest legitimate page editor payload. Image
      // uploads have their own 10 MB cap enforced in uploadMediaFile and
      // /api/upload; leaving the global ceiling lower limits abuse via
      // other server actions.
      bodySizeLimit: "4mb",
    },
    authInterrupts: true,
  },
};

// Sentry's wrapper goes outermost. It turns on browser source maps for the
// upload and deletes them from the output afterwards.
export default withSentryConfig(
  withNextIntl(baseConfig),
  sentryBuildOptions("admin")
);
