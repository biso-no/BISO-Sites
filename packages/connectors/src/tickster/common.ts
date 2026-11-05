/** Code shared by the Tickster CRM and Event API clients. */

/** A trimmed non-empty string, a number as text, or null. */
export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

/**
 * GETs `url` as JSON with the API key in `authHeader`, aborting after
 * `timeoutMs`. A non-2xx answer throws "<label> responded <status> <text>".
 */
export async function fetchTicksterJson(options: {
  apiKey: string;
  authHeader: string;
  fetcher: typeof fetch;
  label: string;
  timeoutMs: number;
  url: string;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetcher(options.url, {
      headers: {
        [options.authHeader]: options.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `${options.label} responded ${response.status} ${response.statusText}`
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
