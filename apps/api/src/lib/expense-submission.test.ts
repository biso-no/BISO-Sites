import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@repo/ai/models", () => ({ fastModel: "f" }));

import {
  type AttachmentDecisionInput,
  chooseAccountForText,
  computeApproverHints,
  decideAttachment,
} from "./expense-submission";
import type { ExtractedReceipt, StoredScan } from "./receipt-scan";

function type(slug: string, accountNumber: number, taxCode = 0) {
  return { accountNumber, label: slug, slug, taxCode } as CostTypeOption;
}

const types = [
  type("social", 7400, 1),
  type("meeting-food", 7350, 11),
  type("other", 7790),
];

function receipt(over: Partial<ExtractedReceipt> = {}): ExtractedReceipt {
  return {
    address: null,
    amount: 100,
    category: null,
    city: null,
    country: null,
    currency: "NOK",
    date: null,
    description: "Pizza",
    documentType: "receipt",
    purchaseContext: null,
    receiptIssues: [],
    vendor: "Peppes",
    ...over,
  };
}

function scan(
  costType: string | null,
  confidence: number,
  over: Partial<StoredScan> = {}
): StoredScan {
  return {
    amountInNok: 100,
    classification: { confidence, costType, reason: "r" },
    exchangeRate: 1,
    receipt: receipt(),
    ...over,
  };
}

function input(
  over: Partial<AttachmentDecisionInput> = {}
): AttachmentDecisionInput {
  return {
    amount: 100,
    attachmentId: "a1",
    chosen: true,
    clientCostType: null,
    clientText: null,
    date: null,
    isSupportingDoc: false,
    scan: null,
    ...over,
  };
}

