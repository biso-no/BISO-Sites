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

/** Segments after which the next segment is a database, table or bucket id. */
const CONTAINER_WORDS: ReadonlySet<string> = new Set([
  "buckets",
  "collections",
  "databases",
  "tables",
  "tablesdb",
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
  // Decide from the original segments: a segment already replaced by `{id}`
  // must not change what its neighbours are.
  const original = path.split("/");
  const segments = original.map((segment, index) => {
    const previous = original[index - 1];
    const beforePrevious = original[index - 2];
    const previousIsCollection =
      previous !== undefined &&
      ID_COLLECTIONS.has(previous) &&
      !(beforePrevious !== undefined && CONTAINER_WORDS.has(beforePrevious));
    return segment && previousIsCollection && !ROUTE_NAMES.has(segment)
      ? "{id}"
      : segment;
  });
  return `${method} ${segments.join("/")}`;
}
