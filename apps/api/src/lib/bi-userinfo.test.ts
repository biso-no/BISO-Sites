import { describe, expect, it } from "vitest";
import { biUserinfoClaims, isBiEmail, vouchForBiEmail } from "./bi-userinfo";

describe("isBiEmail", () => {
  it("accepts any address on bi.no, whatever the local part", () => {
    expect(isBiEmail("s1715738@bi.no")).toBe(true);
    expect(isBiEmail("Ola.Nordmann@BI.NO")).toBe(true);
  });

  it("rejects look-alike domains and non-strings", () => {
    expect(isBiEmail("s1715738@bi.no.evil.com")).toBe(false);
    expect(isBiEmail("s1715738@notbi.no")).toBe(false);
    expect(isBiEmail("@bi.no")).toBe(false);
    expect(isBiEmail(undefined)).toBe(false);
    expect(isBiEmail(42)).toBe(false);
  });
});

describe("vouchForBiEmail", () => {
  it("marks a bi.no email verified and keeps every other claim", () => {
    expect(
      vouchForBiEmail({ email: "s1715738@bi.no", name: "Ola", sub: "abc" })
    ).toEqual({
      email: "s1715738@bi.no",
      email_verified: true,
      name: "Ola",
      sub: "abc",
    });
  });

  it("lowercases the address it vouches for, so Appwrite's exact match finds the account", () => {
    expect(vouchForBiEmail({ email: " S1715738@BI.NO " })).toEqual({
      email: "s1715738@bi.no",
      email_verified: true,
    });
  });

  it("never vouches for an address outside bi.no, even if upstream did", () => {
    expect(
      vouchForBiEmail({ email: "ola@gmail.com", email_verified: true })
    ).toEqual({ email: "ola@gmail.com", email_verified: false });
    expect(vouchForBiEmail({ sub: "abc" })).toEqual({
      email_verified: false,
      sub: "abc",
    });
  });
});

describe("biUserinfoClaims", () => {
  it("gives Appwrite the name as first name, last name, with the email vouched for", () => {
    expect(
      biUserinfoClaims({
        email: "S1715738@bi.no",
        name: "(Student) Heien, Markus",
        sub: "abc",
      })
    ).toEqual({
      email: "s1715738@bi.no",
      email_verified: true,
      name: "Markus Heien",
      sub: "abc",
    });
  });

  it("leaves a missing or non-string name alone", () => {
    expect(biUserinfoClaims({ email: "s1@bi.no" })).toEqual({
      email: "s1@bi.no",
      email_verified: true,
    });
    expect(biUserinfoClaims({ email: "s1@bi.no", name: 42 })).toEqual({
      email: "s1@bi.no",
      email_verified: true,
      name: 42,
    });
  });
});
