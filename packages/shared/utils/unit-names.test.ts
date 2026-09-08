import { describe, expect, it } from "vitest";
import {
  extractCampusPrefix,
  isClosedName,
  stripCampusPrefix,
  stripClosedSuffix,
  unitDisplayName,
} from "./unit-names";

describe("extractCampusPrefix", () => {
  it("reads the four campus prefixes", () => {
    expect(extractCampusPrefix("OSL Fadderullan")).toBe("OSL");
    expect(extractCampusPrefix("BRG Case Club")).toBe("BRG");
    expect(extractCampusPrefix("TRD Society")).toBe("TRD");
    expect(extractCampusPrefix("STV Markedsutvalget")).toBe("STV");
  });

  it("is null for national and unprefixed rows", () => {
    expect(extractCampusPrefix("Wintergames")).toBeNull();
    expect(extractCampusPrefix("Alumni")).toBeNull();
  });

  it("does not treat a prefix-like word as a prefix without the space", () => {
    expect(extractCampusPrefix("OSLO Something")).toBeNull();
  });
});

describe("unitDisplayName", () => {
  it("drops the campus prefix, which is shown as its own badge", () => {
    expect(unitDisplayName("OSL Fadderullan")).toBe("Fadderullan");
    expect(unitDisplayName("BRG Økad + Finans")).toBe("Økad + Finans");
  });

  it("preserves casing and diacritics — this is a label, not a key", () => {
    expect(unitDisplayName("OSL Næringslivsutvalget")).toBe(
      "Næringslivsutvalget"
    );
  });

  it("drops the closure marker", () => {
    expect(unitDisplayName("OSL Bathing - nedlagt")).toBe("Bathing");
  });

  it("collapses the double spaces 24SO names sometimes carry", () => {
    expect(unitDisplayName("OSL  Media ")).toBe("Media");
  });

  it("leaves an unprefixed national name alone", () => {
    expect(unitDisplayName("Wintergames")).toBe("Wintergames");
  });

  it("falls back to the original rather than rendering nothing", () => {
    expect(unitDisplayName("OSL")).toBe("OSL");
    expect(unitDisplayName("- nedlagt")).toBe("- nedlagt");
  });

  it("is empty for a missing name", () => {
    expect(unitDisplayName(null)).toBe("");
    expect(unitDisplayName(undefined)).toBe("");
  });
});

describe("closure markers", () => {
  it("detects and strips the 24SO suffix", () => {
    expect(isClosedName("BI-hulen Drift - solgt")).toBe(false);
    expect(isClosedName("OSL Foo - nedlagt")).toBe(true);
    expect(stripClosedSuffix("OSL Foo - nedlagt")).toBe("OSL Foo");
  });
});

describe("stripCampusPrefix", () => {
  it("removes only the leading prefix", () => {
    expect(stripCampusPrefix("OSL OSL Media")).toBe("OSL Media");
  });
});
