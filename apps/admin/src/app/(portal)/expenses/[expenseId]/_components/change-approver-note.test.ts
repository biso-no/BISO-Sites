import { describe, expect, test } from "bun:test";
import { changeApproverNoteKey } from "./change-approver-note";

describe("changeApproverNoteKey", () => {
  test("the general manager's step changes for this reimbursement only", () => {
    expect(changeApproverNoteKey("national")).toBe("directorySkipped");
  });

  test("every other step also changes the saved approver", () => {
    for (const role of [
      "finance",
      "manager",
      "deputy",
      "controller",
      "president",
    ]) {
      expect(changeApproverNoteKey(role)).toBe("directoryNote");
    }
  });
});
