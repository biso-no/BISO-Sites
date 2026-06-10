import { describe, expect, test } from "bun:test";
import { emailLocalPart, extractCampusHint } from "./email-classify";

const TOKEN_TO_CAMPUS = new Map<string, string>([
  ["oslo", "Oslo"],
  ["bergen", "Bergen"],
  ["trondheim", "Trondheim"],
  ["stavanger", "Stavanger"],
]);

describe("emailLocalPart", () => {
  test("returns the part before @, lowercased", () => {
    expect(emailLocalPart("President.Oslo@biso.no")).toBe("president.oslo");
  });
  test("returns empty string for null/blank", () => {
    expect(emailLocalPart(null)).toBe("");
    expect(emailLocalPart("")).toBe("");
  });
});

describe("extractCampusHint", () => {
  test("uses the email's last segment when it is a known campus token", () => {
    expect(
      extractCampusHint("finance.nu.oslo@biso.no", null, TOKEN_TO_CAMPUS)
    ).toBe("Oslo");
    expect(
      extractCampusHint("president.bergen@biso.no", "Oslo", TOKEN_TO_CAMPUS)
    ).toBe("Bergen"); // email token wins over officeLocation
  });

  test("falls back to officeLocation when email has no campus token", () => {
    expect(
      extractCampusHint("markus@biso.no", "Trondheim", TOKEN_TO_CAMPUS)
    ).toBe("Trondheim");
  });

  test("returns null when neither email nor office resolves a campus", () => {
    expect(extractCampusHint("markus@biso.no", null, TOKEN_TO_CAMPUS)).toBeNull();
    expect(
      extractCampusHint("markus@biso.no", "National", TOKEN_TO_CAMPUS)
    ).toBeNull();
  });

  test("a person address whose last segment is a name returns the office fallback only", () => {
    // adrian.heien -> 'heien' is not a campus token; office National -> null
    expect(
      extractCampusHint("adrian.heien@biso.no", "National", TOKEN_TO_CAMPUS)
    ).toBeNull();
  });
});
