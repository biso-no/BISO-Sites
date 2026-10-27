import { readFileSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const redirectRules = JSON.parse(
  readFileSync(path.join(__dirname, "redirects.json"), "utf8")
);

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
  redirects() {
    return Promise.resolve(
      redirectRules.map((rule) => ({ ...rule, permanent: false }))
    );
  },
};

export default withMDX(config);
