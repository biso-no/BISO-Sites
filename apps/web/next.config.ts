import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

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
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  output: "standalone",
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
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // No framework-level redirects at this time (user preference)
};

export default withNextIntl(baseConfig);
