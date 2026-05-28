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
  serverExternalPackages: ["node-appwrite"],
  typescript: { ignoreBuildErrors: true },
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
    ],
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
