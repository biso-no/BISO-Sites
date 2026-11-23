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
  project_id: string | null;
  project_name: string | null;
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

/** True when the AI was sure of the type the receipt carries. */
function aiConfidentlyAgrees(
  att: Pick<ExpenseAttachments, "cost_type" | "ai_cost_type" | "ai_confidence">
): boolean {
  return (
    !!att.cost_type &&
    att.ai_cost_type === att.cost_type &&
    (att.ai_confidence ?? 0) >= AI_TYPE_CONFIDENCE_THRESHOLD
  );
}

/**
 * Whether a receipt's type may teach later classifications. An old app sends
 * its default type unasked, and a receipt with no source was defaulted by the
 * server unless the AI chose the same type, so such a type counts only when
 * the AI was sure of it. Nobody saw that pick at upload: the example waits
 * for booking (see `exampleTeaches`).
 */
export function typeTeaches(
  att: Pick<
    ExpenseAttachments,
    "type_source" | "cost_type" | "ai_cost_type" | "ai_confidence"
  >
): boolean {
  if (att.type_source && att.type_source !== "legacy_app") {
    return true;
  }
  return aiConfidentlyAgrees(att);
}

/**
 * Whether a stored example may go into a prompt or be scored. A type that only
 * the AI chose or checked (an old app's, or one the server would have
 * defaulted) was seen by nobody, so it waits until the reimbursement is
 * booked. An example with neither shop nor description says nothing about the
 * receipt.
 */
export function exampleTeaches(
  row: Pick<
    ExpenseTypeExamples,
    | "confirmed"
    | "description"
    | "final_cost_type"
    | "type_source"
    | "vendor_key"
  >
): boolean {
  if (!row.final_cost_type) {
    return false;
  }
  const unseen = !row.type_source || row.type_source === "legacy_app";
  if (row.confirmed !== true && unseen) {
    return false;
  }
  return Boolean(row.vendor_key?.trim() || row.description?.trim());
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
    // The attachment and example enums are distinct generated types with the same values.
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
    project_id: att.project_id ?? null,
    project_name: att.project_name ?? null,
    source: exampleSource(att),
    type_source: (att.type_source ?? null) as ExampleRow["type_source"],
    vendor_key: normalizeVendor(input.scan?.vendor),
  };
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
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

/** Deletes an example (a 404 means it is already gone) and clears the link. */
async function dropExample(
  db: ExamplesDb,
  attachmentId: string,
  exampleId: string
): Promise<void> {
  try {
    await db.deleteRow("app", EXAMPLES_TABLE, exampleId);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
  await link(db, attachmentId, null);
}

/** The example the receipt is linked to as stored now. */
async function linkedExampleId(
  db: ExamplesDb,
  attachmentId: string
): Promise<string | null> {
  const row = (await db.getRow("app", ATTACHMENTS_TABLE, attachmentId, [
    Query.select(["$id", "example_id"]),
  ])) as { example_id?: string | null } | null;
  return row?.example_id || null;
}

async function createExample(
  db: ExamplesDb,
  attachmentId: string,
  fields: ExampleRow
): Promise<string | null> {
  const id = ID.unique();
  await db.createRow("app", EXAMPLES_TABLE, id, {
    ...fields,
    confirmed: fields.confirmed ?? false,
  });
  try {
    await link(db, attachmentId, id);
  } catch (error) {
    // Never leave an unlinked example that nothing can update or delete.
    await db.deleteRow("app", EXAMPLES_TABLE, id).catch(() => undefined);
    throw error;
  }
  // Two syncs of a receipt without an example can each create one. The
  // receipt keeps the one linked last; the other is deleted here.
  let linked: string | null;
  try {
    linked = await linkedExampleId(db, attachmentId);
  } catch {
    return id;
  }
  if (linked !== id) {
    await db.deleteRow("app", EXAMPLES_TABLE, id).catch(() => undefined);
  }
  return linked;
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
        await dropExample(db, attachment.$id, existingId);
      }
      return null;
    }
    if (existingId) {
      // Leave `confirmed` out so the stored value stays when none is given.
      const { confirmed, ...rest } = fields;
      const data = confirmed === undefined ? rest : fields;
      try {
        await db.updateRow("app", EXAMPLES_TABLE, existingId, data);
        return existingId;
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
        // The example was deleted: drop the dead link and make a new one.
        await link(db, attachment.$id, null);
      }
    }
    return await createExample(db, attachment.$id, fields);
  } catch (error) {
    console.error(
      `[expense-examples] failed to sync example for receipt ${attachment.$id}`,
      error
    );
    return null;
  }
}

/** Mirrors how the api reads a stored scan; only vendor and description matter here. */
export async function readExampleScan(
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
      receipt?: {
        description?: unknown;
        receiptIssues?: unknown;
        vendor?: unknown;
      } | null;
    } | null;
    const receipt = parsed?.receipt;
    if (
      typeof receipt !== "object" ||
      receipt === null ||
      !Array.isArray(receipt.receiptIssues)
    ) {
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
        ? await readExampleScan(db, attachment.file_hash)
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
        await dropExample(db, attachment.$id, attachment.example_id);
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
