import { createFakeSource } from "./fake";
import { createInfisicalSource } from "./infisical";

export interface PrivateValueSource {
  get(names: string[]): Promise<Record<string, string | undefined>>;
}

export class PrivateSourceUnavailable extends Error {
  constructor(message = "The private value source is unavailable") {
    super(message);
    this.name = "PrivateSourceUnavailable";
  }
}

export const INFISICAL_ENV_VARS = [
  "INFISICAL_SITE_URL",
  "INFISICAL_CLIENT_ID",
  "INFISICAL_CLIENT_SECRET",
  "INFISICAL_PROJECT_ID",
  "INFISICAL_ENVIRONMENT",
  "INFISICAL_SECRET_PATH",
] as const;

export type PrivateEnv = Record<string, string | undefined>;

export function getPrivateSource(env: PrivateEnv): PrivateValueSource | null {
  const choice = (env.DOCS_PRIVATE_SOURCE ?? "none").trim() || "none";
  if (choice === "none") {
    return null;
  }
  if (choice === "fake") {
    return createFakeSource(env.DOCS_PRIVATE_FAKE_FILE);
  }
  if (choice === "infisical") {
    const missing = INFISICAL_ENV_VARS.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `DOCS_PRIVATE_SOURCE=infisical requires: ${missing.join(", ")}`
      );
    }
    return createInfisicalSource(env);
  }
  throw new Error(
    `DOCS_PRIVATE_SOURCE must be "infisical", "fake" or "none" (got "${choice}")`
  );
}
