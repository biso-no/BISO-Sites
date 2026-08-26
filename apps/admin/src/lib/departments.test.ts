import { describe, expect, test } from "bun:test";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";
import { uniqueUnitSlug, unitSlug } from "./departments";

describe("unitSlug", () => {
  test("strips the campus prefix so all campuses share one slug", () => {
    expect(unitSlug("OSL Fadderullan")).toBe("fadderullan");
    expect(unitSlug("BRG Fadderullan")).toBe("fadderullan");
    expect(unitSlug("TRD Fadderullan")).toBe("fadderullan");
    expect(unitSlug("STV Fadderullan")).toBe("fadderullan");
  });

  test("folds Norwegian characters using the existing convention", () => {
    expect(unitSlug("BRG Næringsliv")).toBe("naeringsliv");
    expect(unitSlug("TRD Økonomi")).toBe("okonomi");
    expect(unitSlug("OSL Påvirkning")).toBe("pavirkning");
  });

  test("hyphenates multi-word names and collapses punctuation runs", () => {
    expect(unitSlug("TRD Sosialt Utvalg")).toBe("sosialt-utvalg");
    expect(unitSlug("OSL DIGI-KOMM - Digital")).toBe("digi-komm-digital");
  });

  test("drops the nedlagt suffix carried by closed units", () => {
    expect(unitSlug("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "dataanalytisk-utvalg"
    );
  });

  test("leaves unprefixed national names alone", () => {
    expect(unitSlug("Sentralt utvalg")).toBe("sentralt-utvalg");
  });

  test("never returns an empty slug", () => {
    expect(unitSlug("!!!")).toBe("unit");
    expect(unitSlug("")).toBe("unit");
  });
});

describe("uniqueUnitSlug", () => {
  test("returns the base when free", () => {
    expect(uniqueUnitSlug("fadderullan", new Set())).toBe("fadderullan");
  });

  test("suffixes from 2 upward on collision", () => {
    expect(uniqueUnitSlug("fadderullan", new Set(["fadderullan"]))).toBe(
      "fadderullan-2"
    );
    expect(
      uniqueUnitSlug("fadderullan", new Set(["fadderullan", "fadderullan-2"]))
    ).toBe("fadderullan-3");
  });
});

describe("campus table drift guard", () => {
  test("unit-urls campus ids match campus-constants", () => {
    expect(Object.keys(CAMPUS_SEGMENTS).sort()).toEqual(
      Object.values(CAMPUS_NAME_TO_ID).sort()
    );
  });

  test("unit-urls campus labels match campus-constants names", () => {
    for (const [id, entry] of Object.entries(CAMPUS_SEGMENTS)) {
      expect(entry.label).toBe(CAMPUS_ID_TO_NAME[id] as string);
    }
  });
});
