import { createFakeSource } from "./fake";
import { createInfisicalSource, readInfisicalEnv } from "./infisical";
import type { PrivateEnv, PrivateValueSource } from "./types";

export {
  type PrivateEnv,
  PrivateSourceUnavailable,
  type PrivateValueSource,
} from "./types";

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
    return createInfisicalSource(readInfisicalEnv(env));
  }
  throw new Error(
    `DOCS_PRIVATE_SOURCE must be "infisical", "fake" or "none" (got "${choice}")`
  );
}
