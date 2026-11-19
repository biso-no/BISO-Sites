import { describe, expect, it, vi } from "vitest";
import {
  deleteExamplesForExpense,
  exampleFields,
  normalizeVendor,
  syncExample,
  syncExamplesForExpense,
  typeTeaches,
} from "./expense-examples";

function att(over: Record<string, unknown> = {}) {
  return {
    $id: "att-1",
    account_number: 7140,
    account_source: "type",
    ai_confidence: 0.9,
    ai_cost_type: "social",
    amount: 250,
    cost_type: "social",
    cost_type_text: null,
    example_id: null,
    file_hash: "hash-1",
    type_source: "student",
    ...over,
  } as never;
}

const scan = {
  description: "Pizza for the kickoff",
  vendor: "Peppes Pizza AS",
};

function makeDb() {
  return {
    createRow: vi.fn().mockResolvedValue({}),
    deleteRow: vi.fn().mockResolvedValue({}),
    getRow: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn().mockResolvedValue({}),
  };
}

describe("normalizeVendor", () => {
  it("drops case, legal suffix and punctuation", () => {
    expect(normalizeVendor("Peppes Pizza AS")).toBe("peppes pizza");
    expect(normalizeVendor("REMA 1000, Majorstuen")).toBe(
      "rema 1000 majorstuen"
    );
  });

  it("keeps Norwegian letters and strips other diacritics", () => {
    expect(normalizeVendor("Café Ærø Å")).toBe("cafe ærø å");
  });

  it("returns empty for missing vendors", () => {
    expect(normalizeVendor(null)).toBe("");
    expect(normalizeVendor(undefined)).toBe("");
    expect(normalizeVendor("  ")).toBe("");
  });
});

describe("typeTeaches", () => {
  it("teaches the AI's and the student's own choices", () => {
    expect(typeTeaches(att({ type_source: "ai" }))).toBe(true);
    expect(typeTeaches(att({ type_source: "student" }))).toBe(true);
    expect(typeTeaches(att({ type_source: "approver" }))).toBe(true);
    expect(typeTeaches(att({ type_source: "admin" }))).toBe(true);
  });

  it("never teaches a server default", () => {
    expect(typeTeaches(att({ type_source: null }))).toBe(false);
  });

  it("teaches a legacy app type only when it matches a confident AI type", () => {
    const legacy = { type_source: "legacy_app" };
    expect(
      typeTeaches(
        att({ ...legacy, ai_cost_type: "social", ai_confidence: 0.8 })
      )
    ).toBe(true);
    expect(
      typeTeaches(
        att({ ...legacy, ai_cost_type: "social", ai_confidence: 0.7 })
      )
    ).toBe(false);
    expect(
      typeTeaches(att({ ...legacy, ai_cost_type: "other", ai_confidence: 0.9 }))
    ).toBe(false);
  });
});

describe("exampleFields", () => {
  const base = { departmentId: "dept-1", scan };

  it("a defaulted receipt teaches no type", () => {
    expect(
      exampleFields({ ...base, attachment: att({ type_source: null }) })
    ).toBeNull();
  });

  it("own text becomes an example without a type", () => {
    const row = exampleFields({
      ...base,
      attachment: att({ cost_type_text: "Team dinner", type_source: null }),
    });
    expect(row?.final_text).toBe("Team dinner");
    expect(row?.final_cost_type).toBeNull();
  });

  it("a supporting document gives no example", () => {
    expect(
      exampleFields({ ...base, attachment: att({ amount: 0 }) })
    ).toBeNull();
  });

  it("an approver type change is a human source", () => {
    const row = exampleFields({
      ...base,
      attachment: att({ type_source: "approver" }),
      confirmed: true,
    });
    expect(row?.source).toBe("approver");
    expect(row?.confirmed).toBe(true);
    expect(row?.vendor_key).toBe("peppes pizza");
    expect(row?.department_id).toBe("dept-1");
    expect(row?.final_cost_type).toBe("social");
  });

  it("an account override wins and counts as a human source", () => {
    const row = exampleFields({
      ...base,
      accountNumber: 7777,
      attachment: att({ account_source: "admin" }),
    });
    expect(row?.account_number).toBe(7777);
    expect(row?.source).toBe("admin");
  });

  it("cuts the scan description to 255 characters", () => {
    const row = exampleFields({
      ...base,
      attachment: att(),
      scan: { description: "x".repeat(400), vendor: "A" },
    });
    expect(row?.description).toHaveLength(255);
  });
});

