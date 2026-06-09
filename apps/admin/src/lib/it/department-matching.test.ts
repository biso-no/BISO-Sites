import { describe, expect, test } from "bun:test";
import {
  buildCampusPrefixToId,
  diceCoefficient,
  extractCampusPrefix,
  isClosedName,
  normalizeForCompare,
  stripClosedSuffix,
} from "./department-matching";

describe("normalizeForCompare", () => {
  test("lowercases, folds Norwegian diacritics, collapses whitespace", () => {
    expect(normalizeForCompare("OSL  Markedsføring")).toBe("markedsforing");
    expect(normalizeForCompare("BRG Næringsliv")).toBe("naeringsliv");
    expect(normalizeForCompare("Drift og Påvirkning ")).toBe(
      "drift og pavirkning"
    );
  });

  test("strips a leading campus prefix token", () => {
    expect(normalizeForCompare("TRD Økonomi")).toBe("okonomi");
    expect(normalizeForCompare("Økonomi")).toBe("okonomi");
  });
});

describe("extractCampusPrefix", () => {
  test("returns the known campus prefix or null", () => {
    expect(extractCampusPrefix("OSL DIGI-KOMM - Digital")).toBe("OSL");
    expect(extractCampusPrefix("BRG Marked")).toBe("BRG");
    expect(extractCampusPrefix("National Board")).toBeNull();
    expect(extractCampusPrefix("oslo lowercase prefix")).toBeNull();
  });
});

describe("diceCoefficient", () => {
  test("identical strings score 1", () => {
    expect(diceCoefficient("markedsforing", "markedsforing")).toBe(1);
  });

  test("no shared bigrams scores 0", () => {
    expect(diceCoefficient("abc", "xyz")).toBe(0);
  });

  test("near matches score high, unrelated score low", () => {
    expect(diceCoefficient("markedsforing", "markedsanalyse")).toBeLessThan(
      0.5
    );
    expect(
      diceCoefficient("naeringsliv og konsulent", "naeringsliv & konsulent")
    ).toBeGreaterThan(0.8);
  });
});

describe("isClosedName / stripClosedSuffix", () => {
  test("detects the nedlagt suffix case-insensitively", () => {
    expect(isClosedName("OSL DataAnalytisk Utvalg - nedlagt")).toBe(true);
    expect(isClosedName("OSL DataAnalytisk Utvalg - NEDLAGT")).toBe(true);
    expect(isClosedName("OSL DataAnalytisk Utvalg")).toBe(false);
  });

  test("strips the nedlagt suffix to recover the base name", () => {
    expect(stripClosedSuffix("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "OSL DataAnalytisk Utvalg"
    );
    expect(stripClosedSuffix("OSL Marked")).toBe("OSL Marked");
  });
});

describe("buildCampusPrefixToId", () => {
  test("maps each prefix to the campus id most common among its departments", () => {
    const map = buildCampusPrefixToId([
      { name: "OSL Marked", campusId: "1" },
      { name: "OSL Drift", campusId: "1" },
      { name: "BRG Marked", campusId: "2" },
      { name: "Sentralt utvalg", campusId: "5" }, // no prefix, ignored
    ]);
    expect(map.get("OSL")).toBe("1");
    expect(map.get("BRG")).toBe("2");
    expect(map.has("TRD")).toBe(false);
  });
});
