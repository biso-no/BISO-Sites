import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const storage = vi.hoisted(() => ({ getFileDownload: vi.fn() }));

const finago = vi.hoisted(() => ({
  getFiscalYearLocks: vi.fn(),
  listFiscalPeriods: vi.fn(),
  postExpenseTransaction: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, storage })),
}));

vi.mock("@repo/connectors/24sevenoffice", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/connectors/24sevenoffice")
  >("@repo/connectors/24sevenoffice");
  return {
    ...actual,
    getFiscalYearLocks: finago.getFiscalYearLocks,
    listFiscalPeriods: finago.listFiscalPeriods,
    postExpenseTransaction: finago.postExpenseTransaction,
    uploadDocument: finago.uploadDocument,
  };
});

vi.mock("./pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    return await doc.save();
  }),
}));

const scans = vi.hoisted(() => ({ findScan: vi.fn() }));
const examples = vi.hoisted(() => ({ writeExamples: vi.fn() }));

vi.mock("./receipt-scan", () => ({ findScan: scans.findScan }));
vi.mock("./expense-examples", () => ({
  writeExamples: examples.writeExamples,
}));

vi.mock("./expense-approval-chain", () => ({
  assertApprovedExpenseChain: vi.fn(async () => undefined),
}));

import { assertApprovedExpenseChain } from "./expense-approval-chain";
import { postApprovedExpense } from "./expense-posting";

