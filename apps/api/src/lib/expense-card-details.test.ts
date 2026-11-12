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

    await expect(loadApprovalCardDetails(asDb(), "e1")).resolves.toEqual({
      declaration: null,
      fallbackNote: null,
      hints: [],
      history: [],
      missingAccount: false,
      receipts: [],
    });
    log.mockRestore();
  });
});
