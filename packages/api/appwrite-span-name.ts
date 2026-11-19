/** Path segments whose next segment is the id of one item. */
const ID_COLLECTIONS: ReadonlySet<string> = new Set([
  "documents",
  "executions",
  "files",
  "memberships",
  "rows",
  "sessions",
  "teams",
  "tokens",
  "users",
]);

/**
 * Appwrite's own route names that sit where an id could (`/account/sessions/
 * current`, `/account/tokens/oauth2/{provider}`, `POST /users/argon2`). They
 * are few, so keeping them keeps the name readable without splitting groups.
 */
const ROUTE_NAMES: ReadonlySet<string> = new Set([
  "anonymous",
  "argon2",
  "bcrypt",
  "buckets",
  "current",
  "email",
  "identities",
  "magic-url",
  "md5",
  "oauth2",
  "phone",
  "phpass",
  "scrypt",
  "scrypt-modified",
  "sha",
  "token",
  "usage",
]);

/**
 * Span name for an Appwrite call, from its `METHOD /path` description: each
 * item id becomes `{id}` so every call to one endpoint groups under one name
 * (`GET /tablesdb/app/tables/events/rows/{id}`). Logs keep the real path.
 */
export function spanNameForAppwriteRequest(request: string): string {
  const [method, path] = request.split(" ");
  if (!path) {
    return request;
  }
  const segments = path.split("/");
  for (let index = 1; index < segments.length; index++) {
    const segment = segments[index];
    const previous = segments[index - 1];
    if (
      segment &&
      previous &&
      ID_COLLECTIONS.has(previous) &&
      !ROUTE_NAMES.has(segment)
    ) {
      segments[index] = "{id}";
    }
  }
  return `${method} ${segments.join("/")}`;
}