const expense = {
  $id: "exp-1",
  $sequence: 7,
  $updatedAt: "2026-11-01T00:00:00.000Z",
  ledger_transaction_id: null,
  status: "approved",
  bank_account: "1234.56.78901",
  campus: "1",
  department: "101",
  description: "Test",
  total: 300,
  userId: "u1",
  departmentRel: { Id: "101", Name: "OSL AI Club" },
  campusRel: { name: "Oslo" },
  expenseAttachments: [
    {
      $id: "att-1",
      url: "",
      type: "application/pdf",
      date: "2025-12-18T00:00:00.000+00:00",
      amount: 100,
      account_number: 7140,
      tax_code: 0,
      sort_order: 0,
    },
    {
      $id: "att-2",
      url: "",
      type: "application/pdf",
      date: "2026-10-10T00:00:00.000+00:00",
      amount: 200,
      account_number: 7140,
      tax_code: 0,
      sort_order: 1,
    },
  ],
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function eventCalls() {
  return db.createRow.mock.calls.filter((c) => c[1] === "expense_events");
}

describe("postApprovedExpense booking dates", () => {
  beforeEach(() => {
    for (const fn of [
      ...Object.values(db),
      ...Object.values(storage),
      ...Object.values(finago),
      ...Object.values(scans),
      ...Object.values(examples),
    ]) {
      fn.mockReset();
    }
    db.getRow.mockImplementation(async (_d: string, table: string) =>
      table === "user"
        ? { name: "Test Student", email: "t@example.test" }
        : expense
    );
    db.listRows.mockResolvedValue({ rows: [] });
    db.incrementRowColumn.mockResolvedValue({ posting_lock: 1 });
    db.updateRow.mockResolvedValue({});
    db.createRow.mockResolvedValue({});
    finago.uploadDocument.mockResolvedValue({ documentId: 1 });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("posts each line on its booking date and records the shift", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([
      { startingDate: "2025-01-01", isLocked: true },
      { startingDate: "2026-01-01", isLocked: false },
    ]);
    finago.listFiscalPeriods.mockResolvedValue([
      { startingDate: "2026-01-01", endingDate: "2026-01-31" },
    ]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");

    const receipts = finago.postExpenseTransaction.mock.calls[0][0].receipts;
    expect(
      receipts.map((r: { ref: string; date: string }) => [r.ref, r.date])
    ).toEqual([
      ["att-1", "2026-01-01"],
      ["att-2", "2026-10-10"],
    ]);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({
        status: "success",
        ledger_transaction_id: "tx-9",
      })
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { booked_date: "2026-01-01" }
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-2",
      { booked_date: "2026-10-10" }
    );
    expect(eventCalls().map((c) => c[3].action)).toEqual([
      "date_shifted",
      "booked",
    ]);

    // The success write comes before every other write.
    const successOrder = db.updateRow.mock.calls.flatMap((c, i) =>
      c[1] === "expense" && c[3].status === "success"
        ? [db.updateRow.mock.invocationCallOrder[i]]
        : []
    );
    expect(successOrder).toHaveLength(1);
    const laterOrders = [
      ...db.updateRow.mock.calls.flatMap((c, i) =>
        c[1] === "expense_attachments"
          ? [db.updateRow.mock.invocationCallOrder[i]]
          : []
      ),
      ...db.createRow.mock.calls.flatMap((c, i) =>
        c[1] === "expense_events"
          ? [db.createRow.mock.invocationCallOrder[i]]
          : []
      ),
    ];
    expect(laterOrders.length).toBeGreaterThan(0);
    for (const order of laterOrders) {
      expect(order).toBeGreaterThan(successOrder[0]);
    }
  });

  it("passes the same Oslo today to the posting and its closed-period limit", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");

    const params = finago.postExpenseTransaction.mock.calls[0][0];
    expect(params.today).toMatch(ISO_DAY);
    expect(params.date).toBe(params.today);
  });

  it("uses the retry shifts for the final booked date", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [
        {
          ref: "att-2",
          from: "2026-10-10",
          to: "2026-11-01",
          reason: "closed_period",
          finagoMessage: "Period closed",
        },
      ],
    });

    await postApprovedExpense("exp-1");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-2",
      { booked_date: "2026-11-01" }
    );
    const shifted = eventCalls().find((c) => c[3].action === "date_shifted");
    expect(shifted?.[3]).toEqual(
      expect.objectContaining({
        attachment_id: "att-2",
        before: "2026-10-10",
        after: "2026-11-01",
      })
    );
    expect(shifted?.[3].note).toContain("Period closed");
  });

  it("keeps success when the history write fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.createRow.mockRejectedValue(new Error("appwrite down"));

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "success" })
    );
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("keeps success when a booked_date update fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.updateRow.mockImplementation((_d: string, table: string) =>
      table === "expense_attachments"
        ? Promise.reject(new Error("appwrite down"))
        : Promise.resolve({})
    );

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("still updates the other receipts when one booked_date update fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.updateRow.mockImplementation((_d: string, _t: string, id: string) =>
      id === "att-1"
        ? Promise.reject(new Error("appwrite down"))
        : Promise.resolve({})
    );

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-2",
      { booked_date: "2026-10-10" }
    );
  });

  it("never marks failed when the success write keeps failing", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.updateRow.mockImplementation(
      (_d: string, table: string, _id: string, data: { status?: string }) =>
        table === "expense" && data.status === "success"
          ? Promise.reject(new Error("appwrite down"))
          : Promise.resolve({})
    );

    await expect(postApprovedExpense("exp-1")).rejects.toThrow("appwrite down");

    const successWrites = db.updateRow.mock.calls.filter(
      (c) => c[1] === "expense" && c[3].status === "success"
    );
    expect(successWrites).toHaveLength(3);
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    const booked = eventCalls().filter((c) => c[3].action === "booked");
    expect(booked).toHaveLength(1);
    expect(booked[0][3].note).toContain("tx-9");
    expect(booked[0][3].note).toContain("status write failed");
    expect(
      vi
        .mocked(console.error)
        .mock.calls.some((c) => String(c[0]).includes("tx-9"))
    ).toBe(true);
  });

  it("succeeds when the success write fails once and then works", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    let failedOnce = false;
    db.updateRow.mockImplementation(
      (_d: string, table: string, _id: string, data: { status?: string }) => {
        if (table === "expense" && data.status === "success" && !failedOnce) {
          failedOnce = true;
          return Promise.reject(new Error("blip"));
        }
        return Promise.resolve({});
      }
    );

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({
        status: "success",
        ledger_transaction_id: "tx-9",
      })
    );
    expect(eventCalls().map((c) => c[3].action)).toEqual(["booked"]);
    expect(eventCalls()[0][3].note).toBe("tx-9");
  });

  it("records booking_failed when the stale-lease reaper marks a row failed", async () => {
    db.getRow.mockImplementation(async () => ({
      ...expense,
      ledger_transaction_id: "posting",
      $updatedAt: "2020-01-01T00:00:00.000Z",
    }));

    await expect(postApprovedExpense("exp-1")).rejects.toThrow(
      "Stale posting claim"
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
    const failed = eventCalls().find((c) => c[3].action === "booking_failed");
    expect(failed?.[3].actor_kind).toBe("system");
    expect(failed?.[3].note).toContain("Stale posting claim");
  });

  it("records booking_failed when the approval chain assert fails", async () => {
    vi.mocked(assertApprovedExpenseChain).mockRejectedValueOnce(
      new Error("Chain not approved")
    );

    await expect(postApprovedExpense("exp-1")).rejects.toThrow(
      "Chain not approved"
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
    const failed = eventCalls().find((c) => c[3].action === "booking_failed");
    expect(failed?.[3].actor_kind).toBe("system");
    expect(failed?.[3].note).toBe("Chain not approved");
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });

  it("still posts when the year-lock lookup fails", async () => {
    finago.getFiscalYearLocks.mockRejectedValue(new Error("soap down"));
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("still posts when the period lookup fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockRejectedValue(new Error("rest down"));
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(finago.postExpenseTransaction.mock.calls[0][0].periods).toEqual([]);
  });

  it("records booking_failed and marks the expense failed", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockRejectedValue(
      new Error("Account 9999 does not exist")
    );

    await expect(postApprovedExpense("exp-1")).rejects.toThrow("Account 9999");
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
    const failed = eventCalls().find((c) => c[3].action === "booking_failed");
    expect(failed?.[3].note).toContain("Account 9999");
  });

  it("fails the posting when no open fiscal year follows a locked date", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([
      { startingDate: "2025-01-01", isLocked: true },
    ]);
    finago.listFiscalPeriods.mockResolvedValue([]);

    await expect(postApprovedExpense("exp-1")).rejects.toThrow(
      "No open fiscal year"
    );
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
  });

  describe("receipts without an account", () => {
    function arrangeAttachment(attachment: Record<string, unknown>) {
      finago.getFiscalYearLocks.mockResolvedValue([]);
      finago.listFiscalPeriods.mockResolvedValue([]);
      finago.postExpenseTransaction.mockResolvedValue({
        transactionId: "tx-9",
        shifts: [],
      });
      db.getRow.mockImplementation(async (_d: string, table: string) =>
        table === "user"
          ? { name: "Test Student", email: "t@example.test" }
          : {
              ...expense,
              expenseAttachments: [
                {
                  ...expense.expenseAttachments[0],
                  account_number: null,
                  tax_code: null,
                  ...attachment,
                },
              ],
            }
      );
    }

    it("fails visibly for the student's own type with no account", async () => {
      arrangeAttachment({ cost_type: "", cost_type_text: "Flowers" });

      await expect(postApprovedExpense("exp-1")).rejects.toThrow(
        'Receipt att-1 has no account for the student\'s own type "Flowers"'
      );
      expect(finago.uploadDocument).not.toHaveBeenCalled();
      expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
      expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
        status: "failed",
      });
      const failed = eventCalls().find((c) => c[3].action === "booking_failed");
      expect(failed?.[3].note).toContain("Flowers");
    });

    it("still books a type's slug on the type's account", async () => {
      arrangeAttachment({ cost_type: "travel", cost_type_text: "Flowers" });

      await postApprovedExpense("exp-1");

      const [line] = finago.postExpenseTransaction.mock.calls[0][0].receipts;
      expect(line).toMatchObject({ accountNumber: 7140, ref: "att-1" });
    });

    it("still books an empty type on Other", async () => {
      arrangeAttachment({ cost_type: "", cost_type_text: null });

      await postApprovedExpense("exp-1");

      const [line] = finago.postExpenseTransaction.mock.calls[0][0].receipts;
      expect(line).toMatchObject({ accountNumber: 6555, ref: "att-1" });
    });
  });

  describe("booked examples", () => {
    const withExampleFields = {
      ...expense,
      expenseAttachments: [
        {
          ...expense.expenseAttachments[0],
          file_hash: "hash-1",
          description: "Pizza night",
          cost_type: "food",
          cost_type_text: null,
          ai_cost_type: "food",
          ai_confidence: 0.9,
          account_source: "approver",
        },
        {
          ...expense.expenseAttachments[1],
          file_hash: null,
        },
      ],
    };

    function arrangeBooked() {
      finago.getFiscalYearLocks.mockResolvedValue([]);
      finago.listFiscalPeriods.mockResolvedValue([]);
      finago.postExpenseTransaction.mockResolvedValue({
        transactionId: "tx-9",
        shifts: [],
      });
      db.getRow.mockImplementation(async (_d: string, table: string) =>
        table === "user"
          ? { name: "Test Student", email: "t@example.test" }
          : withExampleFields
      );
      scans.findScan.mockResolvedValue({
        receipt: { vendor: "Pizzabakeren", description: "Two pizzas" },
      });
      examples.writeExamples.mockResolvedValue(undefined);
    }

    it("writes one example per posted receipt", async () => {
      arrangeBooked();

      await postApprovedExpense("exp-1");

      expect(scans.findScan).toHaveBeenCalledTimes(1);
      expect(scans.findScan).toHaveBeenCalledWith(db, "hash-1");
      expect(examples.writeExamples).toHaveBeenCalledWith(db, [
        {
          accountNumber: 7140,
          aiConfidence: 0.9,
          aiCostType: "food",
          amount: 100,
          description: "Two pizzas",
          finalCostType: "food",
          finalText: null,
          source: "approver",
          vendor: "Pizzabakeren",
        },
      ]);
    });

    it("never takes the student's description without a stored scan", async () => {
      arrangeBooked();
      scans.findScan.mockResolvedValue(null);

      await postApprovedExpense("exp-1");

      const rows = examples.writeExamples.mock.calls[0][1];
      expect(rows[0].description).toBe("");
      expect(rows[0].vendor).toBeNull();
    });

    it("learns from an old app's type only when the AI was sure of it", async () => {
      arrangeBooked();
      const legacy = (id: string, over: Record<string, unknown>) => ({
        ...expense.expenseAttachments[0],
        $id: id,
        account_source: "type",
        cost_type: "social",
        file_hash: `hash-${id}`,
        type_source: "legacy_app",
        ...over,
      });
      db.getRow.mockImplementation(async (_d: string, table: string) =>
        table === "user"
          ? { name: "Test Student", email: "t@example.test" }
          : {
              ...expense,
              expenseAttachments: [
                legacy("agreed", {
                  ai_confidence: 0.8,
                  ai_cost_type: "social",
                }),
                legacy("unsure", {
                  ai_confidence: 0.7,
                  ai_cost_type: "social",
                }),
                legacy("other-type", {
                  ai_confidence: 0.95,
                  ai_cost_type: "travel",
                }),
                legacy("no-ai", { ai_confidence: null, ai_cost_type: null }),
              ],
            }
      );

      await postApprovedExpense("exp-1");

      expect(scans.findScan).toHaveBeenCalledTimes(1);
      expect(scans.findScan).toHaveBeenCalledWith(db, "hash-agreed");
      const rows = examples.writeExamples.mock.calls[0][1];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        aiConfidence: 0.8,
        aiCostType: "social",
        finalCostType: "social",
      });
    });

    it("keeps success when example writes fail", async () => {
      arrangeBooked();
      scans.findScan.mockRejectedValue(new Error("scan lookup down"));
      examples.writeExamples.mockRejectedValue(new Error("appwrite down"));

      await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
      expect(db.updateRow).toHaveBeenCalledWith(
        "app",
        "expense",
        "exp-1",
        expect.objectContaining({ status: "success" })
      );
      expect(db.updateRow).not.toHaveBeenCalledWith(
        "app",
        "expense",
        "exp-1",
        expect.objectContaining({ status: "failed" })
      );
    });
  });
});
