import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: true
});

const baseConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
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
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    authInterrupts: true,
  },
};

export default withBundleAnalyzer(withNextIntl(baseConfig));
