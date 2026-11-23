import { describe, expect, it } from "vitest";
import { parseSearchPageParams, searchPageHref } from "./page-params";

describe("parseSearchPageParams", () => {
  it("trims, drops unknown types and clamps the page", () => {
    expect(
      parseSearchPageParams({
        q: "  winter ",
        type: "foo",
        page: "-2",
        only: "1",
      })
    ).toEqual({ q: "winter", group: null, page: 1, onlyCampus: true });
  });

  it("takes the first value of a repeated parameter and keeps a known type", () => {
    expect(
      parseSearchPageParams({ q: ["a", "b"], type: "job", page: "3" })
    ).toEqual({ q: "a", group: "job", page: 3, onlyCampus: false });
  });

  it("renders for no parameters at all", () => {
    expect(parseSearchPageParams({})).toEqual({
      q: "",
      group: null,
      page: 1,
      onlyCampus: false,
    });
  });
});

describe("searchPageHref", () => {
  it("orders q, type, only, page and omits page 1", () => {
    expect(searchPageHref({ q: "winter games", group: "job", page: 1 })).toBe(
      "/search?q=winter+games&type=job"
    );
    expect(searchPageHref({ q: "x", page: 3, onlyCampus: true })).toBe(
      "/search?q=x&only=1&page=3"
    );
  });
});
