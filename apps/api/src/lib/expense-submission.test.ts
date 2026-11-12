import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@repo/ai/models", () => ({
  balancedModel: "b",
  fastModel: "f",
  MODEL_IDS: { balanced: "balanced-id", fast: "fast-id" },
}));

const flags = vi.hoisted(() => ({ expenses_module: true, expenses_ocr: true }));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({ ...flags })),
}));

const typeStore = vi.hoisted(() => ({
  loadActiveCostTypes: vi.fn(),
  loadAllCostTypes: vi.fn(),
  loadCostAccounts: vi.fn(),
}));
vi.mock("./expense-types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./expense-types")>()),
  ...typeStore,
}));

const scanning = vi.hoisted(() => ({
  classifyReceipt: vi.fn(),
  convertAmountToNok: vi.fn(),
  extractReceipt: vi.fn(),
  findScan: vi.fn(),
  saveScan: vi.fn(),
}));
vi.mock("./receipt-scan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./receipt-scan")>()),
  ...scanning,
}));

const selectExamples = vi.hoisted(() => vi.fn());
vi.mock("./expense-examples", () => ({ selectExamples }));

const findPossibleDuplicate = vi.hoisted(() => vi.fn());
vi.mock("./expense-duplicates", () => ({ findPossibleDuplicate }));

const recordExpenseEvents = vi.hoisted(() => vi.fn());
vi.mock("./expense-events", () => ({ recordExpenseEvents }));

vi.mock("./receipt-date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./receipt-date")>()),
  todayInOslo: () => "2026-11-11",
}));

