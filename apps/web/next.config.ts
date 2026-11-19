import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// Relative, not `@repo/observability/build`: Next transpiles this file with
// tsconfig `paths`, which maps `@repo/*` to `../../packages/*` and misses the
// package `exports` (the source lives under `src/`).
import { sentryBuildOptions } from "../../packages/observability/src/build";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
    "@repo/typescript-config",
  ],
  // pdfjs (CV text extraction for AI screening) loads its worker via a
  // relative `./pdf.worker.mjs` import that breaks once bundled.
  serverExternalPackages: ["pdfjs-dist"],
  reactStrictMode: true,
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
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Optimized images are re-fetched from origin (appwrite.biso.no storage —
    // the same worker pool that serves SSR) whenever the optimizer cache
    // expires. A day-long TTL keeps cold-start / post-deploy image traffic
    // from amplifying into Appwrite; content images are replaced by uploading
    // new files (new URLs), not by mutating existing ones.
    minimumCacheTTL: 86_400,
    // Next 16 requires every quality used by <Image quality={…}> to be
    // declared (hero uses 85; 75 is the default).
    qualities: [75, 85],
    // Next's optimizer 400s any .svg source by default (XSS risk from
    // untrusted SVGs). Our SVGs are trusted static files under public/images
    // (brand marks, payment-provider logos), never user-uploaded — allow them
    // through, with the CSP Next recommends for this flag as defense in depth.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
        protocol: "https",
        hostname: "via.placeholder.com",
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

  experimental: {
    authInterrupts: true,
    hideLogsAfterAbort: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Renaming `/bi-fondet` → `/okonomisk-stotte` is the only reason this block
  // exists; the rest of the WordPress → app mappings in
  // `docs/public-site-parity.md` are still handled outside the framework.
  // `redirects()` emits 308 Permanent, which is SEO-equivalent to a 301.
  redirects() {
    return Promise.resolve([
      {
        // The BI "link your account" page is gone; the mobile app and old
        // emails may still open it. The join page offers the BI sign-in.
        source: "/membership/link",
        destination: "/membership/join",
        permanent: true,
      },
      {
        source: "/bi-fondet",
        destination: "/okonomisk-stotte",
        permanent: true,
      },
      {
        // The legacy WordPress URL, which still receives inbound links.
        source: "/sok-okonomisk-stotte",
        destination: "/okonomisk-stotte",
        permanent: true,
      },
    ]);
  },
  // biome-ignore lint/suspicious/useAwait: Needs this for proper BISO App redirect on authentication
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
    ];
  },

  // biome-ignore lint/suspicious/useAwait: Rewrite to the Apple App Site Association API route, which returns the JSON file for iOS Universal Links.
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/aasa",
      },
    ];
  },
};

// Sentry's wrapper goes outermost. It turns on browser source maps for the
// upload and deletes them from the output afterwards.
export default withSentryConfig(
  withNextIntl(baseConfig),
  sentryBuildOptions("web")
);
