import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
    "@repo/payment",
    "@repo/tours",
    "@repo/typescript-config",
  ],
  serverExternalPackages: ["node-appwrite"],
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  productionBrowserSourceMaps: false,
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
        ],
      },
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

export default withNextIntl(baseConfig);
