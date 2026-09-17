import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("passkit-generator", () => ({ PKPass: class {} }));

import { applePassFields } from "./apple-pass";

describe("applePassFields", () => {
  it("lays out the member, term and expiry", () => {
    expect(
      applePassFields(
        {
          expiryDate: "2026-12-31",
          membershipName: "Semester",
          name: "Markus Heien",
          startDate: "2026-07-01",
          term: null,
        },
        {
          member: "Member",
          membership: "Membership",
          validUntil: "Valid until",
        },
        "Fall 2026"
      )
    ).toEqual({
      auxiliary: [{ key: "expiry", label: "Valid until", value: "2026-12-31" }],
      primary: [{ key: "name", label: "Member", value: "Markus Heien" }],
      secondary: [{ key: "term", label: "Membership", value: "Fall 2026" }],
    });
  });
});