describe("syncExample", () => {
  const input = { confirmed: false, departmentId: "dept-1", scan };

  it("sync creates once and links the receipt", async () => {
    const db = makeDb();
    const id = await syncExample(db, { ...input, attachment: att() });
    expect(id).toEqual(expect.any(String));
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "expense_type_examples",
      id,
      expect.objectContaining({ confirmed: false, vendor_key: "peppes pizza" })
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { example_id: id }
    );
  });

  it("sync updates a linked example", async () => {
    const db = makeDb();
    const id = await syncExample(db, {
      ...input,
      attachment: att({ example_id: "ex-1" }),
      confirmed: true,
    });
    expect(id).toBe("ex-1");
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_type_examples",
      "ex-1",
      expect.objectContaining({ confirmed: true })
    );
  });

  it("an undefined confirmed keeps the stored value on update", async () => {
    const db = makeDb();
    await syncExample(db, {
      attachment: att({ example_id: "ex-1" }),
      departmentId: null,
      scan,
    });
    const data = db.updateRow.mock.calls[0][3];
    expect("confirmed" in data).toBe(false);
  });

  it("an undefined confirmed means false on create", async () => {
    const db = makeDb();
    await syncExample(db, {
      attachment: att(),
      departmentId: null,
      scan,
    });
    expect(db.createRow.mock.calls[0][3].confirmed).toBe(false);
  });

  it("sync deletes an example that no longer teaches", async () => {
    const db = makeDb();
    const id = await syncExample(db, {
      ...input,
      attachment: att({ example_id: "ex-1", type_source: null }),
    });
    expect(id).toBeNull();
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "expense_type_examples",
      "ex-1"
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { example_id: null }
    );
  });

  it("the example stores no submitter, expense or attachment id", async () => {
    const db = makeDb();
    await syncExample(db, { ...input, attachment: att() });
    expect(Object.keys(db.createRow.mock.calls[0][3]).sort()).toEqual(
      [
        "account_number",
        "account_source",
        "ai_confidence",
        "ai_cost_type",
        "amount",
        "confirmed",
        "department_id",
        "description",
        "final_cost_type",
        "final_text",
        "source",
        "type_source",
        "vendor_key",
      ].sort()
    );
  });

  it("logs and swallows a failed write", async () => {
    const db = makeDb();
    db.createRow.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      syncExample(db, { ...input, attachment: att() })
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("syncExamplesForExpense", () => {
  it("syncs every attachment with its scan and the expense department", async () => {
    const db = makeDb();
    db.getRow.mockResolvedValue({
      department: "dept-9",
      expenseAttachments: [
        att({ account_number: 7140 }),
        att({ $id: "att-2", amount: 0 }),
      ],
    });
    db.listRows.mockResolvedValue({
      rows: [
        {
          result: JSON.stringify({
            receipt: {
              description: "Lunch",
              receiptIssues: [],
              vendor: "Rema 1000 AS",
            },
          }),
        },
      ],
    });
    await syncExamplesForExpense(db, "exp-1", {
      accountByAttachment: new Map([["att-1", 7999]]),
      confirmed: true,
    });
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.createRow.mock.calls[0][3]).toMatchObject({
      account_number: 7999,
      confirmed: true,
      department_id: "dept-9",
      description: "Lunch",
      vendor_key: "rema 1000",
    });
  });

  it("treats an unreadable scan as no scan", async () => {
    const db = makeDb();
    db.getRow.mockResolvedValue({
      department: "d",
      expenseAttachments: [att({ cost_type_text: "x" })],
    });
    db.listRows.mockResolvedValue({ rows: [{ result: "not json" }] });
    await syncExamplesForExpense(db, "exp-1", { confirmed: false });
    expect(db.createRow.mock.calls[0][3].vendor_key).toBe("");
  });
});

describe("scan reading", () => {
  it("ignores a scan without a receiptIssues array", async () => {
    const db = makeDb();
    db.getRow.mockResolvedValue({
      department: "d",
      expenseAttachments: [att()],
    });
    db.listRows.mockResolvedValue({
      rows: [
        {
          result: JSON.stringify({
            receipt: { description: "Lunch", vendor: "Rema" },
          }),
        },
      ],
    });
    await syncExamplesForExpense(db, "exp-1", { confirmed: false });
    const data = db.createRow.mock.calls[0][3];
    expect(data.vendor_key).toBe("");
    expect(data.description).toBe("");
  });
});

describe("orphans and missing rows", () => {
  it("removes a just-created example when the link write fails", async () => {
    const db = makeDb();
    db.updateRow.mockRejectedValue(new Error("link failed"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = await syncExample(db, {
      attachment: att(),
      confirmed: false,
      departmentId: null,
      scan,
    });
    spy.mockRestore();
    expect(id).toBeNull();
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "expense_type_examples",
      db.createRow.mock.calls[0][2]
    );
  });

  it("treats a 404 on delete as already deleted and clears the link", async () => {
    const db = makeDb();
    db.deleteRow.mockRejectedValue({ code: 404 });
    await syncExample(db, {
      attachment: att({ example_id: "ex-1", type_source: null }),
      confirmed: false,
      departmentId: null,
      scan,
    });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { example_id: null }
    );
  });
});

describe("deleteExamplesForExpense", () => {
  it("deletes each linked example and clears the link", async () => {
    const db = makeDb();
    db.getRow.mockResolvedValue({
      expenseAttachments: [att({ example_id: "ex-1" }), att({ $id: "att-2" })],
    });
    await deleteExamplesForExpense(db, "exp-1");
    expect(db.deleteRow).toHaveBeenCalledTimes(1);
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "expense_type_examples",
      "ex-1"
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { example_id: null }
    );
  });
});
