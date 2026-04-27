import { createMDX } from "fumadocs-mdx/next";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
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
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withMDX(config);
