import { ExpensesStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  parseExpensePayload,
  receiptFileId,
  receiptFileIds,
} from "./expense-payload";

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
        cost_type: "other",
        date: "2026-04-28",
        description: "Lunch receipt",
        sort_order: 0,
        type: "image/jpeg",
        url: "file-id",
      },
    ]);
  });

  it("normalizes an empty cost_type to the 'other' slug", () => {
    const payload = parseExpensePayload({
      bank_account: "1234 56 78901",
      campus: "oslo",
      department: "marketing",
      expenseAttachments: [
        { amount: "50", cost_type: "", type: "application/pdf", url: "f1" },
      ],
      total: "50",
    });
    expect(payload?.expenseAttachments?.[0]?.cost_type).toBe("other");
  });

  it("rejects payloads missing fields required by the expense table", () => {
    expect(parseExpensePayload({ campus: "oslo" })).toBeNull();
  });

  it("grants the submitter read access only, so an expense cannot be edited through Appwrite", () => {
    expect(buildExpenseRowPermissions("user-id")).toEqual([
      'read("user:user-id")',
    ]);
  });

  it("resolves attachment urls to storage file ids, once each", () => {
    expect(
      receiptFileIds([
        { url: "file-1" },
        { url: "file-1" },
        {
          url: "https://appwrite.biso.no/v1/storage/buckets/expenses/files/x/view",
        },
        { url: "" },
        { url: null },
        { url: " file-2 " },
      ])
    ).toEqual(["file-1", "x", "file-2"]);
    expect(receiptFileIds(undefined)).toEqual([]);
  });

  it("reads the same file id out of a bare id and the view url that wraps it", () => {
    // Older rows stored the full view URL. Both forms have to resolve to one
    // id, or a reference check comparing raw strings misses the legacy row.
    expect(receiptFileId("file-1")).toBe("file-1");
    expect(receiptFileId(" file-1 ")).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-1/view?project=biso"
      )
    ).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-1/preview"
      )
    ).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file%2D1/download"
      )
    ).toBe("file-1");
  });

  it("resolves nothing for values that name no file", () => {
    expect(receiptFileId(null)).toBeNull();
    expect(receiptFileId("")).toBeNull();
    expect(receiptFileId("   ")).toBeNull();
    expect(receiptFileId("https://example.com/not-a-receipt.png")).toBeNull();
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/has spaces/view"
      )
    ).toBeNull();
  });
});
