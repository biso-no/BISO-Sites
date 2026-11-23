import { Meilisearch } from "meilisearch";

export function createSearchClient(
  host: string | undefined,
  apiKey: string | undefined,
  options?: { timeout?: number }
): Meilisearch {
  if (!host) {
    throw new Error("MEILISEARCH_HOST is not configured");
  }
  if (!apiKey) {
    throw new Error("Meilisearch API key is not configured");
  }
  return new Meilisearch({ host, apiKey, timeout: options?.timeout });
}
