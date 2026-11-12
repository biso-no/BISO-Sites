import "server-only";

const TRAILING_SLASHES = /\/+$/;

export type ExpensesApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Calls an internal expenses route on the api service, server to server, with
 * the shared secret. Never throws: a missing setting, a network failure or an
 * error response all come back as `{ ok: false, error }`.
 */
export async function callExpensesApi<T>(
  path: string,
  body: unknown
): Promise<ExpensesApiResult<T>> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!base) {
    return { ok: false, error: "NEXT_PUBLIC_API_BASE_URL is not configured" };
  }
  if (!secret) {
    return { ok: false, error: "CRON_SECRET is not configured" };
  }

  let response: Response;
  try {
    response = await fetch(`${base.replace(TRAILING_SLASHES, "")}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }

  const json = (await response.json().catch(() => null)) as
    | (T & { error?: unknown })
    | null;
  if (!response.ok) {
    const message =
      typeof json?.error === "string" && json.error
        ? json.error
        : response.statusText || `Request failed (${response.status})`;
    return { ok: false, error: message };
  }
  return { ok: true, data: json as T };
}
