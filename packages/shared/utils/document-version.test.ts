import { describe, expect, it } from "vitest";
import {
  compareDocumentVersions,
  DOCUMENT_VERSION_PATTERN,
  displayDocumentVersion,
  formatDocumentVersion,
  parseDocumentVersion,
} from "./document-version";

describe("parseDocumentVersion", () => {
  it("parses whole and major.minor versions", () => {
    expect(parseDocumentVersion("12")).toEqual({ major: 12, minor: 0 });
    expect(parseDocumentVersion("7.1")).toEqual({ major: 7, minor: 1 });
  });

  it("tolerates whitespace and a pasted v prefix", () => {
    expect(parseDocumentVersion(" v12 ")).toEqual({ major: 12, minor: 0 });
    expect(parseDocumentVersion("V7.1")).toEqual({ major: 7, minor: 1 });
  });

  it("rejects anything that is not a version number", () => {
    for (const input of ["", "v", "1.", ".1", "1.2.3", "1,2", "abc", "-1"]) {
      expect(parseDocumentVersion(input)).toBeNull();
    }
    expect(parseDocumentVersion(null)).toBeNull();
    expect(parseDocumentVersion(undefined)).toBeNull();
  });

  it("treats the minor part as an integer, not a decimal", () => {
    expect(parseDocumentVersion("7.10")).toEqual({ major: 7, minor: 10 });
  });
});

describe("formatDocumentVersion", () => {
  it("omits a zero minor", () => {
    expect(formatDocumentVersion({ major: 12, minor: 0 })).toBe("12");
    expect(formatDocumentVersion({ major: 7, minor: 1 })).toBe("7.1");
  });
});

describe("compareDocumentVersions", () => {
  it("orders by major, then minor", () => {
    const sorted = ["7.1", "12", "7", "7.10", "7.9"]
      .map((v) => parseDocumentVersion(v))
      .filter((v) => v !== null)
      .sort(compareDocumentVersions)
      .map(formatDocumentVersion);
    expect(sorted).toEqual(["7", "7.1", "7.9", "7.10", "12"]);
  });

  it("returns 0 for equal versions", () => {
    expect(
      compareDocumentVersions({ major: 7, minor: 0 }, { major: 7, minor: 0 })
    ).toBe(0);
  });
});

describe("DOCUMENT_VERSION_PATTERN", () => {
  it("matches only the stored form, without a prefix", () => {
    expect(DOCUMENT_VERSION_PATTERN.test("12")).toBe(true);
    expect(DOCUMENT_VERSION_PATTERN.test("7.1")).toBe(true);
    expect(DOCUMENT_VERSION_PATTERN.test("v12")).toBe(false);
  });
});

describe("displayDocumentVersion", () => {
  it("adds the v prefix to a stored version", () => {
    expect(displayDocumentVersion("12")).toBe("v12");
    expect(displayDocumentVersion(" 7.10 ")).toBe("v7.10");
  });

  it("does not double the prefix on a legacy value that already has one", () => {
    expect(displayDocumentVersion("v2.1")).toBe("v2.1");
    expect(displayDocumentVersion("V3")).toBe("v3");
  });

  it("shows free text that is not a version number as it is, trimmed", () => {
    expect(displayDocumentVersion("draft")).toBe("draft");
    expect(displayDocumentVersion(" 2024 edition ")).toBe("2024 edition");
  });

  it("returns null when there is nothing to show", () => {
    expect(displayDocumentVersion(null)).toBeNull();
    expect(displayDocumentVersion(undefined)).toBeNull();
    expect(displayDocumentVersion("")).toBeNull();
    expect(displayDocumentVersion("   ")).toBeNull();
  });
});
