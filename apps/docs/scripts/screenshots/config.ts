import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/**
 * Settings for the screenshot scripts. They only ever talk to a docs-only
 * Appwrite project, never to production.
 */
export interface ScreenshotConfig {
  adminUrl: string;
  apiKey: string;
  endpoint: string;
  outDir: string;
  projectId: string;
}

export type Env = Record<string, string | undefined>;

export const DEFAULT_ADMIN_URL = "http://localhost:3001";
/** Relative to the repo root. */
export const DEFAULT_SCREENSHOT_DIR = "apps/docs/public/screenshots";

export const REPO_ROOT = join(import.meta.dir, "../../../..");

/**
 * Env vars the apps read their Appwrite project from. If the docs project
 * equals one of them, the shell is set up for an app, not for a screenshot
 * run, and going on could write seed data where it doesn't belong.
 */
const APP_PROJECT_ENV_KEYS = [
  "APPWRITE_PROJECT_ID",
  "NEXT_PUBLIC_APPWRITE_PROJECT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
] as const;

const PRODUCTION_HOST = "biso.no";

/** The production project id, from the checked-in Appwrite schema. */
export function readProductionProjectId(): string {
  const config = JSON.parse(
    readFileSync(join(REPO_ROOT, "packages/api/appwrite.config.json"), "utf8")
  ) as { projectId?: unknown };
  if (typeof config.projectId !== "string" || config.projectId.length === 0) {
    throw new Error(
      "Could not read projectId from packages/api/appwrite.config.json, so the production guard can't run. Refusing to go on."
    );
  }
  return config.projectId;
}

/**
 * Project ids compared the way a person would read them: trimmed and
 * case-insensitive, so a different case or stray spaces can't slip past the
 * guard.
 */
function sameProject(a: string | undefined, b: string): boolean {
  return a?.trim().toLowerCase() === b.trim().toLowerCase();
}

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(
      `${key} is not set. See apps/docs/scripts/screenshots/README.md.`
    );
  }
  return value;
}

function readAdminUrl(env: Env): string {
  const raw = env.DOCS_ADMIN_URL?.trim() || DEFAULT_ADMIN_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`DOCS_ADMIN_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("DOCS_ADMIN_URL must be an http or https URL.");
  }
  const host = url.hostname.toLowerCase();
  if (host === PRODUCTION_HOST || host.endsWith(`.${PRODUCTION_HOST}`)) {
    throw new Error(
      "DOCS_ADMIN_URL points at the production domain. Run the admin locally against the docs project instead."
    );
  }
  return raw;
}

/**
 * The docs project's id, checked against production. Throws when it is
 * missing, when it is the production project, or when it equals the project
 * the apps are set up with in this shell.
 */
function readDocsProjectId(env: Env): string {
  const projectId = required(env, "DOCS_APPWRITE_PROJECT");

  if (sameProject(projectId, readProductionProjectId())) {
    throw new Error(
      "DOCS_APPWRITE_PROJECT is the production project. The screenshot scripts only run against a docs-only project. Refusing to go on."
    );
  }
  for (const key of APP_PROJECT_ENV_KEYS) {
    if (sameProject(env[key], projectId)) {
      throw new Error(
        `DOCS_APPWRITE_PROJECT equals ${key}. Run the scripts from a shell that isn't set up for an app. Refusing to go on.`
      );
    }
  }
  return projectId;
}

/** Where `schema.ts` points the schema copy. It needs no API key. */
export interface SchemaConfig {
  endpoint: string;
  projectId: string;
}

/**
 * Reads and checks the settings `schema.ts` needs: the endpoint and the docs
 * project, with the same production guard as `readScreenshotConfig`. The key
 * isn't read, because the schema step runs before the key exists.
 */
export function readSchemaConfig(env: Env): SchemaConfig {
  const projectId = readDocsProjectId(env);
  return { endpoint: required(env, "DOCS_APPWRITE_ENDPOINT"), projectId };
}

/**
 * Reads and checks the screenshot settings. Pass the shell's env as it was
 * before anything changed it, so the guard sees the developer's real settings.
 *
 * Throws when a required value is missing, when the docs project is the
 * production project, or when it equals the project or key the apps are set
 * up with in this shell.
 */
export function readScreenshotConfig(env: Env): ScreenshotConfig {
  const projectId = readDocsProjectId(env);

  const endpoint = required(env, "DOCS_APPWRITE_ENDPOINT");
  const apiKey = required(env, "DOCS_APPWRITE_API_KEY");
  if (env.APPWRITE_API_KEY?.trim() === apiKey) {
    throw new Error(
      "DOCS_APPWRITE_API_KEY equals APPWRITE_API_KEY. Use a key made in the docs project, from a shell that isn't set up for an app. Refusing to go on."
    );
  }

  return {
    adminUrl: readAdminUrl(env),
    apiKey,
    endpoint,
    outDir: env.DOCS_SCREENSHOT_DIR?.trim() || DEFAULT_SCREENSHOT_DIR,
    projectId,
  };
}

/** The screenshot folder as an absolute path. A relative one is read from the repo root. */
export function resolveOutDir(config: ScreenshotConfig): string {
  return resolve(REPO_ROOT, config.outDir);
}

/**
 * Where a shot is saved: `<outDir>/<id>.png`. Throws for any id that would
 * land outside `outDir`.
 */
export function screenshotFile(outDir: string, id: string): string {
  const root = resolve(outDir);
  const file = resolve(root, `${id}.png`);
  if (!file.startsWith(`${root}${sep}`)) {
    throw new Error(`Shot id "${id}" would be saved outside ${root}.`);
  }
  return file;
}

/**
 * The env `@repo/api/server` reads its endpoint, project and key from, pointed
 * at the docs project. `undefined` means "remove": the function key would
 * otherwise be a second way in.
 */
export function docsSdkEnv(config: ScreenshotConfig): Env {
  return {
    APPWRITE_API_KEY: config.apiKey,
    APPWRITE_ENDPOINT: config.endpoint,
    APPWRITE_FUNCTION_API_KEY: undefined,
    APPWRITE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_APPWRITE_ENDPOINT: config.endpoint,
    NEXT_PUBLIC_APPWRITE_PROJECT: config.projectId,
  };
}
