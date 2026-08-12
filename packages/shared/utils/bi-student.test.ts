import { describe, expect, it } from "vitest";
import { parseBiStudentEmail, sanitizeStudentNumber } from "./bi-student";

describe("parseBiStudentEmail", () => {
  it("extracts the local part and numeric id", () => {
    expect(parseBiStudentEmail("s1715738@bi.no")).toEqual({
      studentId: "s1715738",
      studentNumber: 1_715_738,
    });
  });

  it("is case and whitespace insensitive", () => {
    expect(parseBiStudentEmail("  S1715738@BI.NO ")).toEqual({
      studentId: "s1715738",
      studentNumber: 1_715_738,
    });
  });

  it("rejects a non-bi.no domain", () => {
    expect(parseBiStudentEmail("s1715738@gmail.com")).toBeNull();
  });

  it("rejects a lookalike domain", () => {
    expect(parseBiStudentEmail("s1715738@notbi.no")).toBeNull();
  });

  it("rejects a local part with no digits", () => {
    expect(parseBiStudentEmail("firstname.lastname@bi.no")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseBiStudentEmail(null)).toBeNull();
    expect(parseBiStudentEmail("")).toBeNull();
  });
});

describe("sanitizeStudentNumber", () => {
  it("strips non-digits", () => {
    expect(sanitizeStudentNumber("s1715738")).toBe(1_715_738);
  });

  it("returns null when no digits remain", () => {
    expect(sanitizeStudentNumber("abc")).toBeNull();
    expect(sanitizeStudentNumber(null)).toBeNull();
  });
});
