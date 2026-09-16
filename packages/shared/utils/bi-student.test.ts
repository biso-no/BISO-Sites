import { describe, expect, it } from "vitest";
import {
  identityBacksStudentId,
  parseBiStudentEmail,
  sanitizeStudentNumber,
} from "./bi-student";

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

  it("rejects staff addresses with numeric disambiguation", () => {
    expect(parseBiStudentEmail("ola.nordmann2@bi.no")).toBeNull();
  });

  it("rejects a local part without the s prefix", () => {
    expect(parseBiStudentEmail("1715738@bi.no")).toBeNull();
  });

  it("rejects a local part with characters after the digits", () => {
    expect(parseBiStudentEmail("s1715738x@bi.no")).toBeNull();
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
    expect(sanitizeStudentNumber(undefined)).toBeNull();
  });
});

describe("identityBacksStudentId", () => {
  const oidc = (providerEmail: string, providerUid = providerEmail) => ({
    provider: "oidc",
    providerEmail,
    providerUid,
  });

  it("accepts an OIDC identity whose BI email is that student", () => {
    expect(identityBacksStudentId([oidc("s1715738@bi.no")], "s1715738")).toBe(
      true
    );
    expect(
      identityBacksStudentId([oidc("", "S1715738@BI.NO")], " S1715738 ")
    ).toBe(true);
  });

  it("rejects other students, other providers and staff addresses", () => {
    expect(identityBacksStudentId([oidc("s1000000@bi.no")], "s1715738")).toBe(
      false
    );
    expect(
      identityBacksStudentId(
        [{ provider: "email", providerEmail: "s1715738@bi.no" }],
        "s1715738"
      )
    ).toBe(false);
    expect(
      identityBacksStudentId([oidc("ola.nordmann@bi.no")], "s1715738")
    ).toBe(false);
    expect(identityBacksStudentId([oidc("s1715738@bi.no")], null)).toBe(false);
  });
});
