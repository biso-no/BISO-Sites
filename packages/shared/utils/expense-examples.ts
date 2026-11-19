// Turns a receipt into an anonymous `expense_type_examples` row and keeps it in
// sync through the receipt's `example_id`. Shared by the api (submit, rejection,
// booking) and the admin app (approver and admin edits).
//
// An example never stores a submitter, name, expense id, attachment id or the
// student's own description: examples go into other students' prompts.

import { ID, Query } from "@repo/api";
import type {
  ExpenseAttachments,
  ExpenseTypeExamples,
} from "@repo/api/types/appwrite";
import { AI_TYPE_CONFIDENCE_THRESHOLD } from "./expense-cost-types";

export interface ExamplesDb {
  createRow: (
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
  deleteRow: (
    databaseId: string,
    tableId: string,
    rowId: string
  ) => Promise<unknown>;
  getRow: (
    databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ) => Promise<unknown>;
  listRows: (
    databaseId: string,
    tableId: string,
    queries?: string[]
  ) => Promise<{ rows: unknown[] }>;
  updateRow: (
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
}

type ExampleSource = ExpenseTypeExamples["source"];

export interface ExampleRow {
  account_number: number | null;
  account_source: ExpenseTypeExamples["account_source"];
  ai_confidence: number | null;
  ai_cost_type: string | null;
  amount: number | null;
  /** Undefined keeps the stored value on update and means false on create. */
  confirmed?: boolean;
  department_id: string | null;
  description: string;
  final_cost_type: string | null;
  final_text: string | null;
  source: ExampleSource;
  type_source: ExpenseTypeExamples["type_source"];
  vendor_key: string;
}

export interface ExampleScan {
  description: string | null;
  vendor: string | null;
}

export interface ExampleInput {
  accountNumber?: number | null;
  attachment: ExpenseAttachments;
  confirmed?: boolean;
  departmentId: string | null;
  scan: ExampleScan | null;
}

const DESCRIPTION_MAX = 255;
const VENDOR_KEY_MAX = 120;
const EXAMPLES_TABLE = "expense_type_examples";
const ATTACHMENTS_TABLE = "expense_attachments";
const EXPENSE_TABLE = "expense";

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;
const LEGAL_SUFFIX = /\s(?:as|asa|ab|ltd|inc)$/;
const KEPT_LETTERS = new Set(["æ", "ø", "å"]);

function stripDiacritics(text: string): string {
  let out = "";
  for (const char of text) {
    out += KEPT_LETTERS.has(char)
      ? char
      : char.normalize("NFD").replace(COMBINING_MARKS, "");
  }
  return out;
}

export function normalizeVendor(vendor: string | null | undefined): string {
  if (!vendor) {
    return "";
  }
  const cleaned = stripDiacritics(vendor.toLowerCase())
    .replace(NON_WORD, " ")
    .replace(WHITESPACE, " ")
    .trim()
    .replace(LEGAL_SUFFIX, "")
    .trim();
  return cleaned.slice(0, VENDOR_KEY_MAX);
}

/**
 * Whether a receipt's type may teach later classifications. An old app sends
 * its default type unasked, so its type counts only when the AI was sure of
 * the same one.
 */
export function typeTeaches(
  att: Pick<
    ExpenseAttachments,
    "type_source" | "cost_type" | "ai_cost_type" | "ai_confidence"
  >
): boolean {
  // No source means the server defaulted the type; nobody chose it.
  if (!att.type_source) {
    return false;
  }
  if (att.type_source !== "legacy_app") {
    return true;
  }
  return (
    !!att.cost_type &&
    att.ai_cost_type === att.cost_type &&
    (att.ai_confidence ?? 0) >= AI_TYPE_CONFIDENCE_THRESHOLD
  );
}

function humanSource(
  value: string | null | undefined
): "approver" | "admin" | null {
  return value === "approver" || value === "admin" ? value : null;
}

function exampleSource(att: ExpenseAttachments): ExampleSource {
  const source =
    humanSource(att.type_source) ?? humanSource(att.account_source);
  return (source ?? "student") as ExampleSource;
}

/** The example a receipt stands for, or null when it should have none. */
export function exampleFields(input: ExampleInput): ExampleRow | null {
  const { attachment: att } = input;
  // Supporting documents (bank statements) carry no amount of their own.
  if (!att.amount || att.amount <= 0) {
    return null;
  }
  const teaches = typeTeaches(att);
  const ownText = att.cost_type_text?.trim() || null;
  if (!(teaches || ownText)) {
    return null;
  }
  return {
    account_number: input.accountNumber ?? att.account_number ?? null,
    account_source: (att.account_source ??
      null) as ExampleRow["account_source"],
    ai_confidence: att.ai_confidence ?? null,
    ai_cost_type: att.ai_cost_type ?? null,
    amount: att.amount,
    confirmed: input.confirmed,
    department_id: input.departmentId,
    description: (input.scan?.description ?? "").slice(0, DESCRIPTION_MAX),
    final_cost_type: teaches ? att.cost_type || null : null,
    final_text: ownText,
    source: exampleSource(att),
    type_source: (att.type_source ?? null) as ExampleRow["type_source"],
    vendor_key: normalizeVendor(input.scan?.vendor),
  };
}

async function link(
  db: ExamplesDb,
  attachmentId: string,
  exampleId: string | null
): Promise<void> {
  await db.updateRow("app", ATTACHMENTS_TABLE, attachmentId, {
    example_id: exampleId,
  });
}

/**
 * Creates, updates or deletes the receipt's example so it matches the receipt.
 * Returns the example id, or null when there is none. Errors are logged and
 * swallowed: a submit, edit or booking never fails because of an example.
 */
export async function syncExample(
  db: ExamplesDb,
  input: ExampleInput
): Promise<string | null> {
  const { attachment } = input;
  const existingId = attachment.example_id || null;
  try {
    const fields = exampleFields(input);
    if (!fields) {
      if (existingId) {
        await db.deleteRow("app", EXAMPLES_TABLE, existingId);
        await link(db, attachment.$id, null);
      }
      return null;
    }
    if (existingId) {
      // Leave `confirmed` out so the stored value stays when none is given.
      const { confirmed, ...rest } = fields;
      const data = confirmed === undefined ? rest : fields;
      await db.updateRow("app", EXAMPLES_TABLE, existingId, data);
      return existingId;
    }
    const id = ID.unique();
    await db.createRow("app", EXAMPLES_TABLE, id, {
      ...fields,
      confirmed: fields.confirmed ?? false,
    });
    await link(db, attachment.$id, id);
    return id;
  } catch (error) {
    console.error(
      `[expense-examples] failed to sync example for receipt ${attachment.$id}`,
      error
    );
    return null;
  }
}

/** Mirrors how the api reads a stored scan; only vendor and description matter here. */
async function readScan(
  db: ExamplesDb,
  fileHash: string
): Promise<ExampleScan | null> {
  try {
    const { rows } = await db.listRows("app", "expense_receipt_scans", [
      Query.equal("file_hash", fileHash),
      Query.limit(1),
    ]);
    const row = rows[0] as { result?: string } | undefined;
    if (!row?.result) {
      return null;
    }
    const parsed = JSON.parse(row.result) as {
      receipt?: { description?: unknown; vendor?: unknown } | null;
    } | null;
    const receipt = parsed?.receipt;
    if (typeof receipt !== "object" || receipt === null) {
      return null;
    }
    return {
      description:
        typeof receipt.description === "string" ? receipt.description : null,
      vendor: typeof receipt.vendor === "string" ? receipt.vendor : null,
    };
  } catch {
    return null;
  }
}

interface ExpenseWithAttachments {
  department?: string | { $id: string } | null;
  expenseAttachments?: ExpenseAttachments[];
}

function departmentIdOf(expense: ExpenseWithAttachments): string | null {
  const { department } = expense;
  if (!department) {
    return null;
  }
  return typeof department === "string" ? department : department.$id;
}

export async function syncExamplesForExpense(
  db: ExamplesDb,
  expenseId: string,
  opts: { accountByAttachment?: Map<string, number>; confirmed: boolean }
): Promise<void> {
  try {
    const expense = (await db.getRow("app", EXPENSE_TABLE, expenseId, [
      Query.select(["department", "expenseAttachments.*"]),
    ])) as ExpenseWithAttachments;
    const departmentId = departmentIdOf(expense);
    for (const attachment of expense.expenseAttachments ?? []) {
      const scan = attachment.file_hash
        ? await readScan(db, attachment.file_hash)
        : null;
      await syncExample(db, {
        accountNumber: opts.accountByAttachment?.get(attachment.$id),
        attachment,
        confirmed: opts.confirmed,
        departmentId,
        scan,
      });
    }
  } catch (error) {
    console.error(
      `[expense-examples] failed to sync examples for expense ${expenseId}`,
      error
    );
  }
}

export async function deleteExamplesForExpense(
  db: ExamplesDb,
  expenseId: string
): Promise<void> {
  try {
    const expense = (await db.getRow("app", EXPENSE_TABLE, expenseId, [
      Query.select(["expenseAttachments.*"]),
    ])) as ExpenseWithAttachments;
    for (const attachment of expense.expenseAttachments ?? []) {
      if (!attachment.example_id) {
        continue;
      }
      try {
        await db.deleteRow("app", EXAMPLES_TABLE, attachment.example_id);
        await link(db, attachment.$id, null);
      } catch (error) {
        console.error(
          `[expense-examples] failed to delete example ${attachment.example_id}`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      `[expense-examples] failed to delete examples for expense ${expenseId}`,
      error
    );
  }
}
