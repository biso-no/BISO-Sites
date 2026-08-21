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
    "@repo/typescript-config",
  ],
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
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

  // biome-ignore lint/suspicious/useAwait: Next.js requires headers() to be async.
  async headers() {
    // Baseline hardening for the public site. This app carries the checkout
    // flow, the reimbursement form (which collects bank account numbers), and
    // sign-in, so the framing and transport controls matter more here than on
    // the CMS. A full Content-Security-Policy is deliberately left out: it
    // needs per-route nonces for Next's inline runtime, and getting it wrong
    // breaks the payment redirects. `frame-ancestors` is the one CSP directive
    // that is safe to ship on its own, and it is the modern replacement for
    // X-Frame-Options (both are sent — older browsers only honour the latter).
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Keeps the expense approval token in `/fs/approve/{token}` out of
          // the Referer header on cross-origin subresource requests.
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
    authInterrupts: true,
    hideLogsAfterAbort: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // No framework-level redirects at this time (user preference)
};

export default withNextIntl(baseConfig);
