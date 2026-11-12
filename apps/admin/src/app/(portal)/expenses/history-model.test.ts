import { describe, expect, test } from "bun:test";
import type { ExpenseDetailEvent } from "./expenses-data";
import { describeEvent } from "./history-model";

const event = (over: Partial<ExpenseDetailEvent>): ExpenseDetailEvent => ({
  action: "edited",
  actorEmail: null,
  actorKind: "approver",
  actorName: null,
  after: null,
  at: "2026-11-01T10:00:00.000Z",
  attachmentId: null,
  before: null,
  field: null,
  id: "e1",
  note: null,
  ...over,
});

describe("describeEvent", () => {
  test("edited amount carries before and after", () => {
    expect(
      describeEvent(
        event({
          action: "edited",
          after: "250",
          before: "200",
          field: "amount",
        })
      )
    ).toEqual({
      key: "edited.amount",
      values: { after: "250", before: "200" },
    });
  });

  test("edited account number", () => {
    expect(
      describeEvent(
        event({ after: "7100", before: "7140", field: "account_number" })
      )
    ).toEqual({
      key: "edited.account_number",
      values: { after: "7100", before: "7140" },
    });
  });

  test("edited bank account is masked", () => {
    const result = describeEvent(
      event({
        after: "98765432109",
        before: "12345678903",
        field: "bank_account",
      })
    );
    expect(result.values).toEqual({ after: "•••• 2109", before: "•••• 8903" });
  });

  test("edited unknown field falls back to a generic key", () => {
    expect(describeEvent(event({ field: "weird" }))).toEqual({
      key: "edited.other",
      values: { after: "", before: "", field: "weird" },
    });
  });

  test("approved on behalf splits the note", () => {
    expect(
      describeEvent(
        event({
          action: "approved",
          note: "On behalf of the financial manager",
        })
      )
    ).toEqual({
      key: "approvedOnBehalf",
      values: { reason: "", role: "the financial manager" },
    });
  });

  test("rejected on behalf with a reason", () => {
    expect(
      describeEvent(
        event({
          action: "rejected",
          note: "On behalf of the financial manager · Reason: Too high",
        })
      )
    ).toEqual({
      key: "rejectedOnBehalf",
      values: { reason: "Too high", role: "the financial manager" },
    });
  });

  test("rejected with a plain reason", () => {
    expect(
      describeEvent(event({ action: "rejected", note: "Reason: No receipt" }))
    ).toEqual({ key: "rejected", values: { reason: "No receipt" } });
  });

  test("date shifted", () => {
    expect(
      describeEvent(
        event({
          action: "date_shifted",
          after: "2026-10-01",
          before: "2026-09-28",
          note: "locked period",
        })
      )
    ).toEqual({
      key: "dateShifted",
      values: { from: "2026-09-28", note: "locked period", to: "2026-10-01" },
    });
  });

  test("unknown action", () => {
    expect(describeEvent(event({ action: "teleported" }))).toEqual({
      key: "unknown",
      values: { action: "teleported" },
    });
  });
});
