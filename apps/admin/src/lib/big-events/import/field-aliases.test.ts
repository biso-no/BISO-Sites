import { describe, expect, test } from "bun:test";
import { matchHeader, matchHeaders } from "./field-aliases";

describe("field aliases", () => {
  test("recognises Tickster's purchaser headers", () => {
    expect(
      matchHeaders([
        "Navn",
        "Etternavn",
        "E-post",
        "Mobilnr",
        "Ref.nr.",
        "Billettkategori",
      ])
    ).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "ticket_ref",
      "ticket_category",
    ]);
  });

  test("treats Navn as the full name without a last-name column", () => {
    expect(matchHeaders(["Navn", "E-post"])[0]).toBe("full_name");
  });

  test("keeps unambiguous first-name headers as first_name", () => {
    expect(matchHeaders(["Fornavn", "E-post"])[0]).toBe("first_name");
    expect(matchHeaders(["First name", "Email"])[0]).toBe("first_name");
  });

  test("never produces two full-name columns", () => {
    expect(matchHeaders(["Navn", "Fullt navn"])).toEqual([
      "first_name",
      "full_name",
    ]);
  });

  test("matches variants ignoring case, accents and punctuation", () => {
    expect(matchHeader("Rom")).toBe("group");
    expect(matchHeader("BUSS")).toBe("group");
    expect(matchHeader("  e-POST ")).toBe("email");
    expect(matchHeader("Fullt navn")).toBe("full_name");
    expect(matchHeader("Telefon")).toBe("phone");
    expect(matchHeader("Ticket type")).toBe("ticket_category");
    expect(matchHeader("Campus")).toBe("campus");
  });

  test("returns null for unknown headers", () => {
    expect(matchHeader("Kjøp fullført")).toBeNull();
    expect(matchHeader("")).toBeNull();
  });
});
