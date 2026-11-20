import { describe, expect, test } from "bun:test";
import { checkReasonFor, hintsForReceipt, isChecking } from "./check-model";
import type { ExpenseDetailEvent } from "./expenses-data";

const event = (over: Partial<ExpenseDetailEvent>): ExpenseDetailEvent => ({
  action: "ai_classified",
  actorEmail: null,
  actorKind: "ai",
  actorName: "AI check",
  after: null,
  at: "2026-11-19T10:00:00Z",
  attachmentId: "a1",
  before: null,
  field: null,
  id: "e1",
  note: null,
  ...over,
});

describe("isChecking", () => {
  test("is true only while queued or running", () => {
    expect(isChecking("queued")).toBe(true);
    expect(isChecking("running")).toBe(true);
    expect(isChecking("done")).toBe(false);
    expect(isChecking("fallback")).toBe(false);
  });

  test("a row from before the check existed shows nothing", () => {
    expect(isChecking(null)).toBe(false);
    expect(isChecking(undefined)).toBe(false);
  });
});

describe("checkReasonFor", () => {
  test("takes the reason out of a classification note", () => {
    const events = [
      event({ note: "Confidence 0.82: Taxi receipt from the airport" }),
    ];
    expect(checkReasonFor(events, "a1", false)).toBe(
      "Taxi receipt from the airport"
    );
  });

  test("uses the latest AI-check event of that receipt", () => {
    const events = [
      event({ id: "e1", note: "Confidence 0.5: Old reason" }),
      event({ id: "e2", note: "Confidence 0.9: New reason" }),
      event({ attachmentId: "a2", id: "e3", note: "Confidence 0.9: Other" }),
    ];
    expect(checkReasonFor(events, "a1", false)).toBe("New reason");
  });

  test("ignores people and events without a note", () => {
    const events = [
      event({ actorKind: "approver", note: "Confidence 0.9: Not the AI" }),
      event({ id: "e2", note: null }),
    ];
    expect(checkReasonFor(events, "a1", false)).toBeNull();
  });

  test("shows a flag note when no hint for the receipt is shown", () => {
    const events = [
      event({
        action: "ai_flagged",
        field: "project_unsure",
        note: "Could not tell which project this belongs to",
      }),
    ];
    expect(checkReasonFor(events, "a1", false)).toBe(
      "Could not tell which project this belongs to"
    );
  });

  test("does not repeat a flag that a hint for the receipt already shows", () => {
    const events = [
      event({
        action: "ai_flagged",
        field: "project_unsure",
        note: "Could not tell which project this belongs to",
      }),
    ];
    expect(checkReasonFor(events, "a1", true)).toBeNull();
  });

  test("prefers a classification, project or account note over a later flag", () => {
    const events = [
      event({ id: "e1", note: "Confidence 0.9: Taxi receipt" }),
      event({
        action: "ai_flagged",
        id: "e2",
        note: "Could not tell which project this belongs to",
      }),
    ];
    expect(checkReasonFor(events, "a1", true)).toBe("Taxi receipt");
    expect(checkReasonFor(events, "a1", false)).toBe("Taxi receipt");
    expect(
      checkReasonFor(
        [
          event({
            action: "edited",
            field: "project",
            id: "e3",
            note: "Matches the occasion",
          }),
          event({ action: "edited", field: "amount", id: "e4", note: "x" }),
        ],
        "a1",
        true
      )
    ).toBe("Matches the occasion");
  });
});

describe("hintsForReceipt", () => {
  test("returns only the hints tied to that receipt", () => {
    const hints = [
      { attachmentId: "a1", code: "type_unsure" as const },
      { attachmentId: "a2", code: "project_unsure" as const },
      { code: "ai_check_incomplete" as const },
    ];
    expect(hintsForReceipt(hints, "a1")).toEqual([hints[0]]);
  });
});
