import { ExpensesStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { buildExpenseRowInput, parseExpensePayload } from "./expense-payload";

describe("expense payload helpers", () => {
  it("normalizes a draft payload into an Appwrite expense row", () => {
    const payload = parseExpensePayload({
      bank_account: "1234 56 78901",
      campus: "oslo",
      department: "marketing",
      description: "Team lunch",
      expenseAttachments: [
        {
          amount: "199.50",
          date: "2026-04-28",
          description: "Lunch receipt",
          type: "image/jpeg",
          url: "file-id",
        },
      ],
      total: "199.50",
    });

    expect(payload).not.toBeNull();

    const row = buildExpenseRowInput(payload!, "user-id", ExpensesStatus.DRAFT);

    expect(row).toMatchObject({
      bank_account: "1234 56 78901",
      campus: "oslo",
      campusRel: "oslo",
      department: "marketing",
      departmentRel: "marketing",
      description: "Team lunch",
      status: ExpensesStatus.DRAFT,
      total: 199.5,
      user: "user-id",
      userId: "user-id",
    });
    expect(row.expenseAttachments).toEqual([
      {
        amount: 199.5,
        cost_type: "",
        date: "2026-04-28",
        description: "Lunch receipt",
        sort_order: 0,
        type: "image/jpeg",
        url: "file-id",
      },
    ]);
  });

  it("rejects payloads missing fields required by the expense table", () => {
    expect(parseExpensePayload({ campus: "oslo" })).toBeNull();
  });
});
