import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyResult,
  paginationQueries,
  parseListParams,
} from "./list-params";

describe("parseListParams", () => {
  test("defaults when nothing is supplied", () => {
    expect(parseListParams({})).toEqual({
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      q: "",
    });
  });

  test("reads a valid page, size and query", () => {
    expect(parseListParams({ page: "3", size: "50", q: " oslo " })).toEqual({
      page: 3,
      size: 50,
      q: "oslo",
    });
  });

  test("clamps junk page values to 1", () => {
    for (const page of ["0", "-4", "abc", "", "1.9e9999"]) {
      expect(parseListParams({ page }).page).toBeGreaterThanOrEqual(1);
    }
    expect(parseListParams({ page: "abc" }).page).toBe(1);
    expect(parseListParams({ page: "-4" }).page).toBe(1);
    expect(parseListParams({ page: "2.7" }).page).toBe(2);
  });

  test("rejects a size outside PAGE_SIZES", () => {
    expect(parseListParams({ size: "9999" }).size).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams({ size: "0" }).size).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams({ size: "100" }).size).toBe(100);
  });

  test("takes the first value when Next.js supplies an array", () => {
    expect(parseListParams({ page: ["2", "5"] }).page).toBe(2);
  });

  test("supports an alternate page key for a second table on one route", () => {
    const params = parseListParams(
      { page: "2", opage: "7" },
      { pageKey: "opage" }
    );
    expect(params.page).toBe(7);
  });
});

describe("paginationQueries", () => {
  test("produces limit and offset for page 1", () => {
    expect(paginationQueries({ page: 1, size: 25, q: "" })).toEqual([
      Query.limit(25),
      Query.offset(0),
    ]);
  });

  test("offsets by (page - 1) * size", () => {
    expect(paginationQueries({ page: 4, size: 50, q: "" })).toEqual([
      Query.limit(50),
      Query.offset(150),
    ]);
  });
});

describe("emptyResult", () => {
  test("preserves the requested page and size", () => {
    expect(emptyResult({ page: 3, size: 50, q: "x" })).toEqual({
      rows: [],
      total: 0,
      page: 3,
      size: 50,
    });
  });
});
