import { ExpensesStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  mergeLegacyAttachmentTypes,
  parseExpensePayload,
  receiptFileId,
  receiptFileIds,
} from "./expense-payload";

const BASE = {
  bank_account: "1234 56 78901",
  campus: "oslo",
  department: "marketing",
  total: "100",
};

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
        cost_type_text: null,
        date: "2026-04-28",
        description: "Lunch receipt",
        sort_order: 0,
        type: "image/jpeg",
        url: "file-id",
      },
    ]);
    expect(row.occasion).toBeNull();
    expect(row.event_id).toBeNull();
  });

  it("keeps an empty cost_type when cost_type_chosen is sent", () => {
    const payload = parseExpensePayload({
      ...BASE,
      event_id: "event-1",
      expenseAttachments: [
        {
          amount: "50",
          cost_type: "",
          cost_type_chosen: true,
          cost_type_text: "  Flowers for the speaker  ",
          url: "f1",
        },
        { amount: "20", cost_type_chosen: true, url: "f2" },
      ],
      occasion: "Board meeting, 6 people",
    });
    expect(payload).not.toBeNull();
    expect(payload?.expenseAttachments?.[0]?.cost_type).toBe("");
    expect(payload?.expenseAttachments?.[1]?.cost_type).toBe("");

    const row = buildExpenseRowInput(payload!, "user-id");
    expect(row.occasion).toBe("Board meeting, 6 people");
    expect(row.event_id).toBe("event-1");
    expect(row.expenseAttachments[0]).toMatchObject({
      cost_type: "",
      cost_type_text: "Flowers for the speaker",
    });
    expect(row.expenseAttachments[1]?.cost_type_text).toBeNull();
    // Whether the type was chosen steers the submission; it is never stored.
    expect(row.expenseAttachments[0]).not.toHaveProperty("cost_type_chosen");
  });

  it("defaults cost_type to other for a legacy payload", () => {
    const payload = parseExpensePayload({
      ...BASE,
      expenseAttachments: [
        { amount: "50", url: "f1" },
        { amount: "20", cost_type: "", url: "f2" },
        { amount: "30", cost_type: "social", url: "f3" },
      ],
    });
    expect(
      payload?.expenseAttachments?.map((attachment) => attachment.cost_type)
    ).toEqual(["other", "other", "social"]);
  });

  it("rejects an own type text or an occasion over the column limits", () => {
    expect(
      parseExpensePayload({
        ...BASE,
        expenseAttachments: [
          {
            amount: 1,
            cost_type_chosen: true,
            cost_type_text: "x".repeat(121),
          },
        ],
      })
    ).toBeNull();
    expect(
      parseExpensePayload({ ...BASE, occasion: "x".repeat(1001) })
    ).toBeNull();
    expect(
      parseExpensePayload({ ...BASE, event_id: "x".repeat(65) })
    ).toBeNull();
  });

  it("ignores AI fields sent by the client", () => {
    const payload = parseExpensePayload({
      ...BASE,
      approver_hints: "[]",
      expenseAttachments: [
        {
          account_number: 7310,
          account_source: "type",
          ai_confidence: 0.99,
          ai_cost_type: "social",
          amount: "50",
          cost_type: "social",
          cost_type_chosen: true,
          expense_id: "someone-elses",
          file_hash: "abc",
          ocr_amount: 50,
          receipt_issues: "[]",
          tax_code: 1,
          type_source: "ai",
          url: "f1",
        },
      ],
    });
    const row = buildExpenseRowInput(payload!, "user-id");
    expect(row).not.toHaveProperty("approver_hints");
    expect(Object.keys(row.expenseAttachments[0] ?? {}).sort()).toEqual([
      "amount",
      "cost_type",
      "cost_type_text",
      "date",
      "description",
      "sort_order",
      "type",
      "url",
    ]);
  });

  it("mergeLegacyAttachmentTypes keeps the stored choice for a legacy re-save", () => {
    const payload = parseExpensePayload({
      ...BASE,
      expenseAttachments: [
        // An old app re-saves a web draft: it sends its own default slug.
        { amount: "50", cost_type: "social", url: "file-1" },
        { amount: "20", cost_type: "travel", url: "file-2" },
        // A new client's choice is never overridden.
        {
          amount: "30",
          cost_type: "travel",
          cost_type_chosen: true,
          url: "file-3",
        },
        // A receipt the draft did not have keeps what was sent.
        { amount: "40", cost_type: "academic", url: "file-4" },
        // A stored row without any choice leaves the incoming slug alone.
        { amount: "60", cost_type: "travel", url: "file-5" },
      ],
    });
    const merged = mergeLegacyAttachmentTypes(payload!.expenseAttachments!, [
      { cost_type: "", cost_type_text: "Flowers", url: "file-1" },
      {
        cost_type: "meeting-food",
        cost_type_text: null,
        url: "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-2/view",
      },
      { cost_type: "social", cost_type_text: null, url: "file-3" },
      { cost_type: null, cost_type_text: null, url: "file-5" },
    ]);
    expect(
      merged.map(({ cost_type, cost_type_text }) => ({
        cost_type,
        cost_type_text,
      }))
    ).toEqual([
      { cost_type: "", cost_type_text: "Flowers" },
      { cost_type: "meeting-food", cost_type_text: undefined },
      { cost_type: "travel", cost_type_text: undefined },
      { cost_type: "academic", cost_type_text: undefined },
      { cost_type: "travel", cost_type_text: undefined },
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
