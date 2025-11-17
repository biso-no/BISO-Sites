import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import path from "path";


const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
    authInterrupts: true
  },
  // No framework-level redirects at this time (user preference)
};


export default withNextIntl(baseConfig);
