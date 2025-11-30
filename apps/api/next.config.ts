import type { NextConfig } from "next";


const baseConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
serverExternalPackages: ['tesseract.js'],
  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default baseConfig;
