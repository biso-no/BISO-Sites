import type { NextConfig } from "next";
import path from "node:path";

const baseConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["tesseract.js"],
  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default baseConfig;
