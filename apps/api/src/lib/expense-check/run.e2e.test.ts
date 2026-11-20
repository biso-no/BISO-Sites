// The check end to end: the agent and its apply, the fixed steps and the
// notification run against one in-memory database, with a scripted model.
// Only the outermost I/O is faked: Appwrite Messaging, file storage, the PDF
// renderer's output and, on the approval path, the chain's delivery. That
// path stops at `ensureApprovalChain`, where the approver card it would send
// (`loadApprovalCardDetails`) is built from what the check stored.

import type { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  db: null as unknown,
  messaging: { createEmail: vi.fn() },
  storage: { createFile: vi.fn(), getFileDownload: vi.fn() },
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: io.db,
    messaging: io.messaging,
    storage: io.storage,
  })),
}));

/** The agent's script for this test, and the fast model's account choice. */
const models = vi.hoisted(() => ({
  account: { accountNumber: 7420, confidence: 0.9, reason: "A gift" },
  agent: null as MockLanguageModelV4 | null,
}));
vi.mock("@repo/ai/models", async () => {
  const { MockLanguageModelV4: Mock } = await import("ai/test");
  const { STEP_USAGE } = await import("./test-support");
  return {
    balancedModel: new Mock({
      doGenerate: (options) => {
        if (!models.agent) {
          throw new Error("No agent script for this test");
        }
        return models.agent.doGenerate(options);
      },
    }),
    fastModel: new Mock({
      doGenerate: async () => ({
        content: [{ text: JSON.stringify(models.account), type: "text" }],
        finishReason: { raw: undefined, unified: "stop" },
        usage: STEP_USAGE,
        warnings: [],
      }),
    }),
    MODEL_IDS: { balanced: "balanced-test", fast: "fast-test" },
  };
});

const flags = vi.hoisted(
  () =>
    ({
      expenses_ledger_posting: false,
      expenses_module: true,
      expenses_ocr: true,
    }) as Record<string, boolean>
);
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({ ...flags })),
  isFeatureEnabled: vi.fn(async (key: string) => flags[key] ?? false),
}));

const TODAY = "2026-11-19";
vi.mock("../receipt-date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../receipt-date")>()),
  todayInOslo: () => TODAY,
}));

/** The approval chain's boundary: what the first approver's card would say. */
const chain = vi.hoisted(() => ({ cards: [] as { hints: string[] }[] }));
vi.mock("../expense-approval", async () => {
  const { loadApprovalCardDetails } = await import("../expense-card-details");
  class ApprovalChainFailedError extends Error {}
  return {
    ApprovalChainFailedError,
    ensureApprovalChain: vi.fn(async (context: { expenseId: string }) => {
      chain.cards.push(
        await loadApprovalCardDetails(io.db as never, context.expenseId)
      );
    }),
  };
});

vi.mock("../pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => Buffer.from("%PDF")),
}));
vi.mock("@repo/api/file", () => ({
  InputFile: { fromBuffer: vi.fn(() => ({ file: "pdf" })) },
}));

import { generateExpensePdf } from "../pdf/expense-pdf";
import { runExpenseCheck } from "./run";
import { memoryDb, scriptedModel } from "./test-support";

type Row = Record<string, unknown> & { $id: string };

const MAX_HINTS_CHARS = 4000;
/** After BBL 2026 (10 June), so the next edition, BBL 2027, is not in Finago. */
const RECEIPT_DAY = "2026-09-15T10:00:00.000+00:00";
const OWN_TEXT_ID = "r12";
const RECEIPT_IDS = Array.from({ length: 12 }, (_, index) => `r${index + 1}`);
/** Longer than any stored reason, as a model may write it. */
const LONG_REASON =
  "The receipt lists race bibs and timing chips, which fit the food type only loosely; the upload AI picked food and nothing on the receipt says what the bibs were for, so a person should look at the type before it is booked.";
const NOT_CREATED_EN = "The project for BBL 2027 has not been created yet.";
const NOT_CREATED_NB = "Prosjektet for BBL 2027 er ikke opprettet ennå.";
const ACCOUNT_DOUBT_EN = "The AI was not sure which account to use.";
const ACCOUNT_DOUBT_NB = "AI var usikker på hvilken konto som skulle brukes.";

