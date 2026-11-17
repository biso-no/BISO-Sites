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
    errorHandler: (err: Error): void => {
      console.warn("[sentry] source map upload failed", err.message);
    },
  };
};
