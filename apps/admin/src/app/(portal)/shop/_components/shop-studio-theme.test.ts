import { describe, expect, test } from "bun:test";
import { fmtDate } from "./shop-studio-theme";

// The date filters bound on the organisation's calendar and the CSV labels its
// rows with it. The table has to agree, or an administrator outside that zone
// reads one date on screen, gets another in the export, and finds the row
// excluded by a range that looks like it should contain it.
describe("fmtDate", () => {
  test("renders an instant in the order calendar, not the viewer's zone", () => {
    // 23:30Z on 31 January is already 1 February in Oslo (UTC+1).
    expect(fmtDate("2026-01-31T23:30:00.000Z", "en")).toBe("1 Feb");
  });

  test("follows the daylight saving offset in force that day", () => {
    // Summer is UTC+2, so 22:30Z has already rolled over.
    expect(fmtDate("2026-07-31T22:30:00.000Z", "en")).toBe("1 Aug");
    expect(fmtDate("2026-07-31T21:30:00.000Z", "en")).toBe("31 Jul");
  });

  test("still guards an unparseable timestamp", () => {
    expect(fmtDate("not-a-date", "en")).toBe("—");
  });
});
