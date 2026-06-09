import { describe, expect, test } from "bun:test";
import {
  buildCampusPrefixToId,
  classifyDepartmentValue,
  diceCoefficient,
  extractCampusPrefix,
  isClosedName,
  normalizeForCompare,
  stripClosedSuffix,
  type ClassifierContext,
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

function makeContext(): ClassifierContext {
  const canonical = [
    { name: "OSL DIGI-KOMM - Digital kommunikasjon og markedsf.", campusId: "1" },
    { name: "OSL Markedsforing", campusId: "1" },
    { name: "OSL Markedsanalyse", campusId: "1" },
    { name: "OSL Naringsliv og Konsulent", campusId: "1" },
    { name: "BRG Marked", campusId: "2" },
    { name: "OSL DataAnalytisk Utvalg - nedlagt", campusId: "1" },
    { name: "Sentralstyret", campusId: "5" },
  ];
  return {
    canonical,
    campusPrefixToId: buildCampusPrefixToId(canonical),
    reviewThreshold: 0.8,
    minPrefixLength: 20,
    tieMargin: 0.1,
  };
}

describe("classifyDepartmentValue", () => {
  test("blank value -> review-no-match", () => {
    const r = classifyDepartmentValue("", makeContext());
    expect(r.tier).toBe("review-no-match");
    expect(r.suggestedDepartment).toBeNull();
  });

  test("exact (case/whitespace) -> safe-exact with canonical casing", () => {
    const r = classifyDepartmentValue("  brg marked ", makeContext());
    expect(r.tier).toBe("safe-exact");
    expect(r.suggestedDepartment).toBe("BRG Marked");
    expect(r.suggestedCampusId).toBe("2");
  });

  test("truncated full name -> safe-truncation to the canonical truncated value", () => {
    const r = classifyDepartmentValue(
      "OSL DIGI-KOMM - Digital kommunikasjon og markedsføring",
      makeContext()
    );
    expect(r.tier).toBe("safe-truncation");
    expect(r.suggestedDepartment).toBe(
      "OSL DIGI-KOMM - Digital kommunikasjon og markedsf."
    );
    expect(r.suggestedCampusId).toBe("1");
  });

  test("user on a closed department -> closed", () => {
    const r = classifyDepartmentValue("OSL DataAnalytisk Utvalg", makeContext());
    expect(r.tier).toBe("closed");
  });

  test("diacritic/& typo within a campus -> review-suggested", () => {
    const r = classifyDepartmentValue(
      "OSL Næringsliv & Konsulent",
      makeContext()
    );
    expect(r.tier).toBe("review-suggested");
    expect(r.suggestedDepartment).toBe("OSL Naringsliv og Konsulent");
    expect(r.score).toBeGreaterThan(0.8);
  });

  test("cross-campus high similarity is never auto -> review at best", () => {
    const r = classifyDepartmentValue("BRG Markedsforing", makeContext());
    expect(r.tier).not.toBe("safe-exact");
    expect(r.tier).not.toBe("safe-truncation");
  });

  test("ambiguous near-tie prefix -> demoted to review", () => {
    const r = classifyDepartmentValue("OSL Markeds", makeContext());
    expect(r.tier).toMatch(/^review-/);
  });

  test("nothing close -> review-no-match", () => {
    const r = classifyDepartmentValue("OSL Completely Unrelated Xyz", makeContext());
    expect(r.tier).toBe("review-no-match");
  });
});
