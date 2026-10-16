import { describe, expect, it } from "vitest";
import {
  emptyWebResult,
  parseWebListParams,
  SEARCH_CANDIDATE_CAP,
  WEB_PAGE_SIZE,
  webOffset,
} from "./list-params";

describe("web list params", () => {
  it("pages by 12 so both the 2-col and 3-col grids fill evenly", () => {
    expect(WEB_PAGE_SIZE).toBe(12);
    expect(SEARCH_CANDIDATE_CAP).toBe(500);
  });

  it("defaults to page 1 with an empty query", () => {
    expect(parseWebListParams({})).toEqual({ page: 1, q: "" });
  });

  it("clamps junk in the address bar to page 1 rather than throwing", () => {
    expect(parseWebListParams({ page: "abc" }).page).toBe(1);
    expect(parseWebListParams({ page: "0" }).page).toBe(1);
    expect(parseWebListParams({ page: "-3" }).page).toBe(1);
    expect(parseWebListParams({ page: "2.7" }).page).toBe(2);
  });

  it("clamps a page past the offset ceiling before anything is fetched", () => {
    // Carrying ?page=99999 forward would report a page it never fetched.
    expect(parseWebListParams({ page: "99999" }).page).toBe(417);
  });

  it("trims the search term and takes the first of a repeated key", () => {
    expect(parseWebListParams({ q: "  hello  " }).q).toBe("hello");
    expect(parseWebListParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("converts a 1-based page to a 0-based Appwrite offset", () => {
    expect(webOffset(1)).toBe(0);
    expect(webOffset(3)).toBe(24);
  });

  it("builds an empty result that is not capped", () => {
    expect(emptyWebResult(2)).toEqual({
      rows: [],
      total: 0,
      page: 2,
      size: 12,
      capped: false,
    });
  });
});
