import { createFakeSource } from "./fake";
import { createInfisicalSource } from "./infisical";
import type { PrivateEnv, PrivateValueSource } from "./types";

export {
  type PrivateEnv,
  PrivateSourceUnavailable,
  type PrivateValueSource,
} from "./types";

export const INFISICAL_ENV_VARS = [
  "INFISICAL_SITE_URL",
  "INFISICAL_CLIENT_ID",
  "INFISICAL_CLIENT_SECRET",
  "INFISICAL_PROJECT_ID",
  "INFISICAL_ENVIRONMENT",
  "INFISICAL_SECRET_PATH",
] as const;

export function getPrivateSource(env: PrivateEnv): PrivateValueSource | null {
  const choice = (env.DOCS_PRIVATE_SOURCE ?? "none").trim() || "none";
  if (choice === "none") {
    return null;
  }
  if (choice === "fake") {
    if (env.NODE_ENV === "production" && env.DOCS_PRIVATE_ALLOW_FAKE !== "1") {
      throw new Error(
        "DOCS_PRIVATE_SOURCE=fake is refused in production unless DOCS_PRIVATE_ALLOW_FAKE=1"
      );
    }
    if (!env.DOCS_PRIVATE_FAKE_FILE) {
      throw new Error(
        "DOCS_PRIVATE_SOURCE=fake requires DOCS_PRIVATE_FAKE_FILE"
      );
    }
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
