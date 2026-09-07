import { describe, expect, test } from "bun:test";
import { GRID_COLUMNS } from "./block-grid";

describe("BlockGrid columns", () => {
  test("maps each supported count to complete static classes", () => {
    expect(Object.keys(GRID_COLUMNS).sort()).toEqual(["2", "3", "4"]);
    for (const value of Object.values(GRID_COLUMNS)) {
      expect(value).toContain("grid-cols-1");
      expect(value).not.toContain("${");
    }
  });

  test("collapses on phones and expands at breakpoints", () => {
    expect(GRID_COLUMNS[2]).toBe("grid-cols-1 sm:grid-cols-2");
    expect(GRID_COLUMNS[3]).toBe("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3");
    expect(GRID_COLUMNS[4]).toBe("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
  });
});
