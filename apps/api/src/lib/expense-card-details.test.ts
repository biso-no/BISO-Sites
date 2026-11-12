import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

import { loadApprovalCardDetails } from "./expense-card-details";

type Db = Parameters<typeof loadApprovalCardDetails>[0];
const asDb = () => db as unknown as Db;

const TIME_STAMP = /^12 Nov \d\d:\d\d$/;

const EXPENSE = {
  $id: "e1",
  approver_hints: null,
  campus: "1",
  submitter_is_controller: false,
  submitter_is_financial_manager: false,
};

interface Tables {
  approvals?: object[];
  attachments?: object[];
  costTypes?: object[];
  events?: object[];
  ledger?: object[];
}

function seed(tables: Tables, expense: object = EXPENSE) {
  db.getRow.mockResolvedValue(expense);
  db.listRows.mockImplementation((_db: string, table: string) => {
    const map: Record<string, object[] | undefined> = {
      expense_approvals: tables.approvals,
      expense_attachments: tables.attachments,
      expense_cost_types: tables.costTypes,
      expense_events: tables.events,
      ledger_accounts: tables.ledger,
    };
    const rows = map[table] ?? [];
    return Promise.resolve({ rows, total: rows.length });
  });
}

const TAXI = {
  $id: "a1",
  account_number: 6555,
  amount: 250,
  cost_type: "taxi",
  date: "2026-11-02T00:00:00.000Z",
  description: "Ruter",
  sort_order: 0,
  type: "receipt",
};

const COST_TYPES = [
  {
    $id: "t1",
    account_number: 7140,
    active: false,
    ask_occasion: false,
    description: "",
    label: "Taxi",
    label_no: "Drosje",
    ocr_category: null,
    slug: "taxi",
    sort_order: 1,
    tax_code: 0,
  },
];

beforeEach(() => {
  db.getRow.mockReset();
  db.listRows.mockReset();
});

