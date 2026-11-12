import { describe, expect, test } from "bun:test";
import { parseFiscalYears } from "./fiscal-years";

describe("parseFiscalYears", () => {
  test("parses Date and string start dates, sorted, with lock flags", () => {
    expect(
      parseFiscalYears({
        GetFiscalYearsResult: {
          FiscalYear: [
            { StartingDate: "2026-01-01T00:00:00", IsLocked: false },
            {
              StartingDate: new Date("2025-01-01T00:00:00.000Z"),
              IsLocked: true,
            },
            { StartingDate: null, IsLocked: true },
          ],
        },
      })
    ).toEqual([
      { startingDate: "2025-01-01", isLocked: true },
      { startingDate: "2026-01-01", isLocked: false },
    ]);
  });

  test("accepts a single FiscalYear object and an empty result", () => {
    expect(
      parseFiscalYears({
        GetFiscalYearsResult: {
          FiscalYear: { StartingDate: "2026-01-01", IsLocked: "true" },
        },
      })
    ).toEqual([{ startingDate: "2026-01-01", isLocked: true }]);
    expect(parseFiscalYears(null)).toEqual([]);
  });
});
