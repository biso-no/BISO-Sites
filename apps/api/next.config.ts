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
  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default baseConfig;