/** A receipt the upload AI typed as food, or the student's own text. */
function receiptRow(id: string): Row {
  const index = Number(id.slice(1));
  const own = id === OWN_TEXT_ID;
  return {
    $id: id,
    account_number: own ? null : 7350,
    account_source: own ? null : "type",
    ai_confidence: 0.85,
    ai_cost_type: "food",
    amount: 100 + index,
    cost_type: own ? null : "food",
    cost_type_text: own ? "Gave til foredragsholder" : null,
    date: RECEIPT_DAY,
    description: own ? "Gift" : `Race kit ${index}`,
    expense_id: "expense-1",
    file_hash: `hash-${id}`,
    project_confidence: null,
    project_id: null,
    project_name: null,
    project_source: null,
    sort_order: index,
    tax_code: 1,
    type: "image/jpeg",
    type_source: own ? "student" : "ai",
    url: `file-${id}`,
  };
}

function scanRow(receipt: Row): Row {
  return {
    $id: `scan-${receipt.$id}`,
    file_hash: receipt.file_hash,
    result: JSON.stringify({
      amountInNok: receipt.amount,
      classification: { confidence: 0.85, costType: "food", reason: "Food" },
      exchangeRate: null,
      receipt: {
        address: null,
        amount: receipt.amount,
        category: null,
        city: "Bergen",
        country: "Norway",
        currency: "NOK",
        date: "2026-09-15",
        description: "Race kit",
        documentType: "receipt",
        purchaseContext: null,
        receiptIssues: ["missing_seller"],
        vendor: "Sport shop",
      },
    }),
  };
}

function costType(slug: string, account: number): Row {
  return {
    $id: slug,
    account_number: account,
    active: true,
    ask_occasion: false,
    description: null,
    label: slug[0]?.toUpperCase() + slug.slice(1),
    label_no: null,
    ocr_category: null,
    slug,
    sort_order: 0,
    tax_code: 1,
  };
}

function ledgerAccount(number: number, name: string): Row {
  return {
    $id: `acc-${number}`,
    account_number: number,
    active: true,
    name,
    tax_code: 5,
  };
}

/**
 * The submitted expense as the submit left it, in a database that reads the
 * expense's relations from their own tables, as Appwrite does, so every
 * step sees what the steps before it wrote.
 */