describe("decideAttachment", () => {
  it("uses the student's slug and marks it ai when it matches the AI", () => {
    const same = decideAttachment(
      input({ clientCostType: "social", scan: scan("social", 0.9) }),
      types,
      true
    );
    expect(same.costType).toBe("social");
    expect(same.typeSource).toBe("ai");
    const other = decideAttachment(
      input({ clientCostType: "social", scan: scan("meeting-food", 0.9) }),
      types,
      true
    );
    expect(other.costType).toBe("social");
    expect(other.typeSource).toBe("student");
    expect(other.aiCostType).toBe("meeting-food");
    expect(other.aiConfidence).toBe(0.9);
  });

  it("keeps the student's own text and asks for an AI account", () => {
    const d = decideAttachment(
      input({ clientText: "  Flowers  " }),
      types,
      true
    );
    expect(d.costType).toBeNull();
    expect(d.costTypeText).toBe("Flowers");
    expect(d.needsAiAccount).toBe(true);
    expect(d.accountSource).toBeNull();
    expect(d.accountNumber).toBeNull();
    expect(d.hints).toEqual([]);
  });

  it("flags a missing account for own text when the AI is off", () => {
    const d = decideAttachment(input({ clientText: "Flowers" }), types, false);
    expect(d.needsAiAccount).toBe(false);
    expect(d.accountNumber).toBeNull();
    expect(d.hints).toEqual([{ attachmentId: "a1", code: "account_missing" }]);
  });

  it("treats a legacy app payload's type as a suggestion", () => {
    const d = decideAttachment(
      input({
        chosen: false,
        clientCostType: "social",
        scan: scan("meeting-food", 0.9),
      }),
      types,
      true
    );
    expect(d.costType).toBe("meeting-food");
    expect(d.typeSource).toBe("legacy_app");
    expect(d.hints).toEqual([
      {
        attachmentId: "a1",
        code: "app_type_replaced",
        data: { aiType: "meeting-food", appType: "social" },
      },
    ]);
  });

  it("keeps the legacy slug when the AI is unsure", () => {
    const d = decideAttachment(
      input({
        chosen: false,
        clientCostType: "social",
        scan: scan("meeting-food", 0.5),
      }),
      types,
      true
    );
    expect(d.costType).toBe("social");
    expect(d.typeSource).toBe("legacy_app");
    expect(d.hints).toEqual([]);
  });

  it("defaults to other with a hint when nothing was chosen and the AI is unsure", () => {
    const d = decideAttachment(
      input({ scan: scan("social", 0.4) }),
      types,
      true
    );
    expect(d.costType).toBe("other");
    expect(d.typeSource).toBe("student");
    expect(d.hints).toEqual([{ attachmentId: "a1", code: "type_defaulted" }]);
    expect(d.accountNumber).toBe(7790);
  });

  it("flags a missing account when other is not among the types", () => {
    const d = decideAttachment(input(), [type("social", 7400)], true);
    expect(d.costType).toBe("other");
    expect(d.accountNumber).toBeNull();
    expect(d.taxCode).toBeNull();
    expect(d.accountSource).toBeNull();
    expect(d.hints).toEqual([
      { attachmentId: "a1", code: "type_defaulted" },
      { attachmentId: "a1", code: "account_missing" },
    ]);
  });

  it("ignores the stored classification when the AI is off", () => {
    const legacy = decideAttachment(
      input({
        chosen: false,
        clientCostType: "social",
        scan: scan("meeting-food", 0.95),
      }),
      types,
      false
    );
    expect(legacy.costType).toBe("social");
    expect(legacy.hints).toEqual([]);
    expect(legacy.aiCostType).toBeNull();
    expect(legacy.aiConfidence).toBeNull();
    const unchosen = decideAttachment(
      input({ scan: scan("social", 0.95) }),
      types,
      false
    );
    expect(unchosen.costType).toBe("other");
    expect(unchosen.typeSource).toBe("student");
    expect(unchosen.aiCostType).toBeNull();
  });

  it("uses the AI's slug when nothing was chosen and it is confident", () => {
    const d = decideAttachment(
      input({ scan: scan("social", 0.85) }),
      types,
      true
    );
    expect(d.costType).toBe("social");
    expect(d.typeSource).toBe("ai");
    expect(d.hints).toEqual([]);
  });

  it("never uses an AI slug that is not among the active types", () => {
    const d = decideAttachment(
      input({ scan: scan("retired", 0.95) }),
      types,
      true
    );
    expect(d.costType).toBe("other");
    expect(d.hints).toEqual([{ attachmentId: "a1", code: "type_defaulted" }]);
    const legacy = decideAttachment(
      input({
        chosen: false,
        clientCostType: "social",
        scan: scan("retired", 0.95),
      }),
      types,
      true
    );
    expect(legacy.costType).toBe("social");
    expect(legacy.hints).toEqual([]);
  });

  it("snapshots account and tax code from the type", () => {
    const d = decideAttachment(
      input({ clientCostType: "meeting-food" }),
      types,
      true
    );
    expect(d.accountNumber).toBe(7350);
    expect(d.taxCode).toBe(11);
    expect(d.accountSource).toBe("type");
    expect(d.needsAiAccount).toBe(false);
  });

  it("skips supporting documents", () => {
    for (const over of [{ amount: 0 }, { isSupportingDoc: true }]) {
      const d = decideAttachment(
        input({ clientCostType: "social", ...over }),
        types,
        true
      );
      expect(d).toEqual({
        accountNumber: null,
        accountSource: null,
        aiConfidence: null,
        aiCostType: null,
        attachmentId: "a1",
        costType: null,
        costTypeText: null,
        hints: [],
        needsAiAccount: false,
        taxCode: null,
        typeSource: "student",
      });
    }
  });
});

