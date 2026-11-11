import { describe, expect, it, vi } from "vitest";
import { recordExpenseEvents } from "./expense-events";

describe("recordExpenseEvents", () => {
  it("writes each event with snake_case columns", async () => {
    const db = { createRow: vi.fn().mockResolvedValue({}) };
    await recordExpenseEvents(db, [
      { expenseId: "e1", actorKind: "system", action: "booked", note: "tx-1" },
    ]);
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "expense_events",
      expect.any(String),
      expect.objectContaining({
        expense_id: "e1",
        actor_kind: "system",
        action: "booked",
        note: "tx-1",
      })
    );
  });

  it("truncates long notes to 2000 characters", async () => {
    const db = { createRow: vi.fn().mockResolvedValue({}) };
    await recordExpenseEvents(db, [
      {
        expenseId: "e1",
        actorKind: "system",
        action: "booking_failed",
        note: "x".repeat(5000),
      },
    ]);
    const note = db.createRow.mock.calls[0][3].note as string;
    expect(note).toHaveLength(2000);
    expect(note.endsWith("...")).toBe(true);
  });

  it("never throws and keeps writing after a failure", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const db = {
      createRow: vi
        .fn()
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValue({}),
    };
    await expect(
      recordExpenseEvents(db, [
        { expenseId: "e1", actorKind: "system", action: "date_shifted" },
        { expenseId: "e1", actorKind: "system", action: "booked" },
      ])
    ).resolves.toBeUndefined();
    expect(db.createRow).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
