import { execFileSync } from "node:child_process";
import type { SentryApp } from "./options";

const SENTRY_ORG = "bi-student-organisation";
const SHA_LENGTH = 12;

export const readGitSha = (): string | undefined => {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return sha || undefined;
  } catch {
    return;
  }
};

export const resolveRelease = (
  app: SentryApp,
  env: Record<string, string | undefined> = process.env,
  gitSha: () => string | undefined = readGitSha
): string | undefined => {
  const explicit = env.SENTRY_RELEASE?.trim();
  if (explicit) {
    return explicit;
  }
  const sha = env.APPWRITE_VCS_COMMIT_HASH?.trim() || gitSha();
  return sha ? `biso-${app}@${sha.slice(0, SHA_LENGTH)}` : undefined;
};

/**
 * Goes into every app's `transpilePackages`, so `next build` bundles the
 * server SDK whether it runs under Bun or Node.
 *
 * Otherwise, on a Bun build, `withSentryConfig` keeps `@sentry/nextjs`
 * external so Bun can load its `bun` entry at run time. File tracing leaves
 * that entry out of the standalone output, and adding it back with
 * `outputFileTracingIncludes` broke the build: Next 16.3's Turbopack matches
 * include globs anywhere in a path, so it searched all of `node_modules`,
 * followed the workspace links into the other apps' `.next/standalone`
 * folders and copied their copies of the SDK. Each build nested them one
 * level deeper (81 GB of output and a 28-minute web build).
 *
 * Bundled, the server runs the SDK's Node entry on Bun, as a Node-built
 * deploy already does. Errors, request spans, releases, source maps and the
 * relay work the same. Lost on Bun: the spans and breadcrumbs for outbound
 * `fetch` that the Bun entry adds (Appwrite and AI calls keep their manual
 * spans), and events report `runtime.name: node`. Next 16.4 matches include
 * globs from the root only, so the Bun entry can come back after an upgrade.
 */
export const SENTRY_TRANSPILE_PACKAGES = ["@sentry/nextjs"];

export const sentryBuildOptions = (app: SentryApp) => {
  const release = resolveRelease(app);
  return {
    org: SENTRY_ORG,
    project: `biso-${app}`,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.SENTRY_DEBUG_BUILD,
    telemetry: false,
    widenClientFileUpload: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    release: { name: release },
    // Strips the SDK's own debug logging (not Sentry Logs) from every bundle.
    bundleSizeOptimizations: { excludeDebugStatements: true },
    errorHandler: (err: Error): void => {
      console.warn("[sentry] source map upload failed", err.message);
    },
  };
};
