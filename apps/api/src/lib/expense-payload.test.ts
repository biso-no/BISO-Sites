import { ExpensesStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  mergeLegacyAttachmentTypes,
  mergeLegacyDraft,
  parseExpensePayload,
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
        date: "2026-04-28",
        description: "Lunch receipt",
        sort_order: 0,
        type: "image/jpeg",
        url: "file-id",
      },
    ]);
    // Not sent, so not written: an old client works against a schema
    // without these columns.
    expect(row).not.toHaveProperty("occasion");
    expect(row).not.toHaveProperty("event_id");
  });

  it("cuts an event name to the column's 100 characters instead of refusing it", () => {
    const long = parseExpensePayload({ ...BASE, eventName: "e".repeat(150) });
    expect(long?.eventName).toBe("e".repeat(100));
    expect(buildExpenseRowInput(long!, "user-id").eventName).toHaveLength(100);

    expect(
      parseExpensePayload({ ...BASE, eventName: "Fadderuka" })?.eventName
    ).toBe("Fadderuka");
    expect(
      parseExpensePayload({ ...BASE, eventName: null })?.eventName
    ).toBeNull();
    expect(parseExpensePayload(BASE)?.eventName).toBeUndefined();
  });

  it("writes an occasion and event sent as null, which clears them", () => {
    const payload = parseExpensePayload({
      ...BASE,
      event_id: null,
      expenseAttachments: [
        {
          amount: 50,
          cost_type: "social",
          cost_type_chosen: true,
          cost_type_text: null,
          url: "f1",
        },
      ],
      occasion: null,
    });
    const row = buildExpenseRowInput(payload!, "user-id");
    expect(row).toHaveProperty("occasion", null);
    expect(row).toHaveProperty("event_id", null);
    // Attachment rows are new on each save, so there is nothing to clear.
    expect(row.expenseAttachments[0]).not.toHaveProperty("cost_type_text");

    const blank = parseExpensePayload({ ...BASE, event_id: "", occasion: " " });
    expect(buildExpenseRowInput(blank!, "user-id")).toMatchObject({
      event_id: null,
      occasion: null,
    });
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
    expect(row.expenseAttachments[1]).not.toHaveProperty("cost_type_text");
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
      "date",
      "description",
      "sort_order",
      "type",
      "url",
    ]);
  });

  it("mergeLegacyDraft keeps the stored occasion, event and types for a legacy re-save", () => {
    const stored = {
      event_id: "event-1",
      expenseAttachments: [
        { cost_type: "", cost_type_text: "Flowers", url: "file-1" },
      ],
      occasion: "Board meeting",
    };
    const legacy = parseExpensePayload({
      ...BASE,
      expenseAttachments: [{ amount: 50, cost_type: "social", url: "file-1" }],
    });
    const merged = mergeLegacyDraft(legacy!, stored);
    expect(merged.occasion).toBe("Board meeting");
    expect(merged.event_id).toBe("event-1");
    expect(merged.expenseAttachments?.[0]).toMatchObject({
      cost_type: "",
      cost_type_text: "Flowers",
    });
    expect(buildExpenseRowInput(merged, "user-id")).toMatchObject({
      event_id: "event-1",
      occasion: "Board meeting",
    });

    // A value the payload does send is taken as sent.
    const sent = parseExpensePayload({
      ...BASE,
      event_id: null,
      expenseAttachments: [{ amount: 50, url: "file-1" }],
      occasion: "Team lunch",
    });
    expect(mergeLegacyDraft(sent!, stored)).toMatchObject({
      event_id: null,
      occasion: "Team lunch",
    });

    // A client that knows the fields is taken as sent: leaving them out
    // writes nothing, so a draft update keeps the stored values.
    const current = parseExpensePayload({
      ...BASE,
      expenseAttachments: [
        {
          amount: 50,
          cost_type: "social",
          cost_type_chosen: true,
          url: "file-1",
        },
      ],
    });
    const kept = mergeLegacyDraft(current!, stored);
    expect(kept.occasion).toBeUndefined();
    expect(kept.event_id).toBeUndefined();
    expect(kept.expenseAttachments?.[0]?.cost_type).toBe("social");
    const keptRow = buildExpenseRowInput(kept, "user-id");
    expect(keptRow).not.toHaveProperty("occasion");
    expect(keptRow).not.toHaveProperty("event_id");

    // Sending null clears them.
    const cleared = parseExpensePayload({
      ...BASE,
      event_id: null,
      expenseAttachments: [
        { amount: 50, cost_type_chosen: true, url: "file-1" },
      ],
      occasion: null,
    });
    expect(
      buildExpenseRowInput(mergeLegacyDraft(cleared!, stored), "user-id")
    ).toMatchObject({ event_id: null, occasion: null });

    // A legacy re-save over a draft without them writes them as stored.
    const empty = mergeLegacyDraft(legacy!, {
      event_id: null,
      expenseAttachments: [],
      occasion: null,
    });
    expect(buildExpenseRowInput(empty, "user-id")).toMatchObject({
      event_id: null,
      occasion: null,
    });
  });

  it("keeps a legacy app's changed slug", () => {
    // Old apps load the draft's stored slug and send it back, so a different
    // slug is the student's edit, and an unchanged one is the same choice.
    const payload = parseExpensePayload({
      ...BASE,
      expenseAttachments: [
        { amount: "20", cost_type: "travel", url: "file-2" },
        { amount: "30", cost_type: "social", url: "file-3" },
        { amount: "40", cost_type: "academic", url: "file-4" },
        { amount: "60", cost_type: "travel", url: "file-5" },
      ],
    });
    const merged = mergeLegacyAttachmentTypes(payload!.expenseAttachments!, [
      {
        cost_type: "meeting-food",
        cost_type_text: null,
        url: "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-2/view",
      },
      { cost_type: "social", cost_type_text: null, url: "file-3" },
      // Text next to a slug is not own text the app hid: the slug was shown.
      { cost_type: "social", cost_type_text: "Snacks", url: "file-5" },
    ]);
    expect(
      merged.map(({ cost_type, cost_type_text }) => ({
        cost_type,
        cost_type_text,
      }))
    ).toEqual([
      { cost_type: "travel", cost_type_text: undefined },
      { cost_type: "social", cost_type_text: undefined },
      { cost_type: "academic", cost_type_text: undefined },
      { cost_type: "travel", cost_type_text: undefined },
    ]);
  });

  it("restores web own text the old app could not show", () => {
    const payload = parseExpensePayload({
      ...BASE,
      expenseAttachments: [
        // The old app can't show own text and sends its category default.
        { amount: "50", cost_type: "social", url: "file-1" },
        { amount: "10", url: "file-2" },
        // A client that sends cost_type_chosen is taken as sent.
        {
          amount: "30",
          cost_type: "travel",
          cost_type_chosen: true,
          url: "file-3",
        },
      ],
    });
    const merged = mergeLegacyAttachmentTypes(payload!.expenseAttachments!, [
      { cost_type: "", cost_type_text: "Flowers", url: "file-1" },
      { cost_type: null, cost_type_text: "Taxi to venue", url: "file-2" },
      { cost_type: "", cost_type_text: "Gift card", url: "file-3" },
    ]);
    expect(
      merged.map(({ cost_type, cost_type_text }) => ({
        cost_type,
        cost_type_text,
      }))
    ).toEqual([
      { cost_type: "", cost_type_text: "Flowers" },
      { cost_type: "", cost_type_text: "Taxi to venue" },
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

  it("treats a missing controller flag as false", () => {
    const payload = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "1",
    });

    // Left out, not false: a draft update keeps the stored flag.
    expect(payload?.submitter_is_controller).toBeUndefined();
    expect(buildExpenseRowInput(payload!, "u").submitter_is_controller).toBe(
      false
    );
  });

  it("keeps the stored controller flag when a payload leaves it out", () => {
    const stored = {
      campus: "1",
      department: "2",
      submitter_is_controller: true,
    };
    const oldApp = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "2",
      expenseAttachments: [{ amount: 50, cost_type: "social", url: "file-1" }],
    });

    const merged = mergeLegacyDraft(oldApp!, stored);
    expect(merged.submitter_is_controller).toBe(true);
    expect(buildExpenseRowInput(merged, "u").submitter_is_controller).toBe(
      true
    );

    // A client that sends the flag is taken as sent.
    const switchedOff = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "2",
      submitter_is_controller: false,
    });
    expect(
      buildExpenseRowInput(mergeLegacyDraft(switchedOff!, stored), "u")
        .submitter_is_controller
    ).toBe(false);

    // Nothing stored reads as false.
    expect(
      buildExpenseRowInput(
        mergeLegacyDraft(oldApp!, { submitter_is_controller: null }),
        "u"
      ).submitter_is_controller
    ).toBe(false);

    // A department without the switch still drops a kept flag.
    const elsewhere = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "dept-x",
    });
    expect(
      buildExpenseRowInput(mergeLegacyDraft(elsewhere!, stored), "u")
        .submitter_is_controller
    ).toBe(false);
  });

  it("drops the kept controller flag when the department changes", () => {
    const stored = {
      campus: "1",
      department: "2",
      submitter_is_controller: true,
    };
    const moved = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "3",
    });
    expect(
      mergeLegacyDraft(moved!, stored).submitter_is_controller
    ).toBeUndefined();

    const otherCampus = parseExpensePayload({
      ...BASE,
      campus: "2",
      department: "2",
    });
    expect(
      mergeLegacyDraft(otherCampus!, stored).submitter_is_controller
    ).toBeUndefined();
  });

  it("keeps it when campus and department match", () => {
    const stored = {
      campus: "1",
      department: "2",
      submitter_is_controller: true,
    };
    const same = parseExpensePayload({ ...BASE, campus: "1", department: "2" });
    expect(mergeLegacyDraft(same!, stored).submitter_is_controller).toBe(true);
  });

  it("keeps a switch the department offers", () => {
    const payload = parseExpensePayload({
      ...BASE,
      campus: "1",
      department: "1",
      submitter_is_controller: true,
    });

    expect(buildExpenseRowInput(payload!, "u")).toMatchObject({
      submitter_is_controller: true,
      submitter_is_financial_manager: false,
    });
  });

  it("stores a switch the department does not offer as false", () => {
    const payload = parseExpensePayload({
      ...BASE,
      campus: "2",
      department: "some-dept",
      submitter_is_controller: true,
      submitter_is_financial_manager: true,
    });

    expect(buildExpenseRowInput(payload!, "u")).toMatchObject({
      submitter_is_controller: false,
      submitter_is_financial_manager: false,
    });
  });
});