describe("computeApproverHints", () => {
  it("flags amount differs, old receipt, duplicate and receipt issues", () => {
    const hints = computeApproverHints({
      attachments: [
        {
          amount: 120,
          attachmentId: "a1",
          date: "2026-07-01",
          duplicate: { reimbursementNumber: "R-12" },
          scan: scan("social", 0.9, {
            receipt: receipt({ receiptIssues: ["no_items", "unreadable"] }),
          }),
        },
        {
          amount: 0,
          attachmentId: "a2",
          date: "2020-01-01",
          duplicate: null,
          scan: null,
        },
      ],
      decisions: [
        {
          accountNumber: null,
          accountSource: null,
          aiConfidence: null,
          aiCostType: null,
          attachmentId: "a1",
          costType: "other",
          costTypeText: null,
          hints: [{ attachmentId: "a1", code: "type_defaulted" }],
          needsAiAccount: false,
          taxCode: null,
          typeSource: "student",
        },
      ],
      today: "2026-11-11",
    });
    expect(hints).toEqual([
      {
        attachmentId: "a1",
        code: "amount_differs",
        data: { entered: 120, read: 100 },
      },
      { attachmentId: "a1", code: "old_receipt", data: { days: 133 } },
      {
        attachmentId: "a1",
        code: "possible_duplicate",
        data: { reimbursementNumber: "R-12" },
      },
      {
        attachmentId: "a1",
        code: "receipt_issue",
        data: { issue: "no_items" },
      },
      {
        attachmentId: "a1",
        code: "receipt_issue",
        data: { issue: "unreadable" },
      },
      { attachmentId: "a1", code: "type_defaulted" },
    ]);
  });

  it("accepts Appwrite datetimes and skips unconverted foreign amounts", () => {
    const attachment = (id: string, date: string) => ({
      amount: 100,
      attachmentId: id,
      date,
      duplicate: null,
      scan: scan("social", 0.9),
    });
    const hints = computeApproverHints({
      attachments: [
        attachment("a1", "2026-07-01T00:00:00.000+00:00"),
        attachment("a2", "2026-06-30T22:00:00.000Z"),
        {
          ...attachment("a3", "2026-11-01"),
          amount: 500,
          scan: scan("social", 0.9, {
            amountInNok: null,
            receipt: receipt({ amount: 40, currency: "EUR" }),
          }),
        },
      ],
      decisions: [],
      today: "2026-11-11",
    });
    expect(hints).toEqual([
      { attachmentId: "a1", code: "old_receipt", data: { days: 133 } },
      { attachmentId: "a2", code: "old_receipt", data: { days: 133 } },
    ]);
  });

  it("stays quiet within the tolerances", () => {
    const hints = computeApproverHints({
      attachments: [
        {
          amount: 101,
          attachmentId: "a1",
          date: "2026-08-13",
          duplicate: null,
          scan: scan("social", 0.9),
        },
      ],
      decisions: [],
      today: "2026-11-11",
    });
    expect(hints).toEqual([]);
  });
});

describe("chooseAccountForText", () => {
  const accounts = [
    { accountNumber: 7400, name: "Social", taxCode: 1 },
    { accountNumber: 7790, name: "Other", taxCode: 0 },
  ];

  beforeEach(() => {
    generateObject.mockReset();
  });

  it("returns a listed account", async () => {
    generateObject.mockResolvedValue({
      object: { accountNumber: 7400, confidence: 0.7, reason: "fits" },
    });
    const result = await chooseAccountForText({
      accounts,
      receipt: receipt(),
      text: "Flowers",
      types,
    });
    expect(result).toEqual({
      accountNumber: 7400,
      confidence: 0.7,
      reason: "fits",
    });
  });

  it("rejects an account not in the list", async () => {
    generateObject.mockResolvedValue({
      object: { accountNumber: 1234, confidence: 0.9, reason: "x" },
    });
    expect(
      await chooseAccountForText({
        accounts,
        receipt: null,
        text: "Flowers",
        types,
      })
    ).toBeNull();
  });

  it("returns null without a model call when there are no accounts", async () => {
    expect(
      await chooseAccountForText({
        accounts: [],
        receipt: null,
        text: "Flowers",
        types,
      })
    ).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns null when the model fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    generateObject.mockRejectedValue(new Error("boom"));
    expect(
      await chooseAccountForText({
        accounts,
        receipt: null,
        text: "Flowers",
        types,
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("caps the reason length", async () => {
    generateObject.mockResolvedValue({
      object: { accountNumber: 7400, confidence: 0.5, reason: "x".repeat(500) },
    });
    const result = await chooseAccountForText({
      accounts,
      receipt: null,
      text: "Flowers",
      types,
    });
    expect(result?.reason).toHaveLength(300);
  });
});
