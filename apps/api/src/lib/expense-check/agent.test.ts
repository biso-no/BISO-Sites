import { tool } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const admin = vi.hoisted(() => ({
  current: null as unknown,
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => admin.current),
}));

import {
  buildCheckPrompt,
  CHECK_MAX_STEPS,
  type CheckAnswer,
  type CheckInput,
  checkWithAgent,
  loadCheckInput,
  runCheckAgent,
} from "./agent";
import {
  memoryDb,
  STEP_USAGE,
  scriptedModel,
  sentToModel,
} from "./test-support";

const TODAY = "2026-11-19";

const INPUT: CheckInput = {
  campus: { id: "1", name: "Oslo" },
  department: {
    id: "dept-1",
    name: "Marketing",
    projectShare: 0.5,
    shareClass: "sometimes",
  },
  event: null,
  expenseId: "expense-1",
  occasion: "Board meeting",
  receipts: [
    {
      amountNok: 250,
      date: "2026-11-01",
      description: "Pizza",
      duplicates: [],
      fileType: "image/jpeg",
      note: null,
      originalCurrency: null,
      ownText: null,
      purchaseContext: null,
      receiptId: "r1",
      receiptIssues: [],
      supportingDocument: false,
      type: null,
      typeSource: null,
      uploadPick: null,
      vendor: "Peppes Pizza",
    },
  ],
  today: TODAY,
  types: [
    { account: 7350, name: "Food", note: null, slug: "food" },
    { account: 7140, name: "Taxi", note: null, slug: "taxi" },
  ],
};

const ANSWER: CheckAnswer = {
  flags: [],
  receipts: [
    {
      confidence: { project: 0.9, type: 0.95 },
      projectId: "none",
      reason: "Pizza for a meeting",
      receiptId: "r1",
      type: "food",
    },
  ],
};

function lookupTool(execute: () => Promise<unknown>) {
  return tool({
    description: "Search accounts",
    execute,
    inputSchema: z.object({ text: z.string() }),
  });
}

