import { tool } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type CheckAnswer, type CheckInput, checkWithAgent } from "./agent";
import { applyCheck } from "./apply";
import { memoryDb, scriptedModel } from "./test-support";

const TODAY = "2026-11-19";

function costType(slug: string, account: number, active = true) {
  return {
    $id: slug,
    account_number: account,
    active,
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

function account(number: number, active = true) {
  return {
    $id: `acc-${number}`,
    account_number: number,
    active,
    name: `Account ${number}`,
    tax_code: 5,
  };
}

function project(id: string, name: string, year: number | null, over = {}) {
  return {
    $id: id,
    active: true,
    event_date: null,
    first_line_date: null,
    last_line_date: null,
    line_count: 50,
    name,
    peak_date: null,
    project_id: id,
    series: null,
    synced_at: null,
    year,
    ...over,
  };
}

function usage(projectId: string, departmentId: string) {
  return {
    $id: `${projectId}-${departmentId}`,
    department_id: departmentId,
    first_line_date: "2025-09-01",
    last_line_date: "2026-09-01",
    line_count: 40,
    project_id: projectId,
    synced_at: null,
  };
}

function receipt(id: string, over: Record<string, unknown> = {}) {
  return {
    $id: id,
    account_number: null,
    account_source: null,
    ai_confidence: null,
    ai_cost_type: null,
    amount: 250,
    cost_type: null,
    cost_type_text: null,
    date: "2026-09-15T10:00:00.000+00:00",
    description: "Receipt",
    expense_id: "expense-1",
    file_hash: null,
    project_confidence: null,
    project_id: null,
    project_name: null,
    project_source: null,
    type: "image/jpeg",
    type_source: null,
    url: `file-${id}`,
    ...over,
  };
}

function setup(
  receipts: ReturnType<typeof receipt>[],
  options: {
    hints?: unknown[];
    projectShare?: number | null;
    /** More projects, each booked by the department. */
    projects?: ReturnType<typeof project>[];
  } = {}
) {
  return memoryDb({
    departments: [
      {
        $id: "dept-1",
        Name: "Bergensbaneløpet",
        project_share:
          options.projectShare === undefined ? 0.9 : options.projectShare,
      },
    ],
    events: [],
    expense: [
      {
        $id: "expense-1",
        approver_hints: JSON.stringify(options.hints ?? []),
        department: "dept-1",
        expenseAttachments: receipts,
      },
    ],
    expense_cost_types: [
      costType("food", 7350),
      costType("taxi", 7140),
      costType("travel", 7130),
      costType("other", 6800),
      costType("retired", 6900, false),
    ],
    finago_project_usage: [
      usage("p-bbl26", "dept-1"),
      usage("p-kd26", "dept-1"),
      usage("p-wg27", "dept-2"),
      ...(options.projects ?? []).map((p) => usage(p.project_id, "dept-1")),
    ],
    finago_projects: [
      project("p-bbl26", "BBL 2026", 2026, { event_date: "2026-06-10" }),
      project("p-kd26", "KD 2026", 2026, { event_date: "2026-10-10" }),
      project("p-wg27", "Wintergames 2027", 2027, {
        event_date: "2027-02-10",
      }),
      ...(options.projects ?? []),
    ],
    ledger_accounts: [
      account(7140),
      account(7100),
      account(6500, false),
      account(9100),
    ],
  });
}

const INPUT: CheckInput = {
  campus: { id: "3", name: "Bergen" },
  department: {
    id: "dept-1",
    name: "Bergensbaneløpet",
    projectShare: 0.9,
    shareClass: "expected",
  },
  event: null,
  expenseId: "expense-1",
  occasion: "Race weekend",
  receipts: [],
  today: TODAY,
  types: [],
};

/**
 * The scripted model looks up the projects, then finishes with `answer`;
 * the code then applies what it accepts.
 */
async function checkAndApply(
  store: ReturnType<typeof setup>,
  answer: CheckAnswer
) {
  const listProjects = vi.fn(async () => ({ candidates: [] }));
  const model = scriptedModel([
    {
      calls: [
        {
          input: { departmentId: "dept-1", receiptDates: ["2026-09-15"] },
          name: "list_projects",
        },
      ],
    },
    { calls: [{ input: answer, name: "finish_check" }] },
  ]);
  const proposed = await checkWithAgent(INPUT, {
    deadlineMs: 5000,
    model,
    tools: {
      list_projects: tool({
        description: "Projects",
        execute: listProjects,
        inputSchema: z.object({
          departmentId: z.string(),
          receiptDates: z.array(z.string()),
        }),
      }),
    },
  });
  expect(listProjects).toHaveBeenCalledTimes(1);
  expect(proposed).not.toBeNull();
  const expense = await store.db.getRow("app", "expense", "expense-1");
  return applyCheck(
    store.db as never,
    expense as never,
    proposed as CheckAnswer,
    {
      today: TODAY,
    }
  );
}

function storedHints(store: ReturnType<typeof setup>) {
  const row = store.tables.expense?.[0] as unknown as {
    approver_hints: string;
  };
  return JSON.parse(row.approver_hints) as {
    attachmentId?: string;
    code: string;
    data?: Record<string, unknown>;
  }[];
}

function hintsFor(store: ReturnType<typeof setup>, attachmentId: string) {
  return storedHints(store).filter((h) => h.attachmentId === attachmentId);
}

function silenceErrors() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

function flagEvents(store: ReturnType<typeof setup>) {
  return store.events().filter((event) => event.action === "ai_flagged");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyCheck", () => {
  it("invalid proposals are dropped and flagged", async () => {
    const store = setup(
      [
        receipt("r1"),
        receipt("r2", { cost_type_text: "Taxi to the venue" }),
        receipt("r3", {
          ai_confidence: 0.9,
          ai_cost_type: "food",
          cost_type: "food",
          type_source: "ai",
        }),
      ],
      { projectShare: 0.1 }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.95 },
          reason: "Looks retired",
          receiptId: "r1",
          type: "retired",
        },
        {
          accountNumber: 9100,
          confidence: { account: 0.9 },
          reason: "Travel",
          receiptId: "r2",
        },
        {
          confidence: { project: 0.9 },
          projectId: "p-wg27",
          reason: "Wintergames",
          receiptId: "r3",
        },
        {
          confidence: { type: 0.9 },
          reason: "Not on this expense",
          receiptId: "ghost",
          type: "taxi",
        },
      ],
    });

    // Nothing invalid is stored.
    expect(store.patchOf("r1")).not.toHaveProperty("cost_type");
    expect(store.patchOf("r2")).not.toHaveProperty("account_number");
    expect(store.patchOf("r3")).not.toHaveProperty("project_id");
    expect(store.patchOf("ghost")).toEqual({});

    // Each one is flagged for the approver and in the history.
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "type_unsure",
        data: { reason: expect.stringContaining("retired") },
      },
    ]);
    // The account doubt's text never shows a reason: the history keeps it.
    expect(hintsFor(store, "r2")).toEqual([
      { attachmentId: "r2", code: "ai_account_unsure" },
    ]);
    expect(
      flagEvents(store).find((event) => event.attachment_id === "r2")
    ).toMatchObject({ note: expect.stringContaining("9100") });
    expect(hintsFor(store, "r3")).toEqual([
      {
        attachmentId: "r3",
        code: "project_unsure",
        data: { reason: expect.stringContaining("p-wg27") },
      },
    ]);
    expect(
      flagEvents(store).map((event) => [event.attachment_id, event.field])
    ).toEqual([
      ["r1", "type_unsure"],
      ["r2", "ai_account_unsure"],
      ["r3", "project_unsure"],
    ]);
    for (const event of flagEvents(store)) {
      expect(event.actor_kind).toBe("ai");
    }
  });

  it("an inactive account is dropped like one outside the cost range", async () => {
    const store = setup([receipt("r1", { cost_type_text: "Gifts" })], {
      projectShare: 0.1,
    });

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          accountNumber: 6500,
          confidence: { account: 0.95 },
          reason: "Gifts",
          receiptId: "r1",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1").map((h) => h.code)).toEqual([
      "ai_account_unsure",
    ]);
  });

  it("a student's explicit choice is never changed", async () => {
    const store = setup(
      [
        receipt("r1", {
          account_number: 7130,
          account_source: "type",
          cost_type: "travel",
          type_source: "student",
        }),
        receipt("r2", {
          account_number: 7130,
          account_source: "type",
          cost_type: "travel",
          type_source: "student",
        }),
      ],
      { projectShare: 0.1 }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.92 },
          reason: "Pizza for the board meeting",
          receiptId: "r1",
          type: "food",
        },
        {
          confidence: { type: 0.9 },
          reason: "Old type",
          receiptId: "r2",
          type: "retired",
        },
      ],
    });

    // A type that can't change raises no validation flag either.
    expect(store.patchOf("r2")).toEqual({});
    expect(hintsFor(store, "r2")).toEqual([]);
    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "ai_check_disagrees",
        data: { aiType: "food" },
      },
    ]);
    expect(flagEvents(store)).toEqual([
      expect.objectContaining({
        actor_kind: "ai",
        after: "food",
        attachment_id: "r1",
        field: "ai_check_disagrees",
        note: "Thinks the type is food: Pizza for the board meeting",
      }),
    ]);
  });

  it("an AI-picked type can be corrected and is logged", async () => {
    const store = setup(
      [
        receipt("r1", {
          account_number: 7350,
          account_source: "type",
          ai_confidence: 0.85,
          ai_cost_type: "food",
          cost_type: "food",
          type_source: "ai",
        }),
        receipt("r2", {
          account_number: 6800,
          account_source: "type",
          cost_type: "other",
          type_source: null,
        }),
        receipt("r3", {
          account_number: 7130,
          account_source: "type",
          cost_type: "travel",
          type_source: "legacy_app",
        }),
      ],
      {
        hints: [{ attachmentId: "r2", code: "type_defaulted" }],
        projectShare: 0.1,
      }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.95 },
          reason: "A taxi receipt from Oslo Taxi",
          receiptId: "r1",
          type: "taxi",
        },
        {
          confidence: { type: 0.6 },
          reason: "Probably a cab",
          receiptId: "r2",
          type: "taxi",
        },
        {
          confidence: { type: 0.9 },
          reason: "Food at the stand",
          receiptId: "r3",
          type: "food",
        },
      ],
    });

    // Changed with the type's account, as the AI's pick nobody saw yet, so
    // it never teaches before a person confirms it.
    expect(store.patchOf("r1")).toEqual({
      account_number: 7140,
      account_source: "type",
      ai_confidence: 0.95,
      ai_cost_type: "taxi",
      cost_type: "taxi",
      tax_code: 1,
      type_source: null,
    });
    expect(store.events()).toContainEqual(
      expect.objectContaining({
        action: "ai_classified",
        actor_kind: "ai",
        after: "taxi",
        attachment_id: "r1",
        before: "food",
        field: "cost_type",
        note: expect.stringContaining("A taxi receipt from Oslo Taxi"),
      })
    );
    expect(hintsFor(store, "r1")).toEqual([]);

    // An unsure pick replaces the default and is flagged; the stale
    // "defaulted" hint goes.
    expect(store.patchOf("r2")).toMatchObject({ cost_type: "taxi" });
    expect(hintsFor(store, "r2")).toEqual([
      {
        attachmentId: "r2",
        code: "type_unsure",
        data: { reason: "Probably a cab" },
      },
    ]);

    // An old app's type it replaces says so, and the fixed steps leave it.
    expect(store.patchOf("r3")).toMatchObject({
      cost_type: "food",
      type_source: null,
    });
    expect(hintsFor(store, "r3")).toEqual([
      {
        attachmentId: "r3",
        code: "app_type_replaced",
        data: { aiType: "food", appType: "travel" },
      },
    ]);
  });

  it("own text gets the agent's account as ai_freeform", async () => {
    const store = setup(
      [
        receipt("r1", { cost_type_text: "Taxi to the venue" }),
        receipt("r2", { cost_type_text: "Thank-you flowers" }),
      ],
      { projectShare: 0.1 }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          accountNumber: 7140,
          confidence: { account: 0.9, type: 0.9 },
          reason: "Taxi is travel",
          receiptId: "r1",
          type: "taxi",
        },
        {
          accountNumber: 7100,
          confidence: { account: 0.5 },
          reason: "Gifts or travel?",
          receiptId: "r2",
        },
      ],
    });

    // The student's own words stay; the type it proposed is not used.
    expect(store.patchOf("r1")).toEqual({
      account_number: 7140,
      account_source: "ai_freeform",
      tax_code: 5,
    });
    expect(store.events()).toContainEqual(
      expect.objectContaining({
        action: "ai_account_chosen",
        actor_kind: "ai",
        after: "7140",
        attachment_id: "r1",
        before: "Taxi to the venue",
        field: "account_number",
        note: expect.stringContaining("Taxi is travel"),
      })
    );
    expect(hintsFor(store, "r1")).toEqual([]);
    expect(store.patchOf("r2")).toMatchObject({
      account_number: 7100,
      account_source: "ai_freeform",
    });
    expect(hintsFor(store, "r2")).toEqual([
      { attachmentId: "r2", code: "ai_account_unsure" },
    ]);
    expect(
      flagEvents(store).find((event) => event.attachment_id === "r2")
    ).toMatchObject({ note: "Not sure of the account: Gifts or travel?" });
  });

  it("a project the department expects but none fits is flagged", async () => {
    const store = setup([
      receipt("r1"),
      receipt("r2", { date: "2026-09-20T10:00:00.000+00:00" }),
      receipt("r3", { amount: 0 }),
    ]);

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "none",
          reason: "Office supplies, no event",
          receiptId: "r1",
        },
        {
          confidence: { project: 0.9 },
          projectId: "p-kd26",
          reason: "Stand material for KD in October",
          receiptId: "r2",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      { attachmentId: "r1", code: "project_missing" },
    ]);
    expect(
      flagEvents(store).find((event) => event.attachment_id === "r1")
    ).toMatchObject({
      field: "project_missing",
      note: "Office supplies, no event",
    });
    expect(store.patchOf("r2")).toEqual({
      project_confidence: 0.9,
      project_id: "p-kd26",
      project_name: "KD 2026",
      project_source: "ai_check",
    });
    expect(store.events()).toContainEqual(
      expect.objectContaining({
        action: "edited",
        actor_kind: "ai",
        after: "KD 2026",
        attachment_id: "r2",
        field: "project",
        note: expect.stringContaining("Stand material for KD in October"),
      })
    );
    // A supporting document carries no project.
    expect(hintsFor(store, "r3")).toEqual([]);
  });

  it("a department that rarely books on a project gets no flag for none", async () => {
    const store = setup([receipt("r1")], { projectShare: 0.1 });

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "none",
          reason: "No event",
          receiptId: "r1",
        },
      ],
    });

    expect(storedHints(store)).toEqual([]);
  });

  it("a missing next year's project is flagged, never last year's", async () => {
    // BBL 2026 was held on 10 June; these receipts are from September.
    const store = setup([
      receipt("r1"),
      receipt("r2"),
      receipt("r3", { date: "2026-09-16T10:00:00.000+00:00" }),
    ]);

    await checkAndApply(store, {
      flags: [
        {
          code: "project_not_created",
          note: "BBL 2027 is not in Finago yet",
          receiptId: "r2",
          series: "bbl",
          year: 2027,
        },
        {
          code: "project_not_created",
          note: "KD 2026 is missing",
          receiptId: "r3",
          series: "KD",
          year: 2026,
        },
      ],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "p-bbl26",
          reason: "Bibs for the race",
          receiptId: "r1",
        },
        {
          confidence: { project: 0.9 },
          projectId: "none",
          reason: "Next year's race",
          receiptId: "r2",
        },
        {
          confidence: { project: 0.9 },
          projectId: "none",
          reason: "Unsure",
          receiptId: "r3",
        },
      ],
    });

    // Last year's edition is refused; the approver learns next year's is missing.
    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "project_not_created",
        data: { series: "BBL", year: 2027 },
      },
    ]);
    // The check's own report of the missing edition is taken as it is.
    expect(hintsFor(store, "r2")).toEqual([
      {
        attachmentId: "r2",
        code: "project_not_created",
        data: { series: "BBL", year: 2027 },
      },
    ]);
    // A project that exists is not "not created": the approver looks instead.
    expect(hintsFor(store, "r3").map((h) => h.code)).toEqual([
      "project_unsure",
    ]);
    expect(
      flagEvents(store).find((event) => event.attachment_id === "r1")
    ).toMatchObject({ after: "BBL 2027", field: "project_not_created" });
  });

  it("an edition just held still takes its after-event costs", async () => {
    const store = setup([
      receipt("r1", { date: "2026-06-20T10:00:00.000+00:00" }),
    ]);

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "p-bbl26",
          reason: "Afterparty for the BBL 2026 volunteers",
          receiptId: "r1",
        },
      ],
    });

    expect(store.patchOf("r1")).toMatchObject({ project_id: "p-bbl26" });
    expect(hintsFor(store, "r1")).toEqual([]);
  });

  it("keeps the hints it does not touch", async () => {
    const store = setup([receipt("r1", { cost_type: "food" })], {
      hints: [
        { attachmentId: "r1", code: "old_receipt", data: { days: 120 } },
        { code: "occasion_missing" },
      ],
      projectShare: 0.1,
    });

    await checkAndApply(store, {
      flags: [
        {
          code: "type_unsure",
          note: "Hard to tell from the receipt",
          receiptId: "r1",
        },
      ],
      receipts: [{ confidence: {}, reason: "Type unclear", receiptId: "r1" }],
    });

    expect(storedHints(store)).toEqual([
      { attachmentId: "r1", code: "old_receipt", data: { days: 120 } },
      { code: "occasion_missing" },
      {
        attachmentId: "r1",
        code: "type_unsure",
        data: { reason: "Hard to tell from the receipt" },
      },
    ]);
  });
  it("a flag stores a short reason, and the history keeps it whole", async () => {
    const store = setup([receipt("r1")], { projectShare: 0.1 });
    const reason = `Pizza or a gift: ${"the receipt is hard to read ".repeat(10)}`;

    await checkAndApply(store, {
      flags: [{ code: "type_unsure", note: reason, receiptId: "r1" }],
      receipts: [{ confidence: {}, reason: "Unclear", receiptId: "r1" }],
    });

    const [hint] = hintsFor(store, "r1");
    expect(hint?.code).toBe("type_unsure");
    expect(Array.from(String(hint?.data?.reason)).length).toBeLessThanOrEqual(
      120
    );
    expect(flagEvents(store)[0]?.note).toBe(reason.trim());
  });

  it("a kept AI type the check doubts is flagged unsure", async () => {
    const store = setup(
      [
        receipt("r1", {
          account_number: 7350,
          account_source: "type",
          ai_confidence: 0.9,
          ai_cost_type: "food",
          cost_type: "food",
          type_source: "ai",
        }),
        receipt("r2", {
          account_number: 6800,
          account_source: "type",
          cost_type: "other",
          type_source: null,
        }),
      ],
      { projectShare: 0.1 }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.5 },
          reason: "Could be groceries for an event",
          receiptId: "r1",
          type: "food",
        },
        {
          confidence: { type: 0.4 },
          reason: "Nothing fits better",
          receiptId: "r2",
          type: "other",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(store.patchOf("r2")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "type_unsure",
        data: { reason: "Could be groceries for an event" },
      },
    ]);
    expect(hintsFor(store, "r2").map((h) => h.code)).toEqual(["type_unsure"]);
  });

  it("a kept project the check doubts is flagged unsure", async () => {
    const store = setup(
      [
        receipt("r1", {
          date: "2026-09-20T10:00:00.000+00:00",
          project_confidence: 0.9,
          project_id: "p-kd26",
          project_name: "KD 2026",
          project_source: "ai_check",
        }),
      ],
      { projectShare: 0.1 }
    );

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.5 },
          projectId: "p-kd26",
          reason: "KD or the autumn party",
          receiptId: "r1",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "project_unsure",
        data: { reason: "KD or the autumn party" },
      },
    ]);
  });

  it('"none" at low confidence is flagged project_unsure', async () => {
    const store = setup([receipt("r1")], { projectShare: 0.1 });

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.4 },
          projectId: "none",
          reason: "Maybe the race, maybe not",
          receiptId: "r1",
        },
      ],
    });

    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "project_unsure",
        data: { reason: "Maybe the race, maybe not" },
      },
    ]);
  });

  it("a student's type the check doubts gets no unsure hint", async () => {
    const student = {
      account_number: 7130,
      account_source: "type",
      cost_type: "travel",
      type_source: "student",
    };
    const store = setup([receipt("r1", student), receipt("r2", student)], {
      projectShare: 0.1,
    });

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.3 },
          reason: "Probably travel",
          receiptId: "r1",
          type: "travel",
        },
        {
          confidence: { type: 0.4 },
          reason: "Maybe food",
          receiptId: "r2",
          type: "food",
        },
      ],
    });

    expect(hintsFor(store, "r1")).toEqual([]);
    expect(hintsFor(store, "r2").map((h) => h.code)).toEqual([
      "ai_check_disagrees",
    ]);
  });

  it("a receipt with no date never gets last year's project", async () => {
    // Today (19 November) is long after BBL 2026 in June.
    const store = setup([receipt("r1", { date: null })]);

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "p-bbl26",
          reason: "Race costs",
          receiptId: "r1",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1")).toEqual([
      {
        attachmentId: "r1",
        code: "project_not_created",
        data: { series: "BBL", year: 2027 },
      },
    ]);
  });

  it("an edition with no event date is taken only when it is the newest, and flagged", async () => {
    const store = setup([receipt("r1"), receipt("r2")], {
      projects: [
        project("p-gala25", "Gala 2025", 2025),
        project("p-gala26", "Gala 2026", 2026),
      ],
    });

    await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "p-gala25",
          reason: "Gala decorations",
          receiptId: "r1",
        },
        {
          confidence: { project: 0.9 },
          projectId: "p-gala26",
          reason: "Gala tickets",
          receiptId: "r2",
        },
      ],
    });

    expect(store.patchOf("r1")).toEqual({});
    expect(hintsFor(store, "r1").map((h) => h.code)).toEqual([
      "project_unsure",
    ]);
    expect(store.patchOf("r2")).toMatchObject({ project_id: "p-gala26" });
    expect(hintsFor(store, "r2").map((h) => h.code)).toEqual([
      "project_unsure",
    ]);
  });

  it("a missing-project claim for the wrong year is not confirmed", async () => {
    // From September 2026 the next BBL is 2027, not 2028.
    const store = setup([receipt("r1")]);

    await checkAndApply(store, {
      flags: [
        {
          code: "project_not_created",
          note: "BBL 2028 is missing",
          receiptId: "r1",
          series: "bbl",
          year: 2028,
        },
      ],
      receipts: [
        {
          confidence: { project: 0.9 },
          projectId: "none",
          reason: "Next race",
          receiptId: "r1",
        },
      ],
    });

    expect(hintsFor(store, "r1").map((h) => h.code)).toEqual([
      "project_unsure",
    ]);
  });

  it("a re-run does not repeat flag history", async () => {
    const store = setup(
      [
        receipt("r1", {
          account_number: 7130,
          account_source: "type",
          cost_type: "travel",
          type_source: "student",
        }),
        receipt("r2", { cost_type: "food", type_source: "ai" }),
      ],
      { projectShare: 0.1 }
    );
    const answer: CheckAnswer = {
      flags: [{ code: "type_unsure", note: "Hard to read", receiptId: "r2" }],
      receipts: [
        {
          confidence: { type: 0.9 },
          reason: "Pizza",
          receiptId: "r1",
          type: "food",
        },
        { confidence: {}, reason: "Hard to read", receiptId: "r2" },
      ],
    };

    await checkAndApply(store, answer);
    const once = flagEvents(store).length;
    await checkAndApply(store, answer);

    expect(once).toBe(2);
    expect(flagEvents(store)).toHaveLength(once);
    expect(storedHints(store).map((h) => h.code)).toEqual([
      "ai_check_disagrees",
      "type_unsure",
    ]);
  });

  it("a failed save still records the changes that did save", async () => {
    const aiFood = {
      account_number: 7350,
      account_source: "type",
      ai_confidence: 0.9,
      ai_cost_type: "food",
      cost_type: "food",
      type_source: "ai",
    };
    const store = setup([receipt("r1", aiFood), receipt("r2", aiFood)], {
      projectShare: 0.1,
    });
    store.failUpdates.add("expense_attachments/r2");
    const unsure = (receiptId: string) => ({
      confidence: { type: 0.5 },
      reason: "A cab, probably",
      receiptId,
      type: "taxi",
    });
    silenceErrors();

    await expect(
      checkAndApply(store, {
        flags: [],
        receipts: [unsure("r1"), unsure("r2")],
      })
    ).rejects.toThrow();

    expect(store.patchOf("r1")).toMatchObject({ cost_type: "taxi" });
    const classified = store
      .events()
      .filter((event) => event.action === "ai_classified")
      .map((event) => event.attachment_id);
    expect(classified).toEqual(["r1"]);
    expect(hintsFor(store, "r1").map((h) => h.code)).toEqual(["type_unsure"]);
    expect(hintsFor(store, "r2")).toEqual([]);
    expect(flagEvents(store).map((event) => event.attachment_id)).toEqual([
      "r1",
    ]);
  });

  it("receipts the answer leaves out are flagged incomplete", async () => {
    const store = setup(
      [receipt("r1"), receipt("r2"), receipt("r3", { amount: 0 })],
      { projectShare: 0.1 }
    );

    const result = await checkAndApply(store, {
      flags: [],
      receipts: [
        {
          confidence: { type: 0.95 },
          reason: "Taxi",
          receiptId: "r1",
          type: "taxi",
        },
      ],
    });

    // The rest of the answer still counts; the receipt it left out is untouched.
    expect(store.patchOf("r1")).toMatchObject({ cost_type: "taxi" });
    expect(store.patchOf("r2")).toEqual({});
    expect(result.unchecked).toBe(1);
    expect(storedHints(store)).toContainEqual({
      code: "ai_check_incomplete",
      data: { unchecked: 1 },
    });
    expect(flagEvents(store)).toContainEqual(
      expect.objectContaining({ field: "ai_check_incomplete" })
    );
  });
});
