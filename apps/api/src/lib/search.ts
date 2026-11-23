import { createSearchClient } from "@repo/shared/search/client";
import type { SearchRunner } from "@repo/shared/search/query";
import { searchIndexName } from "@repo/shared/search/settings";

interface ConfiguredSearch {
  indexName: string;
  runner: SearchRunner;
}

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
  const key = `${host}|${apiKey}|${indexName}`;
  if (cached?.key === key) {
    return cached.value;
  }
  const client = createSearchClient(host, apiKey);
  const value: ConfiguredSearch = {
    indexName,
    runner: {
      multiSearch: async (queries) => {
        const { results } = await client.multiSearch({ queries });
        return results as never;
      },
    },
  };
  cached = { key, value };
  return value;
}
