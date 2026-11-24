import { describe, expect, test } from "bun:test";
import { findHeaderRow } from "./header-row";

describe("findHeaderRow", () => {
  test("skips title rows to the row with known aliases", () => {
    expect(
      findHeaderRow([
        ["Kjøperliste"],
        [""],
        ["Navn", "Etternavn", "E-post", "Mobilnr"],
        ["Ola", "N", "o@x.no", "912"],
      ])
    ).toBe(2);
  });

  test("returns -1 for an empty sheet", () => {
    expect(findHeaderRow([])).toBe(-1);
  });

  test("falls back to the first row with two filled cells", () => {
    expect(
      findHeaderRow([
        ["x", "y", "z"],
        ["1", "2", "3"],
      ])
    ).toBe(0);
    expect(findHeaderRow([["title"], ["x", "", "z"]])).toBe(1);
  });
});