import {
  mergeLegacyDraft,
  parseExpensePayload,
  type StoredDraft,
} from "./expense-payload";
import {
  type AttachmentDecisionInput,
  chooseAccountForText,
  computeApproverHints,
  decideAttachment,
  ENRICHMENT_BUDGET_MS,
  enrichSubmission,
  hintsJson,
  OccasionRequiredError,
} from "./expense-submission";
import {
  type ExtractedReceipt,
  type StoredScan,
  sha256Hex,
} from "./receipt-scan";

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

  it("marks the student's slug as theirs when the AI was unsure of it", () => {
    const unsure = decideAttachment(
      input({ clientCostType: "social", scan: scan("social", 0.6) }),
      types,
      true
    );
    expect(unsure.costType).toBe("social");
    expect(unsure.typeSource).toBe("student");
    expect(unsure.aiCostType).toBe("social");
    expect(unsure.aiConfidence).toBe(0.6);
    const retired = decideAttachment(
      input({ clientCostType: "social", scan: scan("social", 0.95) }),
      [type("meeting-food", 7350), type("other", 7790)],
      true
    );
    // "social" is no longer active, so the AI's pick doesn't count either.
    expect(retired.typeSource).toBe("student");
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

  it("keeps a student's own text that a draft merge put on a legacy receipt", () => {
    // Old apps never send own text, so it can only be the student's web choice.
    const d = decideAttachment(
      input({
        chosen: false,
        clientCostType: "",
        clientText: " Flowers ",
        scan: scan("meeting-food", 0.95),
      }),
      types,
      true
    );
    expect(d.costType).toBeNull();
    expect(d.costTypeText).toBe("Flowers");
    expect(d.needsAiAccount).toBe(true);
    expect(d.typeSource).toBe("student");
    expect(d.hints).toEqual([]);
    const off = decideAttachment(
      input({ chosen: false, clientCostType: "", clientText: "Flowers" }),
      types,
      false
    );
    expect(off.costTypeText).toBe("Flowers");
    expect(off.hints).toEqual([
      { attachmentId: "a1", code: "account_missing" },
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
          duplicate: { match: "file", reimbursementNumber: "R-12" },
          fileHash: "hash-1",
          scan: scan("social", 0.9, {
            receipt: receipt({ receiptIssues: ["no_items", "unreadable"] }),
          }),
        },
        {
          amount: 0,
          attachmentId: "a2",
          date: "2020-01-01",
          duplicate: null,
          fileHash: "hash-1",
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
        data: { match: "file", reimbursementNumber: "R-12" },
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
      fileHash: `hash-${id}`,
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
      // Both datetimes are 1 July in Oslo, so a2 repeats a1.
      {
        attachmentId: "a2",
        code: "possible_duplicate",
        data: { match: "date_amount", sameExpense: 1 },
      },
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
          fileHash: null,
          scan: scan("social", 0.9),
        },
      ],
      decisions: [],
      today: "2026-11-11",
    });
    expect(hints).toEqual([]);
  });

  it("flags a receipt that repeats an earlier one in the same submission", () => {
    const attachment = (id: string, over: Record<string, unknown> = {}) => ({
      amount: 100,
      attachmentId: id,
      date: "2026-11-01T00:00:00.000+00:00",
      duplicate: null,
      fileHash: `hash-${id}`,
      scan: null,
      ...over,
    });
    const hints = computeApproverHints({
      attachments: [
        // A bank statement: never a receipt that pays out twice.
        attachment("a0", { amount: 0, fileHash: "same" }),
        attachment("a1", { fileHash: "same" }),
        // The same file again, another day and amount.
        attachment("a2", {
          amount: 250,
          date: "2026-10-30T00:00:00.000+00:00",
          fileHash: "same",
        }),
        // Another file, the same Oslo day and amount (within 0.01).
        attachment("a3", { amount: 100.01, date: "2026-10-31T23:30:00.000Z" }),
        // The same day, a different amount.
        attachment("a4", { amount: 100.5 }),
      ],
      decisions: [],
      today: "2026-11-11",
    });
    expect(hints).toEqual([
      {
        attachmentId: "a2",
        code: "possible_duplicate",
        data: { match: "file", sameExpense: 1 },
      },
      {
        attachmentId: "a3",
        code: "possible_duplicate",
        data: { match: "date_amount", sameExpense: 1 },
      },
    ]);
  });

  it("keeps both duplicate hints for a receipt in another and this reimbursement", () => {
    const hints = computeApproverHints({
      attachments: [
        {
          amount: 100,
          attachmentId: "a1",
          date: null,
          duplicate: null,
          fileHash: "same",
          scan: null,
        },
        {
          amount: 100,
          attachmentId: "a2",
          date: null,
          duplicate: { match: "date_amount", reimbursementNumber: "10042" },
          fileHash: "same",
          scan: null,
        },
      ],
      decisions: [],
      today: "2026-11-11",
    });
    expect(hints).toEqual([
      {
        attachmentId: "a2",
        code: "possible_duplicate",
        data: { match: "date_amount", reimbursementNumber: "10042" },
      },
      {
        attachmentId: "a2",
        code: "possible_duplicate",
        data: { match: "file", sameExpense: 1 },
      },
    ]);
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

const liveTypes = [
  {
    accountNumber: 7310,
    askOccasion: false,
    label: "Social",
    slug: "social",
    sortOrder: 0,
  },
  {
    accountNumber: 7360,
    askOccasion: true,
    label: "Meeting food",
    slug: "meeting-food",
    sortOrder: 1,
    taxCode: 0,
  },
  {
    accountNumber: 6555,
    label: "Other",
    slug: "other",
    sortOrder: 2,
    taxCode: 0,
  },
] as CostTypeOption[];

/** Every type as loaded: the active ones and a retired one. */
const allTypes = [
  {
    accountNumber: 7999,
    active: false,
    askOccasion: true,
    label: "Retired",
    slug: "retired",
    sortOrder: 3,
  },
  ...liveTypes,
] as CostTypeOption[];

function fileBytes(fileId: string): ArrayBuffer {
  return new TextEncoder().encode(`bytes of ${fileId}`).buffer as ArrayBuffer;
}

function hashOf(fileId: string): string {
  return sha256Hex(Buffer.from(fileBytes(fileId)));
}

interface RowOver {
  $id?: string;
  amount?: number;
  cost_type?: string;
  cost_type_chosen?: boolean;
  cost_type_text?: string;
  url?: string;
}

/**
 * A submission as the route hands it over: the parsed payload and the saved
 * draft read back, whose attachment rows were built from that payload. Each
 * row is dated a day after the one before, so rows of the same amount are not
 * the same receipt.
 */
function submission(
  attachments: RowOver[],
  over: Record<string, unknown> = {},
  storedDraft?: StoredDraft
) {
  const parsed = parseExpensePayload({
    bank_account: "1234 56 78901",
    campus: "oslo",
    department: "marketing",
    expenseAttachments: attachments.map(({ $id: _id, ...attachment }) => ({
      amount: 100,
      date: "2026-11-01",
      type: "image/jpeg",
      ...attachment,
    })),
    total: 100,
    ...over,
  });
  if (!parsed) {
    throw new Error("invalid test payload");
  }
  // The submit route merges an old app's payload over the stored draft.
  const payload = storedDraft ? mergeLegacyDraft(parsed, storedDraft) : parsed;
  const expense = {
    $id: "expense-1",
    expenseAttachments: (payload.expenseAttachments ?? []).map(
      (attachment, index) => ({
        $id: attachments[index]?.$id ?? `att-${index + 1}`,
        amount: attachment.amount,
        cost_type: attachment.cost_type,
        cost_type_text: attachment.cost_type_text ?? null,
        date: `2026-11-${String(index + 1).padStart(2, "0")}T00:00:00.000+00:00`,
        type: attachment.type,
        url: attachment.url,
      })
    ),
  };
  return { expense: expense as never, payload };
}

/** The saved draft with the occasion it stored. */
function withOccasion(expense: unknown, occasion: string | null): never {
  return { ...(expense as Record<string, unknown>), occasion } as never;
}

const db = { updateRow: vi.fn() };
const storage = { getFileDownload: vi.fn() };
const admin = { db, storage } as never;

function attachmentWrite(attachmentId: string) {
  const call = db.updateRow.mock.calls.find(
    ([, table, id]) => table === "expense_attachments" && id === attachmentId
  );
  return call?.[3] as Record<string, unknown> | undefined;
}

function expenseWrite() {
  const call = db.updateRow.mock.calls.find(([, table]) => table === "expense");
  return call?.[3] as Record<string, unknown> | undefined;
}

describe("enrichSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateObject.mockReset();
    for (const mock of Object.values(scanning)) {
      mock.mockReset();
    }
    flags.expenses_module = true;
    flags.expenses_ocr = true;
    scanning.extractReceipt.mockResolvedValue(receipt());
    scanning.classifyReceipt.mockResolvedValue({
      confidence: 0.3,
      costType: "social",
      reason: "unsure",
    });
    typeStore.loadAllCostTypes.mockResolvedValue(allTypes);
    typeStore.loadCostAccounts.mockResolvedValue([
      { accountNumber: 7420, name: "Gifts", taxCode: 5 },
    ]);
    scanning.findScan.mockResolvedValue(null);
    scanning.saveScan.mockResolvedValue(undefined);
    scanning.convertAmountToNok.mockResolvedValue({
      amountInNok: null,
      exchangeRate: null,
    });
    selectExamples.mockResolvedValue([]);
    findPossibleDuplicate.mockResolvedValue(null);
    recordExpenseEvents.mockResolvedValue(undefined);
    db.updateRow.mockResolvedValue({});
    storage.getFileDownload.mockImplementation(
      async (_bucket: string, fileId: string) => fileBytes(fileId)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enrichSubmission reuses a stored scan by file hash", async () => {
    scanning.findScan.mockResolvedValue(scan("social", 0.9));
    const { expense, payload } = submission([
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(storage.getFileDownload).toHaveBeenCalledWith("expenses", "file-1");
    expect(scanning.findScan).toHaveBeenCalledWith(db, hashOf("file-1"));
    expect(scanning.extractReceipt).not.toHaveBeenCalled();
    expect(scanning.classifyReceipt).not.toHaveBeenCalled();
    expect(scanning.saveScan).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toEqual({
      account_number: 7310,
      account_source: "type",
      ai_confidence: 0.9,
      ai_cost_type: "social",
      cost_type: "social",
      cost_type_text: null,
      expense_id: "expense-1",
      file_hash: hashOf("file-1"),
      ocr_amount: 100,
      receipt_issues: "[]",
      tax_code: null,
      type_source: "ai",
    });
  });

  it("scans a file with no stored scan when AI is on", async () => {
    const extracted = receipt({
      amount: 40,
      currency: "EUR",
      date: "2026-11-01",
    });
    const classification = {
      confidence: 0.92,
      costType: "social",
      reason: "Party snacks",
    };
    scanning.extractReceipt.mockResolvedValue(extracted);
    scanning.convertAmountToNok.mockResolvedValue({
      amountInNok: 470,
      exchangeRate: 11.75,
    });
    scanning.classifyReceipt.mockResolvedValue(classification);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { expense, payload } = submission([
      { amount: 470, cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(scanning.extractReceipt).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      buffer: Buffer.from(fileBytes("file-1")),
      mimeType: "image/jpeg",
      purpose: "auto",
    });
    expect(selectExamples).toHaveBeenCalledWith(db, {
      types: liveTypes,
      vendor: "Peppes",
    });
    expect(scanning.classifyReceipt).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      examples: [],
      receipt: extracted,
      types: liveTypes,
    });
    // 12 s to read the file, then 8 s to pick its type.
    expect(timeout.mock.calls).toEqual([[12_000], [8000]]);
    // The types are loaded once; the AI is offered only the active ones.
    expect(typeStore.loadAllCostTypes).toHaveBeenCalledTimes(1);
    expect(typeStore.loadActiveCostTypes).not.toHaveBeenCalled();
    expect(scanning.saveScan).toHaveBeenCalledWith(
      db,
      hashOf("file-1"),
      {
        amountInNok: 470,
        classification,
        exchangeRate: 11.75,
        receipt: extracted,
      },
      "balanced-id+fast-id"
    );
    expect(attachmentWrite("att-1")).toMatchObject({
      ai_confidence: 0.92,
      ai_cost_type: "social",
      cost_type: "social",
      ocr_amount: 470,
      type_source: "ai",
    });
  });

  it("does not scan supporting documents or files it cannot read", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    storage.getFileDownload.mockImplementation(
      (_bucket: string, fileId: string) =>
        fileId === "file-2"
          ? Promise.reject(new Error("storage down"))
          : Promise.resolve(fileBytes(fileId))
    );
    scanning.extractReceipt.mockRejectedValue(new Error("model down"));
    const { expense, payload } = submission([
      { amount: 0, cost_type_chosen: true, url: "file-1" },
      { cost_type: "social", cost_type_chosen: true, url: "file-2" },
      { cost_type: "social", cost_type_chosen: true, url: "file-3" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    // A bank statement (amount 0) is hashed but never sent to the model.
    expect(scanning.extractReceipt).toHaveBeenCalledTimes(1);
    expect(attachmentWrite("att-1")).toMatchObject({
      cost_type: null,
      file_hash: hashOf("file-1"),
    });
    expect(attachmentWrite("att-2")).toMatchObject({
      cost_type: "social",
      file_hash: null,
      ocr_amount: null,
    });
    expect(attachmentWrite("att-3")).toMatchObject({
      ai_cost_type: null,
      cost_type: "social",
      file_hash: hashOf("file-3"),
      receipt_issues: null,
    });
    expect(error).toHaveBeenCalled();
  });

  it("uses stored scans but no AI type when AI is off", async () => {
    flags.expenses_ocr = false;
    scanning.findScan.mockImplementation(async (_db: unknown, hash: string) =>
      hash === hashOf("file-1")
        ? scan("meeting-food", 0.95, {
            amountInNok: 80,
            receipt: receipt({ amount: 80, receiptIssues: ["no_items"] }),
          })
        : null
    );
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
      { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-2" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    // Stored scans are read by hash; no model is called for the missing one.
    expect(scanning.findScan).toHaveBeenCalledWith(db, hashOf("file-1"));
    expect(scanning.findScan).toHaveBeenCalledWith(db, hashOf("file-2"));
    expect(scanning.extractReceipt).not.toHaveBeenCalled();
    expect(scanning.classifyReceipt).not.toHaveBeenCalled();
    expect(scanning.saveScan).not.toHaveBeenCalled();
    expect(typeStore.loadCostAccounts).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toMatchObject({
      account_number: 7310,
      account_source: "type",
      ai_confidence: null,
      ai_cost_type: null,
      cost_type: "social",
      file_hash: hashOf("file-1"),
      ocr_amount: 80,
      receipt_issues: JSON.stringify(["no_items"]),
      type_source: "student",
    });
    expect(attachmentWrite("att-2")).toMatchObject({
      account_number: null,
      account_source: null,
      ai_cost_type: null,
      cost_type: null,
      cost_type_text: "Flowers",
      ocr_amount: null,
      receipt_issues: null,
    });
    expect(JSON.parse(String(expenseWrite()?.approver_hints))).toEqual([
      {
        attachmentId: "att-1",
        code: "amount_differs",
        data: { entered: 100, read: 80 },
      },
      {
        attachmentId: "att-1",
        code: "receipt_issue",
        data: { issue: "no_items" },
      },
      { attachmentId: "att-2", code: "account_missing" },
    ]);
    const events = recordExpenseEvents.mock.calls[0]?.[1];
    expect(events.map((event: { action: string }) => event.action)).toEqual([
      "submitted",
    ]);
  });

  it("notes what the submitter declared about themselves", async () => {
    const asController = submission([], {
      campus: "1",
      department: "1",
      submitter_is_controller: true,
    });
    await enrichSubmission(
      admin,
      asController.expense,
      asController.payload,
      "Ada Lovelace"
    );
    const asManager = submission([], {
      campus: "1",
      department: "dept-x",
      submitter_is_financial_manager: true,
    });
    await enrichSubmission(
      admin,
      asManager.expense,
      asManager.payload,
      "Ada Lovelace"
    );

    const notes = recordExpenseEvents.mock.calls.map((call) => call[1][0].note);
    expect(notes).toEqual([
      "Submitter says they are the campus controller",
      "Submitter says they are the department's financial manager",
    ]);
  });

  it("keeps own text and occasion when an old app submits a web draft", async () => {
    scanning.findScan.mockResolvedValue(scan("meeting-food", 0.95));
    generateObject.mockResolvedValue({
      object: { accountNumber: 7420, confidence: 0.9, reason: "Gift" },
    });
    const { expense, payload } = submission(
      // An old app sends its default slug and no occasion.
      [{ cost_type: "social", url: "file-1" }],
      {},
      {
        event_id: "event-1",
        expenseAttachments: [
          { cost_type: "", cost_type_text: "Flowers", url: "file-1" },
        ],
        occasion: "Board meeting",
      }
    );

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(attachmentWrite("att-1")).toMatchObject({
      account_number: 7420,
      account_source: "ai_freeform",
      cost_type: null,
      cost_type_text: "Flowers",
      type_source: "student",
    });
    expect(expenseWrite()).toEqual({
      approver_hints: "[]",
      occasion: "Board meeting",
    });
  });

  it("rejects a missing occasion for a type that asks for one", async () => {
    scanning.findScan.mockResolvedValue(scan("social", 0.4));
    for (const occasion of [undefined, "   "]) {
      const { expense, payload } = submission(
        [
          { cost_type: "meeting-food", cost_type_chosen: true, url: "file-1" },
          { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-2" },
        ],
        { occasion }
      );

      await expect(
        enrichSubmission(admin, expense, payload, "Ada Lovelace")
      ).rejects.toBeInstanceOf(OccasionRequiredError);
    }
    // Rejected before the AI picks an account or duplicates are looked up.
    expect(typeStore.loadCostAccounts).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
    expect(findPossibleDuplicate).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("requires the occasion in a mixed payload", async () => {
    // One receipt carries cost_type_chosen, so the client can ask.
    const { expense, payload } = submission([
      { cost_type: "meeting-food", url: "file-1" },
      { cost_type: "social", cost_type_chosen: true, url: "file-2" },
    ]);

    await expect(
      enrichSubmission(admin, expense, payload, "Ada Lovelace")
    ).rejects.toBeInstanceOf(OccasionRequiredError);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("asks for an occasion when the AI picks a type that needs one", async () => {
    scanning.findScan.mockResolvedValue(scan("meeting-food", 0.9));
    const { expense, payload } = submission([
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await expect(
      enrichSubmission(admin, expense, payload, "Ada Lovelace")
    ).rejects.toBeInstanceOf(OccasionRequiredError);
  });

  it("keeps the stored occasion when a new client leaves it out", async () => {
    scanning.findScan.mockResolvedValue(scan("social", 0.4));
    const { expense, payload } = submission([
      { cost_type: "meeting-food", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(
      admin,
      withOccasion(expense, "Board meeting"),
      payload,
      "Ada Lovelace"
    );

    expect(expenseWrite()).toMatchObject({ occasion: "Board meeting" });
  });

  it("clears the occasion when a new client sends null", async () => {
    const { expense, payload } = submission(
      [{ cost_type: "social", cost_type_chosen: true, url: "file-1" }],
      { occasion: null }
    );

    await enrichSubmission(
      admin,
      withOccasion(expense, "Board meeting"),
      payload,
      "Ada Lovelace"
    );

    expect(expenseWrite()).toMatchObject({ occasion: null });
  });

  it("requires the stored occasion's presence for a type that asks", async () => {
    const { expense, payload } = submission([
      { cost_type: "meeting-food", cost_type_chosen: true, url: "file-1" },
    ]);

    await expect(
      enrichSubmission(
        admin,
        withOccasion(expense, null),
        payload,
        "Ada Lovelace"
      )
    ).rejects.toBeInstanceOf(OccasionRequiredError);
    await expect(
      enrichSubmission(
        admin,
        withOccasion(expense, "   "),
        payload,
        "Ada Lovelace"
      )
    ).rejects.toBeInstanceOf(OccasionRequiredError);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("skips fresh scans that would start after the budget", async () => {
    let clock = 1000;
    storage.getFileDownload.mockImplementation(
      (_bucket: string, fileId: string) => {
        // The downloads count towards the budget.
        clock += ENRICHMENT_BUDGET_MS;
        return Promise.resolve(fileBytes(fileId));
      }
    );
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(
      admin,
      expense,
      payload,
      "Ada Lovelace",
      () => clock
    );

    expect(scanning.findScan).toHaveBeenCalled();
    expect(scanning.extractReceipt).not.toHaveBeenCalled();
    expect(scanning.classifyReceipt).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toMatchObject({ cost_type: "social" });
  });

  it("skips the account choice that would start after the budget", async () => {
    let clock = 0;
    scanning.findScan.mockImplementation(() => {
      clock = ENRICHMENT_BUDGET_MS;
      return Promise.resolve(null);
    });
    const { expense, payload } = submission([
      { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-1" },
    ]);

    await enrichSubmission(
      admin,
      expense,
      payload,
      "Ada Lovelace",
      () => clock
    );

    expect(generateObject).not.toHaveBeenCalled();
    expect(expenseWrite()?.approver_hints).toContain("account_missing");
  });

  it("accepts a legacy app submission without occasion", async () => {
    const { expense, payload } = submission([
      { cost_type: "meeting-food", url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(attachmentWrite("att-1")).toMatchObject({
      cost_type: "meeting-food",
      type_source: "legacy_app",
    });
    expect(expenseWrite()).toEqual({
      approver_hints: JSON.stringify([{ code: "occasion_missing" }]),
      occasion: null,
    });
  });

  it("writes approver hints and history events", async () => {
    scanning.findScan.mockResolvedValue(scan("social", 0.9));
    findPossibleDuplicate.mockImplementation(
      async (_db: unknown, { fileHash }: { fileHash: string | null }) =>
        fileHash === hashOf("file-1")
          ? {
              expenseId: "expense-0",
              match: "file",
              reimbursementNumber: "10042",
            }
          : null
    );
    generateObject.mockResolvedValue({
      object: {
        accountNumber: 7420,
        confidence: 0.6,
        reason: "Gift for a guest",
      },
    });
    const { expense, payload } = submission(
      [
        { cost_type: "social", cost_type_chosen: true, url: "file-1" },
        { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-2" },
        { amount: 0, url: "file-3" },
      ],
      { occasion: "  Board meeting  " }
    );

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(findPossibleDuplicate).toHaveBeenCalledWith(db, {
      amount: 100,
      date: "2026-11-01T00:00:00.000+00:00",
      excludeExpenseId: "expense-1",
      fileHash: hashOf("file-1"),
    });
    expect(attachmentWrite("att-2")).toMatchObject({
      account_number: 7420,
      account_source: "ai_freeform",
      cost_type: null,
      cost_type_text: "Flowers",
      tax_code: 5,
    });
    expect(expenseWrite()).toEqual({
      approver_hints: JSON.stringify([
        {
          attachmentId: "att-1",
          code: "possible_duplicate",
          data: { match: "file", reimbursementNumber: "10042" },
        },
        { attachmentId: "att-2", code: "ai_account_unsure" },
      ]),
      occasion: "Board meeting",
    });
    expect(recordExpenseEvents).toHaveBeenCalledWith(db, [
      {
        action: "submitted",
        actorKind: "student",
        actorName: "Ada Lovelace",
        expenseId: "expense-1",
      },
      {
        action: "ai_classified",
        actorKind: "ai",
        after: "social",
        attachmentId: "att-1",
        expenseId: "expense-1",
        field: "cost_type",
        note: "Confidence 0.90: r",
      },
      {
        action: "ai_account_chosen",
        actorKind: "ai",
        after: "7420",
        attachmentId: "att-2",
        before: "Flowers",
        expenseId: "expense-1",
        field: "account_number",
        note: "Gift for a guest",
      },
    ]);
    // History is written after the receipts and the expense.
    const lastWrite = Math.max(...db.updateRow.mock.invocationCallOrder);
    expect(recordExpenseEvents.mock.invocationCallOrder[0]).toBeGreaterThan(
      lastWrite
    );
  });

  it("flags a missing account when the AI finds none for the student's text", async () => {
    typeStore.loadCostAccounts.mockResolvedValue([]);
    const { expense, payload } = submission([
      { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(attachmentWrite("att-1")).toMatchObject({
      account_number: null,
      account_source: null,
    });
    expect(JSON.parse(String(expenseWrite()?.approver_hints))).toEqual([
      { attachmentId: "att-1", code: "account_missing" },
    ]);
  });

  it("scans the same file only once", async () => {
    scanning.classifyReceipt.mockResolvedValue({
      confidence: 0.9,
      costType: "social",
      reason: "Party",
    });
    // The same receipt uploaded twice: two file ids, the same bytes.
    storage.getFileDownload.mockImplementation(async () =>
      fileBytes("same receipt")
    );
    const { expense, payload } = submission([
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
      { cost_type: "", cost_type_chosen: true, url: "file-2" },
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(storage.getFileDownload).toHaveBeenCalledTimes(2);
    expect(scanning.findScan).toHaveBeenCalledTimes(1);
    expect(scanning.extractReceipt).toHaveBeenCalledTimes(1);
    expect(scanning.saveScan).toHaveBeenCalledTimes(1);
    for (const id of ["att-1", "att-2", "att-3"]) {
      expect(attachmentWrite(id)).toMatchObject({
        ai_cost_type: "social",
        cost_type: "social",
        file_hash: hashOf("same receipt"),
      });
    }
    // The first copy is the receipt; each later one is flagged for the approver.
    expect(JSON.parse(String(expenseWrite()?.approver_hints))).toEqual([
      {
        attachmentId: "att-2",
        code: "possible_duplicate",
        data: { match: "file", sameExpense: 1 },
      },
      {
        attachmentId: "att-3",
        code: "possible_duplicate",
        data: { match: "file", sameExpense: 1 },
      },
    ]);
  });

  it("classifies a stored receipt scan that has no type", async () => {
    const stored = scan("social", 0.9, { classification: null });
    scanning.findScan.mockResolvedValue(stored);
    scanning.classifyReceipt.mockResolvedValue({
      confidence: 0.92,
      costType: "social",
      reason: "Party snacks",
    });
    const { expense, payload } = submission([
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    // Text only: the file is not read again, and the stored row stays.
    expect(scanning.extractReceipt).not.toHaveBeenCalled();
    expect(scanning.classifyReceipt).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      examples: [],
      receipt: stored.receipt,
      types: liveTypes,
    });
    expect(scanning.saveScan).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toMatchObject({
      ai_confidence: 0.92,
      ai_cost_type: "social",
      cost_type: "social",
      type_source: "ai",
    });
  });

  it("classifies no stored bank statement, and nothing with the AI off", async () => {
    scanning.findScan.mockImplementation(async (_db: unknown, hash: string) =>
      scan("social", 0.9, {
        classification: null,
        receipt: receipt({
          documentType:
            hash === hashOf("file-1") ? "bank-statement" : "receipt",
        }),
      })
    );
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
      { cost_type: "social", cost_type_chosen: true, url: "file-2" },
    ]);

    flags.expenses_ocr = false;
    await enrichSubmission(admin, expense, payload, "Ada Lovelace");
    expect(scanning.classifyReceipt).not.toHaveBeenCalled();

    flags.expenses_ocr = true;
    await enrichSubmission(admin, expense, payload, "Ada Lovelace");
    expect(scanning.classifyReceipt).toHaveBeenCalledTimes(1);
    expect(
      scanning.classifyReceipt.mock.calls[0]?.[0].receipt.documentType
    ).toBe("receipt");
  });

  it("keeps the scan untyped when the time limit stops the classification", async () => {
    // Every limit has already run out; the mocked read itself ignores it.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
      AbortSignal.abort()
    );
    scanning.classifyReceipt.mockResolvedValue({
      confidence: 0,
      costType: null,
      reason: null,
    });
    const { expense, payload } = submission([
      { cost_type: "", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    // Stored without a type, so a later pass can still classify the receipt.
    expect(scanning.saveScan).toHaveBeenCalledWith(
      db,
      hashOf("file-1"),
      expect.objectContaining({ classification: null }),
      "balanced-id+fast-id"
    );
    expect(attachmentWrite("att-1")).toMatchObject({
      ai_cost_type: null,
      cost_type: "other",
    });
  });

  it("goes on without a scan when reading the file is stopped", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    scanning.extractReceipt.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError")
    );
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(scanning.classifyReceipt).not.toHaveBeenCalled();
    expect(scanning.saveScan).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toMatchObject({
      cost_type: "social",
      file_hash: hashOf("file-1"),
      ocr_amount: null,
    });
    expect(error).toHaveBeenCalled();
  });

  it("records no AI decision when the student kept a type the AI was unsure of", async () => {
    scanning.findScan.mockResolvedValue(scan("social", 0.6));
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(attachmentWrite("att-1")).toMatchObject({
      ai_confidence: 0.6,
      ai_cost_type: "social",
      type_source: "student",
    });
    const events = recordExpenseEvents.mock.calls[0]?.[1];
    expect(events.map((event: { action: string }) => event.action)).toEqual([
      "submitted",
    ]);
  });

  it("runs at most four downloads and scans at a time", async () => {
    let running = 0;
    let most = 0;
    const track = async <T>(value: T): Promise<T> => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return value;
    };
    storage.getFileDownload.mockImplementation(
      (_bucket: string, fileId: string) => track(fileBytes(fileId))
    );
    scanning.extractReceipt.mockImplementation(() => track(receipt()));
    const { expense, payload } = submission(
      Array.from({ length: 9 }, (_, index) => ({
        cost_type: "social",
        cost_type_chosen: true,
        url: `file-${index + 1}`,
      }))
    );

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(storage.getFileDownload).toHaveBeenCalledTimes(9);
    expect(scanning.extractReceipt).toHaveBeenCalledTimes(9);
    expect(most).toBeLessThanOrEqual(4);
    expect(most).toBeGreaterThan(1);
  });

  it("stores no NOK amount for a foreign receipt it could not convert", async () => {
    scanning.findScan.mockResolvedValue(
      scan("social", 0.9, {
        amountInNok: null,
        receipt: receipt({ amount: 40, currency: "EUR" }),
      })
    );
    const { expense, payload } = submission([
      { cost_type: "social", cost_type_chosen: true, url: "file-1" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(attachmentWrite("att-1")?.ocr_amount).toBeNull();
  });

  it("records the app's slug when the AI replaced it", async () => {
    scanning.findScan.mockResolvedValue(scan("meeting-food", 0.9));
    const { expense, payload } = submission(
      [{ cost_type: "social", url: "file-1" }],
      { occasion: "Board meeting" }
    );

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    const events = recordExpenseEvents.mock.calls[0]?.[1];
    expect(events).toContainEqual({
      action: "ai_classified",
      actorKind: "ai",
      after: "meeting-food",
      attachmentId: "att-1",
      before: "social",
      expenseId: "expense-1",
      field: "cost_type",
      note: "Confidence 0.90: r",
    });
  });

  it("flags a missing account and carries on when the accounts cannot load", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    typeStore.loadCostAccounts.mockRejectedValue(new Error("db down"));
    const { expense, payload } = submission([
      { cost_type_chosen: true, cost_type_text: "Flowers", url: "file-1" },
      { cost_type: "social", cost_type_chosen: true, url: "file-2" },
    ]);

    await enrichSubmission(admin, expense, payload, "Ada Lovelace");

    expect(generateObject).not.toHaveBeenCalled();
    expect(attachmentWrite("att-1")).toMatchObject({
      account_number: null,
      account_source: null,
      cost_type_text: "Flowers",
    });
    expect(attachmentWrite("att-2")).toMatchObject({ account_number: 7310 });
    expect(JSON.parse(String(expenseWrite()?.approver_hints))).toEqual([
      { attachmentId: "att-1", code: "account_missing" },
    ]);
    expect(recordExpenseEvents).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe("hintsJson", () => {
  const issue = (index: number) => ({
    attachmentId: `att-${index}`,
    code: "receipt_issue" as const,
    data: { issue: "missing_seller" },
  });

  it("keeps hints as they are when they fit", () => {
    const hints = [
      issue(1),
      { attachmentId: "att-2", code: "account_missing" as const },
    ];
    expect(hintsJson(hints)).toBe(JSON.stringify(hints));
  });

  it("fits the column and keeps the essential hints first", () => {
    const many = Array.from({ length: 80 }, (_, index) => issue(index));
    const essential = [
      { attachmentId: "att-90", code: "account_missing" as const },
      { code: "occasion_missing" as const },
    ];
    const json = hintsJson([...many, ...essential]);
    const kept = JSON.parse(json);

    expect(json.length).toBeLessThanOrEqual(4000);
    expect(kept.slice(0, 2)).toEqual(essential);
    expect(kept.length).toBeLessThan(many.length + essential.length);
    // What is kept after the essential ones is the start of the rest, in order.
    expect(kept.slice(2)).toEqual(many.slice(0, kept.length - 2));
  });
});
