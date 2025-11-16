import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX({
  configPath: '.next/source.config.ts', // <-- Add .next/ prefix
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);