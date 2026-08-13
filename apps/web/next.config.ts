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
