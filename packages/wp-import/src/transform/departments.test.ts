import { describe, expect, test } from "bun:test";
import {
  AUTO_ACCEPT_CONFIDENCE,
  type DepartmentRecord,
  matchDepartment,
  normalizeDepartmentName,
  preserveUnseenResolvedRows,
} from "./departments";

const DEPARTMENTS: DepartmentRecord[] = [
  { Id: "1", Name: "Drift Campus Oslo", campus_id: "1" },
  { Id: "9", Name: "OSL FINANS (bachelor)", campus_id: "1" },
  { Id: "11", Name: "OSL IM - International Management", campus_id: "1" },
  { Id: "21", Name: "OSL Bergensbaneløpet", campus_id: "1" },
  { Id: "309", Name: "BRG Fagutvalget", campus_id: "2" },
  { Id: "310", Name: "BRG Retail Management", campus_id: "2" },
  { Id: "354", Name: "BRG Dans  - overført til BIA", campus_id: "2" },
  { Id: "803", Name: "STV Karrieredagene", campus_id: "4" },
  { Id: "1005", Name: "HR", campus_id: "5" },
];

describe("normalizeDepartmentName", () => {
  test("strips the campus prefix", () => {
    expect(normalizeDepartmentName("OSL Bergensbaneløpet")).toBe(
      "bergensbaneloepet"
    );
  });

  test("strips status suffixes", () => {
    expect(normalizeDepartmentName("BRG Dans  - overført til BIA")).toBe(
      "dans"
    );
    expect(normalizeDepartmentName("STV ØAF - nedlagt")).toBe("oeaf");
  });

  // Folding uses the standard Norwegian ASCII transliteration (æ→ae, ø→oe,
  // å→aa). The exact convention does not matter for matching — both the
  // WordPress name and the Appwrite name pass through this same function —
  // but it must be internally consistent.
  test("folds Norwegian characters", () => {
    expect(normalizeDepartmentName("Økonomiansvarlig")).toBe(
      "oekonomiansvarlig"
    );
    expect(normalizeDepartmentName("Næringslivsutvalget")).toBe(
      "naeringslivsutvalget"
    );
  });

  test("drops parenthesised qualifiers", () => {
    expect(normalizeDepartmentName("OSL FINANS (bachelor)")).toBe("finans");
  });
});

describe("matchDepartment", () => {
  test("matches exactly on the same campus with full confidence", () => {
    const result = matchDepartment("Bergensbaneløpet", "1", DEPARTMENTS);

    expect(result.departmentId).toBe("21");
    expect(result.confidence).toBe(1);
  });

  test("never matches a department from another campus", () => {
    // "Karrieredagene" exists only under Stavanger (803).
    const result = matchDepartment("Karrieredagene", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
  });

  test("matches across the campus prefix", () => {
    const result = matchDepartment("Fagutvalget", "2", DEPARTMENTS);

    expect(result.departmentId).toBe("309");
  });

  test("matches on token overlap for partial names", () => {
    const result = matchDepartment(
      "International Management",
      "1",
      DEPARTMENTS
    );

    expect(result.departmentId).toBe("11");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_ACCEPT_CONFIDENCE);
  });

  test("returns no match with low confidence for a job title, not a department", () => {
    const result = matchDepartment("HR advisor", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
    expect(result.confidence).toBeLessThan(AUTO_ACCEPT_CONFIDENCE);
  });

  test("returns no match for an unrelated free-text value", () => {
    const result = matchDepartment("academic association", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
  });

  test("still reports the best suggestion even below the threshold", () => {
    const result = matchDepartment("Retail", "2", DEPARTMENTS);

    expect(result.matchedName).toBe("BRG Retail Management");
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("handles an empty department list without throwing", () => {
    expect(matchDepartment("Anything", "1", []).departmentId).toBeNull();
  });
});

describe("preserveUnseenResolvedRows", () => {
  test("carries forward a previously-resolved row whose pair is absent from the current snapshot", () => {
    const previousRows = new Map([
      [
        "1::Retired Dept",
        {
          confidence: "0.90",
          resolved_id: "21",
          suggested_id: "21",
          suggested_name: "OSL Bergensbaneløpet",
          wp_campus_id: "1",
          wp_name: "Retired Dept",
        },
      ],
    ]);

    const result = preserveUnseenResolvedRows([], previousRows, new Set());

    expect(result).toHaveLength(1);
    expect(result[0]?.resolved_id).toBe("21");
    expect(result[0]?.wp_name).toBe("Retired Dept");
  });

  test("does not duplicate a row that the current snapshot already saw", () => {
    const currentRows = [
      {
        confidence: "1.00",
        resolved_id: "21",
        suggested_id: "21",
        suggested_name: "OSL Bergensbaneløpet",
        wp_campus_id: "1",
        wp_name: "Bergensbaneløpet",
      },
    ];
    const previousRows = new Map([
      ["1::Bergensbaneløpet", currentRows[0] as Record<string, string>],
    ]);

    const result = preserveUnseenResolvedRows(
      currentRows,
      previousRows,
      new Set(["1::Bergensbaneløpet"])
    );

    expect(result).toHaveLength(1);
  });

  test("drops an unresolved row that fell out of the snapshot, since it carries no human work", () => {
    const previousRows = new Map([
      [
        "1::Never Reviewed",
        {
          confidence: "0.10",
          resolved_id: "",
          suggested_id: "",
          suggested_name: "",
          wp_campus_id: "1",
          wp_name: "Never Reviewed",
        },
      ],
    ]);

    const result = preserveUnseenResolvedRows([], previousRows, new Set());

    expect(result).toHaveLength(0);
  });
});
