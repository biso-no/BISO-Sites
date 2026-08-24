import { describe, expect, test } from "bun:test";
import { accentForDepartment, HUE_COLORS } from "./presets";

const RETIRED_PAPER_PALETTE = ["#6b1e1e", "#b08a3e", "#2f5d3a", "#2a4a7a"];

describe("brand accent palette", () => {
  test("contains no retired paper colour", () => {
    for (const hex of Object.values(HUE_COLORS)) {
      expect(RETIRED_PAPER_PALETTE).not.toContain(hex.toLowerCase());
    }
  });

  test("uses the five approved brand swatches", () => {
    expect(Object.keys(HUE_COLORS).sort()).toEqual([
      "blue",
      "gold",
      "navy",
      "sky",
      "slate",
    ]);
  });

  test("defaults unknown departments to BISO blue", () => {
    expect(accentForDepartment("does-not-exist").toLowerCase()).toBe("#3da9e0");
  });

  test("maps every department to an approved swatch", () => {
    const palette = Object.values(HUE_COLORS).map((hex) => hex.toLowerCase());
    for (const department of [
      "esn",
      "finans",
      "consulting",
      "marketing",
      "invest",
      "hr",
    ]) {
      expect(palette).toContain(accentForDepartment(department).toLowerCase());
    }
  });
});
