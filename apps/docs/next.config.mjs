import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX({
  configPath: "next.config.source.ts", // <-- Updated path
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
};

export default withMDX(config);
