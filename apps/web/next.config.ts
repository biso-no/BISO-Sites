import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import path from "path";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const baseConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,

  transpilePackages: [],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "appwrite.biso.no",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "biso.no",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Point file tracing to the monorepo root to avoid lockfile root warnings
  outputFileTracingRoot: path.join(__dirname, "..", ".."),

  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      // Disable source maps in production to reduce memory usage
      config.devtool = false;
    }
    // Avoid polyfilling large Node modules in client bundles
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
      canvas: false,
      buffer: false,
      stream: false,
      zlib: false,
    };
    
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "pdfjs-dist/legacy": false,
        "pdfjs-dist/build/pdf.worker": false,
      };
    }

    if (isServer) {
      const heavyPkgs = [
        'pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf.mjs',
        'tesseract.js',
        'jimp',
        'mammoth',
        'jszip',
        'xml2js',
        '@react-pdf/renderer',
        'xlsx',
        '@microsoft/microsoft-graph-client',
        '@azure/msal-node',
        '@pinecone-database/pinecone',
        'gpt-tokenizer',
      ];
      const originalExternals = config.externals || [];
      config.externals = [
        ...originalExternals,
        ({ request }: { request?: string }, callback: (err?: any, result?: any) => void) => {
          if (request && heavyPkgs.some((name) => request === name || request.startsWith(name))) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }
    return config;
  },

  experimental: {
    optimizePackageImports: [],
  },
  // No framework-level redirects at this time (user preference)
};


export default withNextIntl(baseConfig);
