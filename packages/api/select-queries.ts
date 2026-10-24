/**
 * Request-shaping helpers for the server clients in `server.ts`.
 *
 * Kept out of that file: it is a `"use server"` module, where every export
 * must be an async Server Action.
 */

interface SelectQuery {
  method: "select";
  values: unknown[];
}

function isSelectQuery(value: unknown): value is SelectQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { method?: unknown }).method === "select" &&
    Array.isArray((value as { values?: unknown }).values)
  );
}

/**
 * De-duplicate the attributes of every `select` in a request's `queries`.
 *
 * Appwrite rejects a select that names an attribute twice — "Invalid query:
 * Duplicate attributes selected" — and fails the whole read. Select lists are
 * assembled from shared constants plus per-call fields, and a merge where both
 * sides add the same column produces exactly that, invisibly in review. A
 * select is a set, so dropping a repeat changes nothing about the result:
 * this keeps first-seen order and leaves every other query byte for byte.
 */
export function withUniqueSelects<T>(params: T): T {
  const queries = (params as { queries?: unknown } | undefined)?.queries;
  if (!Array.isArray(queries)) {
    return params;
  }

  let changed = false;
  const next = queries.map((query) => {
    if (typeof query !== "string" || !query.includes('"select"')) {
      return query;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(query);
    } catch {
      return query;
    }
    if (!isSelectQuery(parsed)) {
      return query;
    }
    const unique = [...new Set(parsed.values)];
    if (unique.length === parsed.values.length) {
      return query;
    }
    changed = true;
    return JSON.stringify({ ...parsed, values: unique });
  });

  return changed ? { ...params, queries: next } : params;
}
