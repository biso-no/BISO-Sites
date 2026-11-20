import { describe, expect, it } from "vitest";
import { type CheckNoteEvent, pickCheckNotes } from "./expense-check-notes";

const AT = (n: number) => `2026-11-19T10:00:0${n}.000Z`;

function ai(
  action: string,
  over: Partial<CheckNoteEvent> = {}
): CheckNoteEvent {
  return {
    $createdAt: AT(1),
    action,
    actor_kind: "ai",
    attachment_id: "a1",
    note: "A reason.",
    ...over,
  };
}

describe("pickCheckNotes", () => {
  it("strips the confidence prefix from a type change", () => {
    const notes = pickCheckNotes({
      events: [ai("ai_classified", { note: "Confidence 0.9: Ruter ticket." })],
      hints: [],
    });
    expect(notes.get("a1")).toBe("Ruter ticket.");
  });

  it("takes the latest change of the receipt", () => {
    const notes = pickCheckNotes({
      events: [
        ai("ai_classified", { $createdAt: AT(1), note: "Older." }),
        ai("edited", { $createdAt: AT(3), field: "project", note: "Newest." }),
        ai("ai_account_chosen", { $createdAt: AT(2), note: "Middle." }),
      ],
      hints: [],
    });
    expect(notes.get("a1")).toBe("Newest.");
  });

  it("ignores an edit of another field, and edits by people", () => {
    const notes = pickCheckNotes({
      events: [
        ai("edited", { field: "amount", note: "Not the check's own." }),
        ai("ai_classified", { actor_kind: "approver", note: "By a person." }),
      ],
      hints: [],
    });
    expect(notes.size).toBe(0);
  });

  it("prefers a change over a flag", () => {
    const notes = pickCheckNotes({
      events: [
        ai("ai_flagged", { $createdAt: AT(5), note: "A flag." }),
        ai("ai_classified", { $createdAt: AT(1), note: "A change." }),
      ],
      hints: [],
    });
    expect(notes.get("a1")).toBe("A change.");
  });

  it("uses a flag's note only when no hint is tied to the receipt", () => {
    const flagged = [ai("ai_flagged", { note: "Series year is unclear." })];
    expect(pickCheckNotes({ events: flagged, hints: [] }).get("a1")).toBe(
      "Series year is unclear."
    );
    expect(
      pickCheckNotes({
        events: flagged,
        hints: [{ attachmentId: "a1", code: "project_unsure" }],
      }).has("a1")
    ).toBe(false);
    expect(
      pickCheckNotes({
        events: flagged,
        hints: [{ attachmentId: "a2", code: "project_unsure" }],
      }).get("a1")
    ).toBe("Series year is unclear.");
  });

  it("shows nothing for a receipt the check did not touch, or an empty note", () => {
    const notes = pickCheckNotes({
      events: [ai("ai_classified", { note: "Confidence 0.5:   " })],
      hints: [],
    });
    expect(notes.size).toBe(0);
  });

  it("falls back to an older change when the latest has no note", () => {
    const notes = pickCheckNotes({
      events: [
        ai("ai_classified", { $createdAt: AT(1), note: "Confidence 1: Taxi." }),
        ai("ai_account_chosen", { $createdAt: AT(2), note: null }),
      ],
      hints: [],
    });
    expect(notes.get("a1")).toBe("Taxi.");
  });

  it("keeps receipts apart and skips events without a receipt", () => {
    const notes = pickCheckNotes({
      events: [
        ai("ai_classified", { attachment_id: "a2", note: "Two." }),
        ai("ai_classified", { attachment_id: null, note: "None." }),
      ],
      hints: [],
    });
    expect([...notes]).toEqual([["a2", "Two."]]);
  });
});
