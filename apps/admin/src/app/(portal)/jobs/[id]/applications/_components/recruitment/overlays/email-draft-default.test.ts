import { describe, expect, test } from "bun:test";
import { draftEmailLabel, draftsEmailByDefault } from "./email-draft-default";

describe("advance-stage email drafting", () => {
  test("an offer is never drafted until HR asks for it", () => {
    expect(draftsEmailByDefault("accepted")).toBe(false);
    expect(draftEmailLabel("accepted")).toContain("HR has approved");
  });

  test("other stage mails draft on open as before", () => {
    for (const status of ["interview", "rejected", "reviewed", null]) {
      expect(draftsEmailByDefault(status)).toBe(true);
      expect(draftEmailLabel(status)).toBe(
        "Draft a candidate notification email"
      );
    }
  });
});
