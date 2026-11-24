import { createSearchClient } from "@repo/shared/search/client";
import type { SearchRunner } from "@repo/shared/search/query";
import { searchIndexName } from "@repo/shared/search/settings";
import type { SearchEntry } from "@repo/shared/search/types";
import type { MultiSearchParams } from "meilisearch";

interface ConfiguredSearch {
  indexName: string;
  runner: SearchRunner;
}

/** Milliseconds before a Meilisearch request is abandoned (no default exists). */
export const SEARCH_TIMEOUT_MS = 4000;

let cached: { key: string; value: ConfiguredSearch } | null = null;

/**
 * The Meilisearch runner for this process, built from the search-only key.
 * Null when the host or key is missing. The client is created once and reused
 * while the settings stay the same.
 */
export function searchRunnerFromEnv(
  env: Record<string, string | undefined> = process.env
): ConfiguredSearch | null {
  const host = env.MEILISEARCH_HOST;
  const apiKey = env.MEILISEARCH_SEARCH_KEY;
  if (!(host && apiKey)) {
    return null;
  }
  const indexName = searchIndexName(env);
  const key = `${host}|${apiKey}|${indexName}|${SEARCH_TIMEOUT_MS}`;
  if (cached?.key === key) {
    return cached.value;
  }
  const client = createSearchClient(host, apiKey, {
    timeout: SEARCH_TIMEOUT_MS,
  });
  const value: ConfiguredSearch = {
    indexName,
    runner: {
      multiSearch: async (queries) => {
        const { results } = await client.multiSearch<
          MultiSearchParams,
          SearchEntry
        >({ queries });
        return results;
      },
    },
  };
  cached = { key, value };
  return value;
}
