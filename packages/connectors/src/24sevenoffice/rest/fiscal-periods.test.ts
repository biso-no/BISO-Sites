import { describe, expect, test } from "bun:test";
import { toFiscalPeriods } from "./fiscal-periods";

describe("toFiscalPeriods", () => {
  test("keeps monthly periods only, sorted", () => {
    expect(
      toFiscalPeriods([
        {
          type: "Period",
          startingDate: "2026-11-01",
          endingDate: "2026-11-30",
        },
        { type: "Year", startingDate: "2026-01-01", endingDate: "2026-12-31" },
        {
          type: "Period",
          startingDate: "2026-10-01",
          endingDate: "2026-10-31",
        },
        { type: "Period", startingDate: "2026-12-01" },
      ])
    ).toEqual([
      { startingDate: "2026-10-01", endingDate: "2026-10-31" },
      { startingDate: "2026-11-01", endingDate: "2026-11-30" },
    ]);
  });
});
