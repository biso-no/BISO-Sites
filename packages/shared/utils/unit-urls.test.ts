import { describe, expect, it } from "vitest";
import {
  campusIdToLabel,
  campusIdToSegment,
  campusSegmentToId,
  isUnitPageSlug,
  unitCanonicalPath,
  unitPageSlug,
} from "./unit-urls";

describe("campus segment mapping", () => {
  it("maps every campus id to its url segment", () => {
    expect(campusIdToSegment("1")).toBe("oslo");
    expect(campusIdToSegment("2")).toBe("bergen");
    expect(campusIdToSegment("3")).toBe("trondheim");
    expect(campusIdToSegment("4")).toBe("stavanger");
    expect(campusIdToSegment("5")).toBe("national");
  });

  it("round-trips every segment back to its id", () => {
    for (const id of ["1", "2", "3", "4", "5"]) {
      const segment = campusIdToSegment(id);
      expect(segment).not.toBeNull();
      expect(campusSegmentToId(segment as string)).toBe(id);
    }
  });

  it("is case-insensitive on the way in and rejects unknowns", () => {
    expect(campusSegmentToId("OSLO")).toBe("1");
    expect(campusSegmentToId("paris")).toBeNull();
    expect(campusSegmentToId(null)).toBeNull();
    expect(campusIdToSegment("99")).toBeNull();
    expect(campusIdToSegment(null)).toBeNull();
  });

  it("exposes a display label for the chooser", () => {
    expect(campusIdToLabel("1")).toBe("Oslo");
    expect(campusIdToLabel("5")).toBe("National");
    expect(campusIdToLabel("99")).toBeNull();
    expect(campusIdToLabel(null)).toBeNull();
  });
});

describe("unitPageSlug", () => {
  it("builds the storage slug from campus and department slug", () => {
    expect(unitPageSlug({ campusId: "1", slug: "fadderullan" })).toBe(
      "units/oslo/fadderullan"
    );
    expect(unitPageSlug({ campusId: "5", slug: "sentralt-utvalg" })).toBe(
      "units/national/sentralt-utvalg"
    );
  });

  it("returns null when either half is missing or unknown", () => {
    expect(unitPageSlug({ campusId: "1", slug: null })).toBeNull();
    expect(unitPageSlug({ campusId: null, slug: "fadderullan" })).toBeNull();
    expect(unitPageSlug({ campusId: "99", slug: "fadderullan" })).toBeNull();
  });
});

describe("unitCanonicalPath", () => {
  it("is the storage slug as an absolute path", () => {
    expect(unitCanonicalPath({ campusId: "2", slug: "fadderullan" })).toBe(
      "/units/bergen/fadderullan"
    );
    expect(unitCanonicalPath({ campusId: "2", slug: "" })).toBeNull();
  });
});

describe("isUnitPageSlug", () => {
  it("recognises bound unit pages only", () => {
    expect(isUnitPageSlug("units/oslo/fadderullan")).toBe(true);
    expect(isUnitPageSlug("about/history")).toBe(false);
    expect(isUnitPageSlug(null)).toBe(false);
  });

  it("does not mistake a slug that merely starts with the letters", () => {
    expect(isUnitPageSlug("unitsomething")).toBe(false);
    expect(isUnitPageSlug("units")).toBe(false);
  });

  /**
   * Appwrite's Query.equal matches slugs case-insensitively, so
   * "Units/oslo/fadderullan" serves the same public URL as the lowercase
   * form. A case-sensitive test here would let a case variant past every
   * guard built on it while still hijacking the department's address.
   */
  it("matches case-insensitively, as Appwrite's slug lookup does", () => {
    expect(isUnitPageSlug("Units/oslo/fadderullan")).toBe(true);
    expect(isUnitPageSlug("UNITS/OSLO/FADDERULLAN")).toBe(true);
    expect(isUnitPageSlug("UnItS/bergen/x")).toBe(true);
  });
});
