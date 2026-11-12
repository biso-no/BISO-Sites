import { describe, expect, it } from "vitest";
import {
  isValidNorwegianBankAccount,
  normalizeBankAccount,
} from "./bank-account";

describe("isValidNorwegianBankAccount", () => {
  it("accepts a number with a correct check digit", () => {
    expect(isValidNorwegianBankAccount("12345678903")).toBe(true);
  });

  it("accepts remainder 0 with check digit 0", () => {
    // The weighted sum is 0, so the check digit is 0.
    expect(isValidNorwegianBankAccount("00000000000")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidNorwegianBankAccount("12345678904")).toBe(false);
  });

  it("rejects remainder 1, which has no check digit", () => {
    // 3 * 4 = 12, and 12 mod 11 = 1.
    expect(isValidNorwegianBankAccount("03000000000")).toBe(false);
    expect(isValidNorwegianBankAccount("03000000001")).toBe(false);
  });

  it("rejects the wrong length or non-digits", () => {
    expect(isValidNorwegianBankAccount("1234567890")).toBe(false);
    expect(isValidNorwegianBankAccount("1234567890a")).toBe(false);
  });
});

describe("normalizeBankAccount", () => {
  it("drops spaces and dots", () => {
    expect(normalizeBankAccount("1234.56.78903")).toBe("12345678903");
    expect(normalizeBankAccount("1234 56 78903")).toBe("12345678903");
  });
});
