import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
// Relative, not `@repo/observability/build`: Next transpiles this file with
// tsconfig `paths`, which maps `@repo/*` to `../../packages/*` and misses the
// package `exports` (the source lives under `src/`).
import { sentryBuildOptions } from "../../packages/observability/src/build";

const baseConfig: NextConfig = {
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
  reactStrictMode: false,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  productionBrowserSourceMaps: false,
  // pdfjs (cover-letter/CV text extraction when the app applies for a job)
  // loads its worker via a relative `./pdf.worker.mjs` import that breaks
  // once bundled. Same reason apps/web externalizes it.
  serverExternalPackages: ["tesseract.js", "pdfjs-dist"],
  // Under Node, pdfjs loads that worker with `import(workerSrc)`, a runtime
  // path file tracing cannot follow, so the standalone output would ship
  // pdf.mjs without it and every extraction would fail with "Setting up fake
  // worker failed". Trace it explicitly for the route that extracts PDFs.
  outputFileTracingIncludes: {
    // The Site runs on Bun, which resolves `@sentry/nextjs` through its `bun`
    // export condition. Tracing follows only the `node` condition, so the Bun
    // entry and what it loads would be missing from the standalone output.
    "/*": [
      "../../node_modules/@sentry/nextjs/build/cjs/**/*.js",
      "../../node_modules/@sentry/bun/package.json",
      "../../node_modules/@sentry/bun/build/cjs/**/*.js",
      "../../node_modules/@sentry/server-utils/build/cjs/**/*.js",
    ],
    "/api/recruitment/applications": [
      "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default withSentryConfig(baseConfig, sentryBuildOptions("api"));
