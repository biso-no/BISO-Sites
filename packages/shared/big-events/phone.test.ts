import { describe, expect, it } from "vitest";
import { normalizePhone, phoneVariants } from "./phone";

describe("normalizePhone", () => {
  it("adds +47 to eight digits", () => {
    expect(normalizePhone("912 34 567")).toBe("+4791234567");
  });
  it("keeps a +47 number", () => {
    expect(normalizePhone("+47 91234567")).toBe("+4791234567");
  });
  it("turns 00 into +", () => {
    expect(normalizePhone("004791234567")).toBe("+4791234567");
  });
  it("adds + to 47 plus eight digits", () => {
    expect(normalizePhone("4791234567")).toBe("+4791234567");
  });
  it("strips dashes and parentheses", () => {
    expect(normalizePhone("(+47) 912-34-567")).toBe("+4791234567");
  });
  it("keeps other international numbers", () => {
    expect(normalizePhone("+46 70 123 45 67")).toBe("+46701234567");
  });
  it("returns null for short or empty input", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("phoneVariants", () => {
  it("lists the formats a profile may hold", () => {
    expect(phoneVariants("+4791234567")).toEqual([
      "+4791234567",
      "4791234567",
      "91234567",
      "+47 91234567",
      "+47 912 34 567",
      "912 34 567",
    ]);
  });
  it("returns only the number for non-Norwegian numbers", () => {
    expect(phoneVariants("+46701234567")).toEqual(["+46701234567"]);
  });
});
