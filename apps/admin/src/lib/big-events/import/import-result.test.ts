import { describe, expect, test } from "bun:test";
import { type ImportResult, saveOutcome } from "./import-result";

const result = (overrides: Partial<ImportResult>): ImportResult => ({
  complete: true,
  created: 1,
  failed: 0,
  linked: 0,
  moved: 0,
  newGroups: 0,
  outsideYourCampus: 0,
  placed: 0,
  skipped: 0,
  suggested: 0,
  unchanged: 0,
  updated: 0,
  written: 1,
  ...overrides,
});

describe("saveOutcome", () => {
  test("a complete save is saved", () => {
    expect(saveOutcome(result({}))).toBe("saved");
  });

  test("a save that wrote nothing changed nothing, so the wizard stays", () => {
    expect(
      saveOutcome(result({ complete: false, failed: 0, written: 0 }))
    ).toBe("nothing_changed");
    expect(
      saveOutcome(result({ complete: false, failed: 3, written: 0 }))
    ).toBe("nothing_changed");
  });

  test("a save that wrote some rows is partly saved", () => {
    expect(
      saveOutcome(result({ complete: false, failed: 1, written: 2 }))
    ).toBe("partly_saved");
  });

  test("a call that failed may have written anything", () => {
    expect(saveOutcome(null)).toBe("partly_saved");
  });
});
