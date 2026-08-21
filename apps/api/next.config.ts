import path from "node:path";
import type { NextConfig } from "next";

const baseConfig: NextConfig = {
  transpilePackages: [
    "@repo/api",
    "@repo/i18n",
    "@repo/ui",
    "@repo/connectors",
    "@repo/shared",
    "@repo/ai",
    "@repo/payment",
    "@repo/typescript-config",
  ],
  reactStrictMode: false,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["tesseract.js"],
  // biome-ignore lint/suspicious/useAwait: Next.js requires headers() to be async.
  async headers() {
    // This service returns JSON to the web and mobile clients and is never
    // rendered as a document, so it can be locked down harder than the two UI
    // apps. These are additive: per-request CORS headers are still set by
    // `applyCorsHeaders`, which this does not touch.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; default-src 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default baseConfig;