function submitted(receiptIds: string[]) {
  const receipts = receiptIds.map(receiptRow);
  const tables: Record<string, Row[]> = {
    campus: [{ $id: "3", name: "Bergen" }],
    departments: [
      { $id: "dept-1", Name: "Bergensbaneløpet", project_share: 0.9 },
    ],
    events: [],
    expense: [
      {
        $id: "expense-1",
        $sequence: 42,
        approver_hints: "[]",
        campus: "3",
        check_claim: 0,
        check_finished_at: null,
        check_started_at: null,
        check_state: "queued",
        department: "dept-1",
        description: "Kit for the race",
        event_id: null,
        eventName: null,
        occasion: "Race weekend",
        status: "pending",
        submitter_is_controller: false,
        submitter_is_financial_manager: false,
        total: receipts.reduce((sum, row) => sum + Number(row.amount), 0),
        userId: "user-1",
      },
    ],
    expense_attachments: receipts,
    expense_cost_types: [costType("food", 7350)],
    expense_events: [],
    expense_receipt_scans: receipts.map(scanRow),
    finago_project_usage: [
      {
        $id: "p-bbl26-dept-1",
        department_id: "dept-1",
        first_line_date: "2025-09-01",
        last_line_date: "2026-09-01",
        line_count: 40,
        project_id: "p-bbl26",
        synced_at: null,
      },
    ],
    finago_projects: [
      {
        $id: "p-bbl26",
        active: true,
        event_date: "2026-06-10",
        first_line_date: null,
        last_line_date: null,
        line_count: 50,
        name: "BBL 2026",
        peak_date: null,
        project_id: "p-bbl26",
        series: null,
        synced_at: null,
        year: 2026,
      },
    ],
    ledger_accounts: [
      ledgerAccount(7350, "Møtemat"),
      ledgerAccount(7420, "Gaver"),
      ledgerAccount(6800, "Kontorrekvisita"),
    ],
    user: [
      {
        $id: "user-1",
        address: "Street 1",
        bank_account: "12345678903",
        city: "Bergen",
        email: "ada@example.com",
        name: "Ada Lovelace",
        phone: "12345678",
        zip: "5000",
      },
    ],
  };
  const store = memoryDb(tables);
  const rowOf = (table: string, rowId: unknown) =>
    tables[table]?.find((row) => row.$id === rowId) ?? null;
  const counter =
    (sign: 1 | -1) =>
    ({
      column,
      rowId,
      tableId,
      value,
    }: {
      column: string;
      rowId: string;
      tableId: string;
      value: number;
    }) => {
      const row = rowOf(tableId, rowId);
      if (!row) {
        return Promise.reject(new Error(`${tableId}/${rowId} not found`));
      }
      row[column] = Number(row[column] ?? 0) + sign * value;
      return Promise.resolve(structuredClone(row));
    };
  let created = 0;
  const db = {
    ...store.db,
    // Appwrite stamps each new row; history is ordered by it.
    createRow: (
      database: string,
      table: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      created += 1;
      const $createdAt = new Date(
        Date.parse(`${TODAY}T12:00:00.000Z`) + created
      ).toISOString();
      return store.db.createRow(database, table, rowId, {
        ...data,
        $createdAt,
      });
    },
    decrementRowColumn: counter(-1),
    deleteRow: (_database: string, table: string, rowId: string) => {
      tables[table] = (tables[table] ?? []).filter((row) => row.$id !== rowId);
      return Promise.resolve({});
    },
    getRow: async (database: string, table: string, rowId: string) => {
      const row = await store.db.getRow(database, table, rowId);
      if (table !== "expense") {
        return row;
      }
      return structuredClone({
        ...row,
        campusRel: rowOf("campus", row.campus),
        departmentRel: rowOf("departments", row.department),
        expenseAttachments: (tables.expense_attachments ?? []).filter(
          (receipt) => receipt.expense_id === rowId
        ),
        user: rowOf("user", row.userId),
      });
    },
    incrementRowColumn: counter(1),
  };
  io.db = db;
  return { ...store, db, rowOf };
}

/** What the agent answers: food kept but doubted, and last year's BBL. */
function agentAnswer(receiptIds: string[]) {
  return {
    flags: receiptIds.includes(OWN_TEXT_ID)
      ? [
          {
            code: "account_unsure",
            note: "7420 gifts or 6800 office supplies?",
            receiptId: OWN_TEXT_ID,
          },
        ]
      : [],
    receipts: receiptIds.map((receiptId) =>
      receiptId === OWN_TEXT_ID
        ? {
            confidence: { project: 0.9 },
            projectId: "p-bbl26",
            reason: "A gift for the race's speaker.",
            receiptId,
          }
        : {
            confidence: { project: 0.9, type: 0.5 },
            projectId: "p-bbl26",
            reason: LONG_REASON,
            receiptId,
            type: "food",
          }
    ),
  };
}

interface StoredHint {
  attachmentId?: string;
  code: string;
  data?: Record<string, unknown>;
}

function storedHints(store: ReturnType<typeof submitted>): StoredHint[] {
  const json = String(store.rowOf("expense", "expense-1")?.approver_hints);
  return JSON.parse(json) as StoredHint[];
}