describe("loadApprovalCardDetails", () => {
  it("loads receipts with type labels and account names", async () => {
    seed({
      attachments: [
        TAXI,
        { ...TAXI, $id: "a2", account_number: null, amount: 0, sort_order: 1 },
        {
          ...TAXI,
          $id: "a3",
          cost_type: null,
          cost_type_text: "Pizza",
          account_number: null,
          amount: 90,
          sort_order: 2,
        },
      ],
      costTypes: COST_TYPES,
      ledger: [{ $id: "6555", account_number: 6555, name: "Reise" }],
    });

    const details = await loadApprovalCardDetails(asDb(), "e1");

    expect(details.receipts).toEqual([
      {
        account: "6555 Reise",
        amount: 250,
        date: "2026-11-02",
        text: "Ruter",
        type: "Taxi",
      },
      expect.objectContaining({ account: null, amount: 90, type: '"Pizza"' }),
    ]);
  });

  it("flags a missing account", async () => {
    seed({
      attachments: [{ ...TAXI, account_number: null }],
      costTypes: COST_TYPES,
    });
    expect((await loadApprovalCardDetails(asDb(), "e1")).missingAccount).toBe(
      true
    );

    seed({ attachments: [TAXI], costTypes: COST_TYPES });
    expect((await loadApprovalCardDetails(asDb(), "e1")).missingAccount).toBe(
      false
    );
  });

  it("renders hints, declaration and the fallback note", async () => {
    seed(
      { approvals: [{ approver_role: "national" }] },
      {
        ...EXPENSE,
        approver_hints: JSON.stringify([
          { code: "amount_differs", data: { entered: 100, read: 120 } },
          {
            code: "possible_duplicate",
            data: { reimbursementNumber: "10007" },
          },
          { code: "receipt_issue", data: { issue: "unreadable" } },
          { code: "account_missing" },
        ]),
        submitter_is_controller: true,
      }
    );

    const details = await loadApprovalCardDetails(asDb(), "e1");

    expect(details.hints).toEqual([
      "Entered amount is 100, but the receipt reads 120.",
      "Possible duplicate of expense 10007.",
      "Receipt problem: Hard to read.",
      "No account is set for this receipt type.",
    ]);
    expect(details.declaration).toBe(
      "Submitter says they are the campus controller"
    );
    expect(details.fallbackNote).toContain("national approver");
  });

  it("says the president could not be found when national stands in for one", async () => {
    // Drift Campus Oslo with the controller switch on: the plan's one step is
    // the president, so a national step there stands in for the president.
    seed(
      { approvals: [{ approver_role: "national" }] },
      { ...EXPENSE, department: "1", submitter_is_controller: true }
    );

    expect((await loadApprovalCardDetails(asDb(), "e1")).fallbackNote).toBe(
      "The campus president could not be found or is the submitter; the national approver decides instead."
    );
  });

  it("uses a neutral fallback note when national stands in for another role", async () => {
    seed(
      { approvals: [{ approver_role: "national" }] },
      { ...EXPENSE, department: "dept-9", submitter_is_controller: false }
    );

    expect((await loadApprovalCardDetails(asDb(), "e1")).fallbackNote).toBe(
      "The national approver decides in place of the usual approver."
    );
  });

  it("names the receipt a hint is about", async () => {
    seed(
      {
        attachments: [
          TAXI,
          {
            ...TAXI,
            $id: "a2",
            description:
              "Pizza and drinks for the volunteers after the autumn fair",
            sort_order: 1,
          },
          { ...TAXI, $id: "a3", description: "", sort_order: 2 },
        ],
        costTypes: COST_TYPES,
      },
      {
        ...EXPENSE,
        approver_hints: JSON.stringify([
          { attachmentId: "a1", code: "account_missing" },
          { attachmentId: "a2", code: "type_defaulted" },
          { attachmentId: "a3", code: "occasion_missing" },
          { code: "possible_duplicate" },
        ]),
      }
    );

    const { hints } = await loadApprovalCardDetails(asDb(), "e1");

    expect(hints).toEqual([
      "Ruter: No account is set for this receipt type.",
      "Pizza and drinks for the volunteers aft…: No type was chosen, so Other was used.",
      "Taxi: The occasion is missing.",
      "Possible duplicate of another receipt.",
    ]);
  });

  it("offers no Approve when the receipts cannot be read", async () => {
    db.getRow.mockResolvedValue(EXPENSE);
    db.listRows.mockImplementation((_db: string, table: string) =>
      table === "expense_attachments"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ rows: [], total: 0 })
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const details = await loadApprovalCardDetails(asDb(), "e1");

    expect(details.missingAccount).toBe(true);
    expect(details.receipts).toEqual([]);
    log.mockRestore();
  });

  it("reads the history while the receipts are still loading", async () => {
    seed({ attachments: [TAXI], costTypes: COST_TYPES });
    const seeded = db.listRows.getMockImplementation();
    let release: () => void = () => undefined;
    const receiptsHeld = new Promise<void>((resolve) => {
      release = resolve;
    });
    db.listRows.mockImplementation(async (...args: [string, string]) => {
      if (args[1] === "expense_attachments") {
        await receiptsHeld;
      }
      return seeded?.(...args);
    });

    const loading = loadApprovalCardDetails(asDb(), "e1");
    await vi.waitFor(() =>
      expect(
        db.listRows.mock.calls.some(([, t]) => t === "expense_events")
      ).toBe(true)
    );
    release();

    expect((await loading).receipts).toHaveLength(1);
  });

  it("does not set a fallback note on the national campus", async () => {
    seed(
      { approvals: [{ approver_role: "national" }] },
      { ...EXPENSE, campus: "5" }
    );
    expect(
      (await loadApprovalCardDetails(asDb(), "e1")).fallbackNote
    ).toBeNull();
  });

  it("renders history lines newest first", async () => {
    seed({
      events: [
        {
          $createdAt: "2026-11-12T14:03:00.000Z",
          action: "edited",
          actor_name: "Ada Admin",
          after: "7140",
          before: "6555",
          field: "account_number",
          attachment_id: "a1",
        },
        {
          $createdAt: "2026-11-12T13:00:00.000Z",
          action: "approved",
          actor_name: "Bo Approver",
          note: "On behalf of the financial manager · Reason: away",
        },
      ],
      attachments: [TAXI],
      costTypes: COST_TYPES,
    });

    const { history } = await loadApprovalCardDetails(asDb(), "e1");

    expect(history).toHaveLength(2);
    expect(history[0]?.text).toBe(
      "Ada Admin changed the account on Taxi from 6555 to 7140"
    );
    expect(history[0]?.at).toMatch(TIME_STAMP);
    expect(history[1]?.text).toBe(
      "Bo Approver approved (on behalf of the financial manager)"
    );
    const query = JSON.stringify(
      db.listRows.mock.calls.find(([, t]) => t === "expense_events")?.[2]
    );
    expect(query).toContain("orderDesc");
    expect(query).toContain("6");
  });

  it("a failed lookup still returns a sendable card", async () => {
    db.getRow.mockRejectedValue(new Error("boom"));
    db.listRows.mockRejectedValue(new Error("boom"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // With no receipts read, the card must not offer Approve.
    await expect(loadApprovalCardDetails(asDb(), "e1")).resolves.toEqual({
      declaration: null,
      fallbackNote: null,
      hints: [],
      history: [],
      missingAccount: true,
      receipts: [],
    });
    log.mockRestore();
  });
});
