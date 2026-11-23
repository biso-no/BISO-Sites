/**
 * Appwrite hands a function its API key per execution, in the
 * `x-appwrite-key` header (scoped by the function's Settings → Scopes). The
 * injected `APPWRITE_FUNCTION_API_KEY` env var only exists at build time, so
 * copy the header there for `createAdminClient()` — which the 24SO connector
 * also calls internally — to pick up.
 */
export function adoptRuntimeApiKey(
  headers: Record<string, string | undefined> | undefined,
  env: Record<string, string | undefined> = process.env
): void {
  const key = headers?.["x-appwrite-key"];
  if (key) {
    env.APPWRITE_FUNCTION_API_KEY = key;
  }
}