function times(text: string, part: string): number {
  return text.split(part).length - 1;
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.cards.length = 0;
  flags.expenses_ledger_posting = false;
  io.messaging.createEmail.mockResolvedValue({});
  let files = 0;
  io.storage.createFile.mockImplementation(() => {
    files += 1;
    return Promise.resolve({ $id: `pdf-${files}` });
  });
  vi.stubEnv("INVOICE_USER_ID", "invoice-user");
  for (const method of ["info", "warn", "error", "log"] as const) {
    vi.spyOn(console, method).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the check end to end", () => {
  it("email path: every flag reaches accounting, and none reaches the student", async () => {
    const store = submitted(RECEIPT_IDS);
    models.agent = scriptedModel([
      { calls: [{ input: agentAnswer(RECEIPT_IDS), name: "finish_check" }] },
    ]);

    expect(await runExpenseCheck("expense-1")).toBe("done");

    // Every flag is stored, within the column.
    const hints = storedHints(store);
    expect(
      String(store.rowOf("expense", "expense-1")?.approver_hints).length
    ).toBeLessThanOrEqual(MAX_HINTS_CHARS);
    expect(
      hints
        .filter((hint) => hint.code === "project_not_created")
        .map((hint) => hint.attachmentId)
    ).toEqual(RECEIPT_IDS);
    expect(hints).toContainEqual({
      attachmentId: OWN_TEXT_ID,
      code: "ai_account_unsure",
    });

    // Accounting's email and cover sheet carry them.
    const [toAccounting, toStudent] = io.messaging.createEmail.mock.calls.map(
      ([email]) => email as { content: string; users: string[] }
    );
    expect(toAccounting?.users).toEqual(["invoice-user"]);
    expect(times(toAccounting?.content ?? "", NOT_CREATED_EN)).toBe(12);
    expect(toAccounting?.content).toContain(ACCOUNT_DOUBT_EN);
    const [accountingSheet, studentSheet] = vi
      .mocked(generateExpensePdf)
      .mock.calls.map(([data]) => data);
    expect(
      accountingSheet?.flags?.filter((flag) => flag.includes(NOT_CREATED_NB))
    ).toHaveLength(12);
    expect(
      accountingSheet?.flags?.some((flag) => flag.includes(ACCOUNT_DOUBT_NB))
    ).toBe(true);

    // The student's copy has none of it.
    expect(toStudent?.users).toEqual(["user-1"]);
    expect(studentSheet).not.toHaveProperty("flags");
    expect(toStudent?.content).not.toContain("BBL");
    expect(chain.cards).toEqual([]);
  });

  it("approval path: every flag reaches the approver's card", async () => {
    flags.expenses_ledger_posting = true;
    const store = submitted(RECEIPT_IDS);
    models.agent = scriptedModel([
      { calls: [{ input: agentAnswer(RECEIPT_IDS), name: "finish_check" }] },
    ]);

    expect(await runExpenseCheck("expense-1")).toBe("done");

    expect(chain.cards).toHaveLength(1);
    const [card] = chain.cards;
    expect(
      card?.hints.filter((hint) => hint.includes(NOT_CREATED_EN))
    ).toHaveLength(12);
    expect(card?.hints.some((hint) => hint.includes(ACCOUNT_DOUBT_EN))).toBe(
      true
    );
    expect(io.messaging.createEmail).not.toHaveBeenCalled();
    expect(store.rowOf("expense", "expense-1")).toMatchObject({
      check_state: "done",
    });
  });

  it("an account the check doubted keeps its doubt after the fixed steps choose one", async () => {
    flags.expenses_ledger_posting = true;
    const store = submitted([OWN_TEXT_ID]);
    models.agent = scriptedModel([
      { calls: [{ input: agentAnswer([OWN_TEXT_ID]), name: "finish_check" }] },
    ]);

    expect(await runExpenseCheck("expense-1")).toBe("done");

    // The fixed steps stored their best guess, sure of it...
    expect(store.rowOf("expense_attachments", OWN_TEXT_ID)).toMatchObject({
      account_number: 7420,
      account_source: "ai_freeform",
    });
    // ...and the check's doubt still stands, once, for the approver.
    expect(
      storedHints(store).filter((hint) => hint.code === "ai_account_unsure")
    ).toEqual([{ attachmentId: OWN_TEXT_ID, code: "ai_account_unsure" }]);
    expect(
      chain.cards[0]?.hints.filter((hint) => hint.includes(ACCOUNT_DOUBT_EN))
    ).toHaveLength(1);
  });
});
