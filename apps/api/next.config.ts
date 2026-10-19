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
  // pdfjs (cover-letter/CV text extraction when the app applies for a job)
  // loads its worker via a relative `./pdf.worker.mjs` import that breaks
  // once bundled. Same reason apps/web externalizes it.
  serverExternalPackages: ["tesseract.js", "pdfjs-dist"],
  // Under Node, pdfjs loads that worker with `import(workerSrc)`, a runtime
  // path file tracing cannot follow, so the standalone output would ship
  // pdf.mjs without it and every extraction would fail with "Setting up fake
  // worker failed". Trace it explicitly for the route that extracts PDFs.
  outputFileTracingIncludes: {
    "/api/recruitment/applications": [
      "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
  experimental: {
    authInterrupts: true,
  },
  // No framework-level redirects at this time (user preference)
};

export default baseConfig;
