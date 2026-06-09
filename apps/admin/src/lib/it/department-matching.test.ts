import { describe, expect, test } from "bun:test";
import {
  diceCoefficient,
  extractCampusPrefix,
  normalizeForCompare,
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
