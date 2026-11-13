import { describe, expect, test } from "bun:test";
import type { ExpenseDetailEvent } from "./expenses-data";
import { describeEvent, type HistoryLabels } from "./history-model";

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

describe("describeEvent booked and approver changes", () => {
  test("booked shows the transaction id from the note", () => {
    expect(
      describeEvent(
        event({ action: "booked", actorKind: "system", note: "tx-55" })
      )
    ).toEqual({ key: "booked", values: { id: "tx-55" } });
  });

  test("booked keeps just the id when a status warning follows", () => {
    expect(
      describeEvent(
        event({
          action: "booked",
          note: "tx-55 (status write failed: x)",
        })
      )
    ).toEqual({ key: "booked", values: { id: "tx-55" } });
  });

  test("booked shows the customer the debt was booked on", () => {
    expect(
      describeEvent(
        event({
          action: "booked",
          actorKind: "system",
          note: "tx-55 customer 4992",
        })
      )
    ).toEqual({
      key: "bookedWithCustomer",
      values: { customer: "4992", id: "tx-55" },
    });
  });

  test("booked without a note has no id to show", () => {
    expect(describeEvent(event({ action: "booked" }))).toEqual({
      key: "bookedPlain",
      values: {},
    });
  });

  test.each([
    "admin",
    "approver",
  ])("an approver change by %s reads as a change from A to B", (actorKind) => {
    expect(
      describeEvent(
        event({
          action: "approver_resolved",
          actorKind,
          after: "b@biso.no",
          before: "a@biso.no",
          field: "approver_email",
          note: "changed in admin",
        })
      )
    ).toEqual({
      key: "edited.approver_email",
      values: { after: "b@biso.no", before: "a@biso.no" },
    });
  });

  test("the system's own approver resolution stays 'approver found'", () => {
    expect(
      describeEvent(
        event({
          action: "approver_resolved",
          actorKind: "system",
          after: "b@biso.no",
        })
      )
    ).toEqual({ key: "approverResolved", values: { email: "b@biso.no" } });
  });
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

describe("describeEvent with labels", () => {
  const labels: HistoryLabels = {
    reason: "Årsak",
    roles: {
      controller: "Controller",
      deputy: "Nestleder",
      finance: "Økonomi",
      manager: "Leder",
      national: "Nasjonal",
      president: "President",
    },
  };

  test("maps every known on-behalf phrase to the role label", () => {
    const phrases = {
      "the campus controller": "Controller",
      "the campus president": "President",
      "the deputy manager": "Nestleder",
      "the department manager": "Leder",
      "the financial manager": "Økonomi",
      "the national approver": "Nasjonal",
      "the general manager": "Nasjonal",
      "the controller": "Controller",
    };
    for (const [phrase, label] of Object.entries(phrases)) {
      expect(
        describeEvent(
          event({ action: "approved", note: `On behalf of ${phrase}` }),
          labels
        )
      ).toEqual({
        key: "approvedOnBehalf",
        values: { reason: "", role: label },
      });
    }
  });

  test("translates the reason word", () => {
    expect(
      describeEvent(
        event({
          action: "rejected",
          note: "On behalf of the financial manager · Reason: Too high",
        }),
        labels
      )
    ).toEqual({
      key: "rejectedOnBehalf",
      values: { reason: "Årsak: Too high", role: "Økonomi" },
    });
    expect(
      describeEvent(
        event({ action: "rejected", note: "Reason: No receipt" }),
        labels
      ).values
    ).toEqual({ reason: "Årsak: No receipt" });
  });

  test("unknown text passes through unchanged", () => {
    expect(
      describeEvent(
        event({ action: "approved", note: "On behalf of the janitor" }),
        labels
      ).values.role
    ).toBe("the janitor");
  });

  test("edited total has its own key", () => {
    expect(describeEvent(event({ field: "total" })).key).toBe("edited.total");
  });
});
