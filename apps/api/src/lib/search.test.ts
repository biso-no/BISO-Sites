import { beforeEach, describe, expect, it, vi } from "vitest";

const createSearchClient = vi.hoisted(() =>
  vi.fn(() => ({ multiSearch: vi.fn() }))
);

vi.mock("@repo/shared/search/client", () => ({ createSearchClient }));

import { SEARCH_TIMEOUT_MS, searchRunnerFromEnv } from "./search";

describe("searchRunnerFromEnv", () => {
  beforeEach(() => {
    createSearchClient.mockClear();
  });

  it("builds the client with a 4 second timeout", () => {
    const result = searchRunnerFromEnv({
      MEILISEARCH_HOST: "https://search.example",
      MEILISEARCH_SEARCH_KEY: "search-key",
    });
    expect(result).not.toBeNull();
    expect(SEARCH_TIMEOUT_MS).toBe(4000);
    expect(createSearchClient).toHaveBeenCalledWith(
      "https://search.example",
      "search-key",
      { timeout: 4000 }
    );
  });

  it("is null without host or key", () => {
    expect(searchRunnerFromEnv({})).toBeNull();
  });
});