function silence() {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

beforeEach(() => {
  silence();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkWithAgent", () => {
  it("lets the model use the tools, then returns its checked answer", async () => {
    const lookup = vi.fn(async () => ({ accounts: [] }));
    const model = scriptedModel([
      { calls: [{ input: { text: "pizza" }, name: "search_accounts" }] },
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    const answer = await checkWithAgent(INPUT, {
      deadlineMs: 5000,
      model,
      tools: { search_accounts: lookupTool(lookup) },
    });

    expect(answer).toEqual(ANSWER);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]?.reasoning).toBe("medium");
    expect(model.doGenerateCalls[0]?.tools?.map((t) => t.name).sort()).toEqual([
      "finish_check",
      "search_accounts",
    ]);
  });

  it("sends a final answer that does not fit back, and takes the fixed one", async () => {
    const model = scriptedModel([
      {
        calls: [
          {
            input: { receipts: [{ receiptId: "r1", confidence: { type: 5 } }] },
            name: "finish_check",
          },
        ],
      },
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    const answer = await checkWithAgent(INPUT, {
      deadlineMs: 5000,
      model,
      tools: {},
    });

    expect(answer).toEqual(ANSWER);
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("a model that only talks gives no answer", async () => {
    const model = scriptedModel([{ text: "All looks fine." }]);

    expect(
      await checkWithAgent(INPUT, { deadlineMs: 5000, model, tools: {} })
    ).toBeNull();
  });

  describe("step limit and deadline end the run with no answer", () => {
    it("stops after the step limit, offering only the final answer last", async () => {
      const lookup = vi.fn(async () => ({ accounts: [] }));
      const model = scriptedModel([
        { calls: [{ input: { text: "again" }, name: "search_accounts" }] },
      ]);

      const answer = await checkWithAgent(INPUT, {
        deadlineMs: 5000,
        model,
        tools: { search_accounts: lookupTool(lookup) },
      });

      expect(answer).toBeNull();
      expect(model.doGenerateCalls).toHaveLength(CHECK_MAX_STEPS);
      expect(CHECK_MAX_STEPS).toBe(12);
      expect(model.doGenerateCalls.at(-1)?.tools?.map((t) => t.name)).toEqual([
        "finish_check",
      ]);
    });

    it("gives up on a model that passes the deadline", async () => {
      const model = scriptedModel(["hang"]);
      const started = Date.now();

      const answer = await checkWithAgent(INPUT, {
        deadlineMs: 30,
        model,
        tools: {},
      });

      expect(answer).toBeNull();
      expect(Date.now() - started).toBeLessThan(2000);
    });

    it("gives up on a tool that passes the deadline", async () => {
      const model = scriptedModel([
        { calls: [{ input: { text: "slow" }, name: "search_accounts" }] },
        { calls: [{ input: ANSWER, name: "finish_check" }] },
      ]);
      const started = Date.now();

      const answer = await checkWithAgent(INPUT, {
        deadlineMs: 30,
        model,
        tools: {
          search_accounts: lookupTool(
            () => new Promise(() => undefined) as Promise<unknown>
          ),
        },
      });

      expect(answer).toBeNull();
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });

  it("logs steps and token use, never a receipt's file", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const model = scriptedModel([
      { calls: [{ input: { receiptId: "r1" }, name: "view_receipt" }] },
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    await checkWithAgent(INPUT, {
      deadlineMs: 5000,
      model,
      tools: {
        view_receipt: tool({
          description: "View",
          execute: async () => ({
            base64: "RECEIPT-FILE-BYTES",
            mediaType: "image/jpeg",
          }),
          inputSchema: z.object({ receiptId: z.string() }),
        }),
      },
    });

    const lines = info.mock.calls.map((call) => String(call[0]));
    const { inputTokens, outputTokens } = STEP_USAGE;
    expect(lines).toContain(
      `[expense-check] expense-1: step 1 view_receipt (tool-calls); tokens in ${inputTokens.total} out ${outputTokens.total}`
    );
    expect(lines.at(-1)).toMatch(
      new RegExp(
        `^\\[expense-check\\] expense-1: the agent answered after 2 steps in \\d+ ms; tokens in ${inputTokens.total * 2} \\(cached ${inputTokens.cacheRead * 2}\\) out ${outputTokens.total * 2} \\(reasoning ${outputTokens.reasoning * 2}\\)$`
      )
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("RECEIPT-FILE-BYTES");
  });
});

/**
 * A stored expense; `euroReceipt` adds a second receipt paid in euros, and
 * `ownText` gives the first one the student's own words for its type.
 */
function expenseStore(
  options: { euroReceipt?: boolean; ownText?: boolean } = {}
) {
  const euro = {
    $id: "r2",
    account_number: null,
    account_source: null,
    ai_confidence: null,
    ai_cost_type: null,
    amount: 1150,
    cost_type: "travel",
    cost_type_text: null,
    date: "2026-11-02T11:00:00.000+00:00",
    description: "Hotel in Berlin",
    file_hash: "hash-2",
    project_id: null,
    type: "application/pdf",
    type_source: "student",
    url: "file-2",
  };
  const euroScan = {
    $id: "scan-2",
    file_hash: "hash-2",
    result: JSON.stringify({
      amountInNok: 1150,
      classification: null,
      exchangeRate: 11.5,
      receipt: {
        address: null,
        amount: 100,
        category: "accommodation",
        city: "Berlin",
        country: "Germany",
        currency: "EUR",
        date: "2026-11-02",
        description: "One night",
        documentType: "receipt",
        purchaseContext: "Hotel",
        receiptIssues: [],
        vendor: "Hotel Mitte",
      },
    }),
  };
  return memoryDb({
    campus: [{ $id: "1", name: "Oslo" }],
    departments: [{ $id: "dept-1", Name: "Marketing", project_share: 0.5 }],
    events: [{ $id: "event-9", start_date: "2026-11-05T17:00:00.000+00:00" }],
    expense: [
      {
        $id: "expense-1",
        approver_hints: JSON.stringify([
          {
            attachmentId: "r1",
            code: "possible_duplicate",
            data: { match: "file", reimbursementNumber: "R-0042" },
          },
        ]),
        bank_account: "1234.56.78901",
        campus: "1",
        campusRel: { $id: "1", name: "Oslo" },
        department: "dept-1",
        departmentRel: {
          $id: "dept-1",
          Name: "Marketing",
          project_share: 0.5,
        },
        eventName: "Kick-off party",
        event_id: "event-9",
        expenseAttachments: [
          {
            $id: "r1",
            account_number: null,
            account_source: null,
            ai_confidence: 0.7,
            ai_cost_type: "food",
            amount: 250,
            cost_type: null,
            cost_type_text: options.ownText ? "Flowers for the speaker" : null,
            date: "2026-11-01T11:00:00.000+00:00",
            description: "Pizza for the board",
            file_hash: "hash-1",
            project_id: null,
            type: "image/jpeg",
            type_source: null,
            url: "file-1",
          },
          ...(options.euroReceipt ? [euro] : []),
        ],
        occasion: "Board meeting",
        user: {
          $id: "user-1",
          bank_account: "1234.56.78901",
          email: "ada@example.com",
          name: "Ada Lovelace",
          phone: "+47 98765432",
        },
        userId: "user-1",
      },
    ],
    expense_cost_types: [
      {
        $id: "food",
        account_number: 7350,
        active: true,
        ask_occasion: false,
        description: "Meals during meetings",
        label: "Food",
        label_no: null,
        ocr_category: null,
        slug: "food",
        sort_order: 0,
        tax_code: 1,
      },
    ],
    expense_receipt_scans: [
      {
        $id: "scan-1",
        file_hash: "hash-1",
        result: JSON.stringify({
          amountInNok: 250,
          classification: null,
          exchangeRate: null,
          receipt: {
            address: null,
            amount: 250,
            category: "meal",
            city: "Oslo",
            country: "Norway",
            currency: "NOK",
            date: "2026-11-01",
            description: "Two pizzas",
            documentType: "receipt",
            purchaseContext: "Restaurant meal",
            receiptIssues: [],
            vendor: "Peppes Pizza",
          },
        }),
      },
      ...(options.euroReceipt ? [euroScan] : []),
    ],
  });
}

describe("loadCheckInput", () => {
  it("the prompt carries no name, email or bank account", async () => {
    const store = expenseStore({ euroReceipt: true });
    const input = await loadCheckInput(store.db as never, "expense-1", TODAY);
    const model = scriptedModel([
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    await checkWithAgent(input, { deadlineMs: 5000, model, tools: {} });

    const sent = sentToModel(model);
    for (const personal of [
      "Ada",
      "Lovelace",
      "ada@example.com",
      "98765432",
      "1234.56.78901",
      "user-1",
    ]) {
      expect(sent).not.toContain(personal);
    }
    // What the check does need is there.
    for (const needed of [
      "Board meeting",
      "Peppes Pizza",
      "Two pizzas",
      "Marketing",
      "Kick-off party",
      "2026-11-05",
      "Meals during meetings",
      "amountNok",
      "originalCurrency",
    ]) {
      expect(sent).toContain(needed);
    }
    // The amount is the student's NOK amount, never labelled with the
    // receipt's own currency.
    expect(buildCheckPrompt(input).prompt).not.toContain('"currency"');
  });

  it("describes each receipt as the check needs it", async () => {
    const input = await loadCheckInput(
      expenseStore({ euroReceipt: true }).db as never,
      "expense-1",
      TODAY
    );

    expect(input.department).toEqual({
      id: "dept-1",
      name: "Marketing",
      projectShare: 0.5,
      shareClass: "sometimes",
    });
    expect(input.event).toEqual({ date: "2026-11-05", name: "Kick-off party" });
    expect(input.receipts).toEqual([
      expect.objectContaining({
        amountNok: 250,
        date: "2026-11-01",
        description: "Two pizzas",
        duplicates: [{ earlierReimbursement: true, match: "file" }],
        note: "Pizza for the board",
        originalCurrency: null,
        receiptId: "r1",
        type: null,
        typeSource: null,
        uploadPick: { confidence: 0.7, type: "food" },
        vendor: "Peppes Pizza",
      }),
      // Paid in euros: the amount stays the NOK amount; the receipt's own
      // currency is shown on its own.
      expect.objectContaining({
        amountNok: 1150,
        originalCurrency: "EUR",
        receiptId: "r2",
      }),
    ]);
  });
});

describe("runCheckAgent", () => {
  it("applies a checked answer and says the check answered", async () => {
    const store = expenseStore();
    admin.current = { db: store.db, storage: {} };
    const model = scriptedModel([
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    expect(await runCheckAgent("expense-1", { model, today: TODAY })).toBe(
      true
    );
    expect(store.patchOf("r1")).toMatchObject({
      cost_type: "food",
      type_source: null,
    });
  });

  it("an answer that leaves receipts out still answers, and hands the fixed steps its flag", async () => {
    const store = expenseStore({ euroReceipt: true });
    admin.current = { db: store.db, storage: {} };
    const model = scriptedModel([
      { calls: [{ input: ANSWER, name: "finish_check" }] },
    ]);

    expect(await runCheckAgent("expense-1", { model, today: TODAY })).toEqual({
      extraHints: [{ code: "ai_check_incomplete", data: { unchecked: 1 } }],
    });
    expect(store.patchOf("r1")).toMatchObject({ cost_type: "food" });
  });

  it("hands the check's account doubts on to the fixed steps", async () => {
    const store = expenseStore({ ownText: true });
    admin.current = { db: store.db, storage: {} };
    const model = scriptedModel([
      {
        calls: [
          {
            input: {
              flags: [
                {
                  code: "account_unsure",
                  note: "7420 gifts or 6800 office supplies?",
                  receiptId: "r1",
                },
              ],
              receipts: [
                {
                  confidence: { project: 0.9 },
                  projectId: "none",
                  reason: "Flowers for a speaker",
                  receiptId: "r1",
                },
              ],
            },
            name: "finish_check",
          },
        ],
      },
    ]);

    // The fixed steps may still choose an account; the doubt must stay.
    expect(await runCheckAgent("expense-1", { model, today: TODAY })).toEqual({
      extraHints: [{ attachmentId: "r1", code: "ai_account_unsure" }],
    });
  });

  it("applies nothing without an answer", async () => {
    const store = expenseStore();
    admin.current = { db: store.db, storage: {} };
    const model = scriptedModel([{ text: "Done." }]);

    expect(await runCheckAgent("expense-1", { model, today: TODAY })).toBe(
      false
    );
    expect(store.writes).toEqual([]);
  });
});
