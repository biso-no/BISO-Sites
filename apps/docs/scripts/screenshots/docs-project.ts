import { docsSdkEnv, type Env, type ScreenshotConfig } from "./config";

type ServerModule = typeof import("@repo/api/server");
export type DocsAdminClient = Awaited<
  ReturnType<ServerModule["createAdminClient"]>
>;

/**
 * Points `@repo/api/server` at the docs project and returns its admin client.
 *
 * `@repo/api` reads its endpoint and project once, when it is first imported,
 * so this sets the env first and only then imports it. Call it after
 * `readScreenshotConfig()` has checked the original env, and never import
 * `@repo/api/server` or `@repo/api/server-env` statically in these scripts.
 * As a last check it reads back what `@repo/api` resolved and stops if that
 * isn't the docs project.
 */
export async function connectToDocsProject(
  config: ScreenshotConfig,
  env: Env = process.env
): Promise<DocsAdminClient> {
  for (const [key, value] of Object.entries(docsSdkEnv(config))) {
    if (value === undefined) {
      Reflect.deleteProperty(env, key);
    } else {
      env[key] = value;
    }
  }

  const serverEnv = await import("@repo/api/server-env");
  const pointsAtDocs =
    serverEnv.APPWRITE_PROJECT === config.projectId &&
    serverEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT === config.endpoint &&
    serverEnv.resolveApiKey() === config.apiKey;
  if (!pointsAtDocs) {
    throw new Error(
      "@repo/api is not pointed at the docs project (it was loaded before the env was switched). Refusing to go on."
    );
  }

  const { createAdminClient } = await import("@repo/api/server");
  return createAdminClient();
}
