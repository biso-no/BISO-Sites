import { describe, expect, it } from "vitest";
import { isPublicUnit, isPublicUnitName } from "./unit-visibility";

describe("isPublicUnitName", () => {
  it("hides every operating ledger, including ones no campus has yet", () => {
    expect(isPublicUnitName("Drift BISO")).toBe(false);
    expect(isPublicUnitName("Drift Campus Oslo")).toBe(false);
    expect(isPublicUnitName("Drift Campus Bergen")).toBe(false);
    expect(isPublicUnitName("Drift Campus Trondheim")).toBe(false);
    expect(isPublicUnitName("Drift Campus Stavanger")).toBe(false);
    expect(isPublicUnitName("Drift Campus Kristiansand")).toBe(false);
  });

  it("hides national accounting entities", () => {
    expect(isPublicUnitName("Accounting Departement")).toBe(false);
    expect(isPublicUnitName("Student groups outside BISO (gift fund)")).toBe(
      false
    );
    expect(isPublicUnitName("Samlinger - CL")).toBe(false);
    expect(isPublicUnitName("Investment Committee")).toBe(false);
  });

  it("hides governance bodies that /campus already presents", () => {
    expect(isPublicUnitName("Board")).toBe(false);
    expect(isPublicUnitName("Operations Unit")).toBe(false);
    expect(isPublicUnitName("Control Committee")).toBe(false);
    expect(isPublicUnitName("HR")).toBe(false);
    expect(isPublicUnitName("Organisasjonsstrukturkomiteen")).toBe(false);
  });

  it("keeps real student units", () => {
    expect(isPublicUnitName("OSL Fadderullan")).toBe(true);
    expect(isPublicUnitName("BRG Case Club")).toBe(true);
    expect(isPublicUnitName("TRD Society")).toBe(true);
    expect(isPublicUnitName("Wintergames")).toBe(true);
    expect(isPublicUnitName("Alumni")).toBe(true);
  });

  it("matches the denylist WITHOUT stripping the campus prefix, so a campus unit sharing a national name survives", () => {
    expect(isPublicUnitName("OSL Board")).toBe(true);
    expect(isPublicUnitName("BRG HR")).toBe(true);
    expect(isPublicUnitName("TRD Administration")).toBe(true);
  });

  it("does not hide a unit merely starting with the letters d-r-i-f-t", () => {
    expect(isPublicUnitName("Driftige Studenter")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isPublicUnitName("  drift   biso ")).toBe(false);
    expect(isPublicUnitName("OPERATIONS  UNIT")).toBe(false);
  });

  it("rejects a missing or blank name", () => {
    expect(isPublicUnitName(null)).toBe(false);
    expect(isPublicUnitName("   ")).toBe(false);
  });
});

describe("isPublicUnit", () => {
  it("requires the row not to be explicitly inactive", () => {
    expect(isPublicUnit({ Name: "OSL Media", active: true })).toBe(true);
    expect(isPublicUnit({ Name: "OSL Media", active: false })).toBe(false);
  });

  it("treats a null `active` as active, matching the admin scope query", () => {
    expect(isPublicUnit({ Name: "OSL Media", active: null })).toBe(true);
  });

  it("still hides a ledger that is active", () => {
    expect(isPublicUnit({ Name: "Drift BISO", active: true })).toBe(false);
  });
});
