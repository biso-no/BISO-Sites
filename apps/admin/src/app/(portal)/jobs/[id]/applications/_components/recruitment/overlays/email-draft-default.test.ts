import { describe, expect, test } from "bun:test";
import { draftEmailLabel, draftsEmailByDefault } from "./email-draft-default";

describe("advance-stage email drafting", () => {
  test("no stage drafts on open; every draft waits for a click", () => {
    for (const status of [
      "accepted",
      "interview",
      "rejected",
      "reviewed",
      null,
    ]) {
      expect(draftsEmailByDefault(status)).toBe(false);
    }
  });

  test("the offer label says HR must approve first", () => {
    expect(draftEmailLabel("accepted")).toContain("HR has approved");
  });

  test("other stages use the plain notification label", () => {
    for (const status of ["interview", "rejected", "reviewed", null]) {
      expect(draftEmailLabel(status)).toBe(
        "Draft a candidate notification email"
      );
    }
  });
});
