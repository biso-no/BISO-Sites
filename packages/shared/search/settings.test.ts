import { describe, expect, it } from "vitest";
import { SEARCH_INDEX_SETTINGS, searchIndexName } from "./settings";

describe("search settings", () => {
  it("defaults the index name", () => {
    expect(searchIndexName({})).toBe("site_content");
  });

  it("reads MEILISEARCH_INDEX", () => {
    expect(searchIndexName({ MEILISEARCH_INDEX: "site_content_test" })).toBe(
      "site_content_test"
    );
  });

  it("filters on the sweep and visibility attributes", () => {
    expect(SEARCH_INDEX_SETTINGS.filterableAttributes).toEqual(
      expect.arrayContaining([
        "type",
        "locale",
        "campus_id",
        "row_id",
        "visible_until",
        "synced_at",
      ])
    );
  });
});
