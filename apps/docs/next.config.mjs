import { createMDX } from "fumadocs-mdx/next";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  standalone: true,
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withMDX(config);
