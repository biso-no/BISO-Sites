import type {
  SearchOptions,
  SearchResult,
  SearchIndex,
  SearchApiResponse,
} from "./search/types";

export type { SearchResult, SearchIndex, SearchOptions } from "./search/types";

export const DEFAULT_SEARCH_INDICES: SearchIndex[] = [
  "jobs",
  "events",
  "news",
];

const DEFAULT_LIMIT = 10;

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/search";
  }

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) {
    throw new Error(
      "Missing NEXT_PUBLIC_APP_URL or APP_URL environment variable for server-side search requests.",
    );
  }

  const base = candidates[0].replace(/\/$/, "");
  return `${base}/api/search`;
}

/**
 * Execute the search request against the internal API.
 * Falls back to safe defaults when the query is empty.
 */
export async function search(
  options: SearchOptions,
): Promise<SearchResult[]> {
  const {
    query,
    indices = DEFAULT_SEARCH_INDICES,
    limit = DEFAULT_LIMIT,
    offset = 0,
  } = options;

  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    return [];
  }

  const payload = {
    query: trimmedQuery,
    indices: Array.from(new Set(indices)),
    limit,
    offset,
  };

  try {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(
        "Search request failed:",
        response.status,
        response.statusText,
        errorMessage,
      );
      return [];
    }

    const data = (await response.json()) as SearchApiResponse;

    if (!Array.isArray(data.results)) {
      return [];
    }

    return data.results;
  } catch (error) {
    console.error("Search request error:", error);
    return [];
  }
}
