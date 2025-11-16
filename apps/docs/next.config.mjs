import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX({
  configPath: 'source.config.ts',
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
    outputFileTracingIncludes: {
      // Include .source directory in the standalone build
      '/': ['./.source/**/*'],
    },
};

export default withMDX(config);