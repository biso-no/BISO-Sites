import { describe, expect, it } from "vitest";
import {
  type AccountingExpense,
  buildAccountingDetails,
} from "./expense-accounting-details";

const LOOKUPS = {
  accountNames: new Map([[6555, "Reise"]]),
  typeLabels: new Map([["taxi", "Taxi"]]),
};

function expense(over: Partial<AccountingExpense> = {}): AccountingExpense {
  return {
    approver_hints: null,
    eventName: null,
    expenseAttachments: [
      {
        $id: "a1",
        account_number: 6555,
        cost_type: "taxi",
        cost_type_text: null,
        description: "Ruter",
        project_name: "Fadderuke 2026",
      },
      {
        $id: "a2",
        account_number: null,
        cost_type: null,
        cost_type_text: "Pizza",
        description: "Dominos",
        project_name: null,
      },
    ],
    occasion: "Kickoff",
    ...over,
  };
}

describe("buildAccountingDetails", () => {
  it("gives each receipt its type, account and project in order", () => {
    const { receipts } = buildAccountingDetails(expense(), LOOKUPS, "en");
    expect(receipts).toEqual([
      { account: "6555 Reise", project: "Fadderuke 2026", type: "Taxi" },
      { account: "", project: "", type: "Pizza" },
    ]);
  });

  it("carries the occasion and the event, empty when missing", () => {
    expect(
      buildAccountingDetails(
        expense({ eventName: "Kickoff night" }),
        LOOKUPS,
        "en"
      )
    ).toMatchObject({ event: "Kickoff night", occasion: "Kickoff" });
    expect(
      buildAccountingDetails(expense({ occasion: null }), LOOKUPS, "en")
    ).toMatchObject({ event: "", occasion: "" });
  });

  it("words the flags in the language asked, led by the receipt they are about", () => {
    const hints = JSON.stringify([
      { attachmentId: "a2", code: "type_unsure", data: { reason: "food?" } },
      { code: "ai_check_incomplete" },
      { code: "bogus" },
    ]);
    const en = buildAccountingDetails(
      expense({ approver_hints: hints }),
      LOOKUPS,
      "en"
    );
    expect(en.flags).toEqual([
      "Dominos: The AI was not sure which type this receipt is: food?",
      "The AI check did not finish, so the AI has not looked at everything on this expense.",
    ]);
    const nb = buildAccountingDetails(
      expense({ approver_hints: hints }),
      LOOKUPS,
      "nb"
    );
    expect(nb.flags[0]).toBe(
      "Dominos: AI var usikker på hvilken type denne kvitteringen er: food?"
    );
  });

  it("caps a long receipt name in a flag line", () => {
    const long = "x".repeat(80);
    const { flags } = buildAccountingDetails(
      expense({
        approver_hints: JSON.stringify([
          { attachmentId: "a1", code: "project_missing" },
        ]),
        expenseAttachments: [
          {
            $id: "a1",
            account_number: null,
            cost_type: null,
            cost_type_text: null,
            description: long,
            project_name: null,
          },
        ],
      }),
      LOOKUPS,
      "en"
    );
    expect(flags[0]?.startsWith(`${"x".repeat(39)}…: `)).toBe(true);
  });

  it("has no flags when the check found nothing", () => {
    expect(buildAccountingDetails(expense(), LOOKUPS, "nb").flags).toEqual([]);
  });
});
