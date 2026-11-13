// Loads what an approver needs on the Teams card and in the email: receipts
// with their type and account, the AI/system hints, the latest history lines,
// the submitter's self-declaration and the national-fallback note. Every lookup
// is best-effort: a failure leaves that part empty and the card still sends.

import { type Models, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  ExpenseApprovals,
  ExpenseAttachments,
  ExpenseEvents,
  Expenses,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import type { ApprovalCardData } from "@repo/connectors/teams-bot";
import { getCampusApprovalPlan } from "@repo/shared/utils/expense-approvers";
import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import {
  type ApproverHint,
  parseApproverHints,
} from "@repo/shared/utils/expense-hints";
import { loadAllCostTypes } from "./expense-types";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

export type ApprovalCardDetails = Pick<
  ApprovalCardData,
  | "declaration"
  | "fallbackNote"
  | "hints"
  | "history"
  | "missingAccount"
  | "receipts"
>;

const HISTORY_LIMIT = 6;
const APPROVAL_LIMIT = 20;
const NATIONAL_CAMPUS_ID = "5";
const MAX_REASON_CHARS = 120;
/** How much of a receipt's text names it in front of a hint. */
const RECEIPT_NAME_CHARS = 40;
const ISO_DATE_CHARS = 10;
const OSLO_TIME_ZONE = "Europe/Oslo";

const PRESIDENT_FALLBACK_NOTE =
  "The campus president could not be found or is the submitter; the general manager decides instead.";
const NATIONAL_FALLBACK_NOTE =
  "The general manager decides in place of the usual approver.";
const NATIONAL_CONTROLLER_FALLBACK_NOTE =
  "The controller could not be found or is the submitter; the general manager decides instead.";

// English copies of the admin's `adminPortal.expenses.hintsText.*` strings
// (packages/i18n/messages/en/adminPortal.json). The api has no i18n, so keep
// the two in step by hand.
const HINT_TEXT: Record<string, string> = {
  account_missing: "No account is set for this receipt type.",
  ai_account_unsure: "The AI was not sure which account to use.",
  amount_differs: "Entered amount is {entered}, but the receipt reads {read}.",
  app_type_replaced: 'The app said "{appType}"; the AI chose "{aiType}".',
  occasion_missing: "The occasion is missing.",
  old_receipt: "The receipt is {days} days old.",
  possible_duplicate: "Possible duplicate of another receipt.",
  possible_duplicate_number:
    "Possible duplicate of expense {reimbursementNumber}.",
  receipt_issue: "Receipt problem: {issue}.",
  type_defaulted: "No type was chosen, so Other was used.",
};

// English copies of `adminPortal.expenses.issues.*` for `receipt_issue` hints.
const RECEIPT_ISSUE_TEXT: Record<string, string> = {
  missing_date: "Date missing",
  missing_seller: "Seller missing",
  missing_total: "Total missing",
  no_items: "No items listed",
  not_a_receipt: "Does not look like a receipt",
  unreadable: "Hard to read",
};

const FIELD_WORDS: Record<string, string> = {
  account_number: "the account",
  amount: "the amount",
  approver_email: "the approver",
  bank_account: "the bank account",
  cost_type: "the type",
  cost_type_text: "the type text",
  date: "the date",
  description: "the description",
  occasion: "the occasion",
  total: "the total",
};

const ACTOR_KIND_NAMES: Record<string, string> = {
  admin: "An admin",
  ai: "AI",
  approver: "An approver",
  student: "The student",
  system: "The system",
};

const ON_BEHALF_NOTE = /^On behalf of (.+?)(?: · Reason: ([\s\S]*))?$/;
const REASON_NOTE = /^Reason: ([\s\S]*)$/;
const TRANSACTION_ID = /^\S+/;
const BOOKED_CUSTOMER = /\bcustomer (\d+)\b/;
const PLACEHOLDER = /\{(\w+)\}/g;

async function bestEffort<T>(
  what: string,
  fallback: T,
  load: () => Promise<T>
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[expense-card-details] ${what} failed:`, error);
    return fallback;
  }
}

function fill(template: string, data: Record<string, string | number>) {
  return template.replace(PLACEHOLDER, (_, key: string) =>
    String(data[key] ?? "")
  );
}

function hintSentence(hint: ApproverHint): string | null {
  const data = hint.data ?? {};
  if (hint.code === "receipt_issue") {
    const issue = String(data.issue ?? "");
    return fill(HINT_TEXT.receipt_issue ?? "", {
      issue: RECEIPT_ISSUE_TEXT[issue] ?? issue,
    });
  }
  const key =
    hint.code === "possible_duplicate" && data.reimbursementNumber
      ? "possible_duplicate_number"
      : hint.code;
  const template = HINT_TEXT[key];
  return template ? fill(template, data) : null;
}

/** The hint's sentence, led by the receipt it is about when it names one. */
function hintText(
  hint: ApproverHint,
  nameById: Map<string, string>
): string | null {
  const sentence = hintSentence(hint);
  const name = hint.attachmentId ? nameById.get(hint.attachmentId) : undefined;
  return sentence && name ? `${name}: ${sentence}` : sentence;
}

/** At most `max` characters, never splitting a surrogate pair. */
function shorten(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

function declarationText(expense: Expenses): string | null {
  const lines = [
    expense.submitter_is_controller &&
      "Submitter says they are the campus controller",
    expense.submitter_is_financial_manager &&
      "Submitter says they are the department's financial manager",
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("; ") : null;
}

function formatEventTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: OSLO_TIME_ZONE,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

/**
 * Whether the expense's plan has a step with this role. A president step exists
 * only for a controller's own claim on campuses 1-4; a national step on that
 * chain stands in for the president. On National a national step is the plan's
 * own only for the controller's own claim.
 */
function planHasRole(expense: Expenses, role: string): boolean {
  try {
    return getCampusApprovalPlan({
      campusId: String(expense.campus),
      departmentId: expense.department,
      submitterIsController: Boolean(expense.submitter_is_controller),
      submitterIsFinancialManager: Boolean(
        expense.submitter_is_financial_manager
      ),
    }).some((step) => step.role === role);
  } catch {
    // An unknown campus has no plan: say nothing about a president.
    return false;
  }
}

/**
 * The note for a national step on the expense's chain, or null when the plan
 * itself asks for the general manager (National, controller switch on).
 */
function nationalStandInNote(expense: Expenses): string | null {
  if (String(expense.campus) === NATIONAL_CAMPUS_ID) {
    return planHasRole(expense, "national")
      ? null
      : NATIONAL_CONTROLLER_FALLBACK_NOTE;
  }
  return planHasRole(expense, "president")
    ? PRESIDENT_FALLBACK_NOTE
    : NATIONAL_FALLBACK_NOTE;
}

interface ExpenseParts {
  declaration: string | null;
  fallbackNote: string | null;
  hints: ApproverHint[];
}

const EMPTY_EXPENSE_PARTS: ExpenseParts = {
  declaration: null,
  fallbackNote: null,
  hints: [],
};

async function loadExpenseParts(
  db: Db,
  expenseId: string
): Promise<ExpenseParts> {
  const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select([
      "$id",
      "campus",
      "department",
      "approver_hints",
      "submitter_is_controller",
      "submitter_is_financial_manager",
    ]),
  ]);

  const steps = await bestEffort(
    "approval steps lookup",
    [] as ExpenseApprovals[],
    async () =>
      (
        await db.listRows<ExpenseApprovals>("app", "expense_approvals", [
          Query.equal("expense_id", expenseId),
          Query.limit(APPROVAL_LIMIT),
        ])
      ).rows
  );
  const fallbackNote = steps.some((step) => step.approver_role === "national")
    ? nationalStandInNote(expense)
    : null;
  return {
    declaration: declarationText(expense),
    fallbackNote,
    hints: parseApproverHints(expense.approver_hints),
  };
}

function accountLabel(
  number: number | null,
  names: Map<number, string>
): string | null {
  if (number == null) {
    return null;
  }
  const name = names.get(number);
  return name ? `${number} ${name}` : String(number);
}

function typeLabel(
  row: ExpenseAttachments,
  labels: Map<string, string>
): string {
  if (row.cost_type) {
    return labels.get(row.cost_type) ?? row.cost_type;
  }
  const own = row.cost_type_text?.trim();
  return own ? `"${own}"` : row.type;
}

async function loadAccountNames(
  db: Db,
  numbers: number[]
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (numbers.length === 0) {
    return names;
  }
  const { rows } = await db.listRows<LedgerAccounts>("app", "ledger_accounts", [
    Query.equal(
      "$id",
      numbers.map((n) => String(n))
    ),
    Query.limit(numbers.length),
  ]);
  for (const row of rows) {
    if (row.name) {
      names.set(row.account_number, row.name);
    }
  }
  return names;
}

async function loadTypeLabels(db: Db): Promise<Map<string, string>> {
  const types: CostTypeOption[] = await bestEffort(
    "cost types lookup",
    [],
    () => loadAllCostTypes(db)
  );
  return new Map(types.map((type) => [type.slug, type.label]));
}

interface ReceiptParts {
  /** Every attachment's type label by id, supporting rows included. */
  labelById: Map<string, string>;
  missingAccount: boolean;
  /** Every attachment's short name for hint lines: its text, else its type. */
  nameById: Map<string, string>;
  receipts: ApprovalCardDetails["receipts"];
}

/**
 * When the receipts can't be read, nothing says every one has an account, so
 * the card offers "Set the account in admin" instead of Approve.
 */
const UNREAD_RECEIPTS: ReceiptParts = {
  labelById: new Map(),
  missingAccount: true,
  nameById: new Map(),
  receipts: [],
};

/**
 * True when a receipt with an amount has no account and none can be worked out:
 * posting resolves a typed receipt's account from its type, so only a receipt
 * with no type (own text or nothing) and no account is missing one.
 */
export function receiptLacksAccount(row: {
  account_number?: number | null;
  amount?: number | null;
  cost_type?: string | null;
}): boolean {
  return (
    (row.amount ?? 0) > 0 &&
    row.account_number == null &&
    !row.cost_type?.trim()
  );
}

/** True when any receipt of the list lacks an account. */
export function hasReceiptWithoutAccount(
  rows: readonly Parameters<typeof receiptLacksAccount>[0][]
): boolean {
  return rows.some(receiptLacksAccount);
}

/**
 * The expense's receipts, read through the `expenseAttachments` relation. Rows
 * submitted before `expense_id` was written on attachments are only reachable
 * this way, so every approval-side check reads them here.
 */
export async function loadExpenseReceiptRows(
  db: Db,
  expenseId: string
): Promise<ExpenseAttachments[]> {
  const expense = await db.getRow<
    Models.Row & { expenseAttachments?: ExpenseAttachments[] }
  >("app", "expense", expenseId, [
    Query.select(["$id", "expenseAttachments.*"]),
  ]);
  return [...(expense.expenseAttachments ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

async function loadReceiptParts(
  db: Db,
  expenseId: string
): Promise<ReceiptParts> {
  const rows = await loadExpenseReceiptRows(db, expenseId);
  const [typeLabels, accountNames] = await Promise.all([
    loadTypeLabels(db),
    bestEffort("ledger lookup", new Map<number, string>(), () =>
      loadAccountNames(
        db,
        rows.flatMap((row) =>
          row.account_number == null ? [] : [row.account_number]
        )
      )
    ),
  ]);
  const priced = rows.filter((row) => (row.amount ?? 0) > 0);
  const labelById = new Map(
    rows.map((row) => [row.$id, typeLabel(row, typeLabels)])
  );
  return {
    labelById,
    missingAccount: hasReceiptWithoutAccount(rows),
    nameById: new Map(
      rows.map((row) => [
        row.$id,
        shorten(
          row.description?.trim() || labelById.get(row.$id) || "",
          RECEIPT_NAME_CHARS
        ),
      ])
    ),
    receipts: priced.map((row) => ({
      account: accountLabel(row.account_number, accountNames),
      amount: row.amount ?? 0,
      date: row.date?.slice(0, ISO_DATE_CHARS) ?? "",
      text: row.description ?? "",
      type: typeLabel(row, typeLabels),
    })),
  };
}

function decisionLine(event: ExpenseEvents, actor: string): string {
  const verb = event.action === "approved" ? "approved" : "rejected";
  const note = event.note?.trim() ?? "";
  const onBehalf = ON_BEHALF_NOTE.exec(note);
  const reason = (onBehalf ? onBehalf[2] : REASON_NOTE.exec(note)?.[1])?.trim();
  const who = onBehalf?.[1] ? ` (on behalf of ${onBehalf[1]})` : "";
  const why =
    verb === "rejected" && reason
      ? `: ${reason.slice(0, MAX_REASON_CHARS)}`
      : "";
  return `${actor} ${verb}${who}${why}`;
}

function editLine(
  event: ExpenseEvents,
  actor: string,
  labelById: Map<string, string>
): string {
  const field = event.field ?? "";
  const word = FIELD_WORDS[field] ?? field;
  const label = event.attachment_id
    ? labelById.get(event.attachment_id)
    : undefined;
  const on = label ? ` on ${label}` : "";
  // A bank account number is personal data: say that it changed, not to what.
  const values =
    field === "bank_account"
      ? ""
      : ` from ${event.before ?? ""} to ${event.after ?? ""}`;
  return `${actor} changed ${word}${on}${values}`;
}

function describeHistoryEvent(
  event: ExpenseEvents,
  labelById: Map<string, string>
): string {
  const actor =
    event.actor_name || ACTOR_KIND_NAMES[event.actor_kind] || "Someone";
  const after = event.after ?? "";
  switch (event.action) {
    case "submitted":
      return `${actor} submitted the expense`;
    case "ai_classified":
      return `AI set the type to ${after}`;
    case "ai_account_chosen":
      return `AI chose account ${after}`;
    case "edited":
      return editLine(event, actor, labelById);
    case "approved":
    case "rejected":
      return decisionLine(event, actor);
    case "approver_resolved":
      return event.field === "approver_email" &&
        (event.actor_kind === "admin" || event.actor_kind === "approver")
        ? editLine(event, actor, labelById)
        : `Approver found: ${after}`;
    case "notified":
      return `Notified ${after}`;
    case "booked": {
      const note = event.note?.trim() ?? "";
      const id = TRANSACTION_ID.exec(note)?.[0];
      const customer = BOOKED_CUSTOMER.exec(note)?.[1];
      if (id && customer) {
        return `Booked in the ledger (transaction ${id}, customer ${customer})`;
      }
      return id
        ? `Booked in the ledger (transaction ${id})`
        : "Booked in the ledger";
    }
    case "booking_failed":
      return `Booking failed: ${event.note ?? ""}`.trim();
    case "date_shifted":
      return `Posting date moved from ${event.before ?? ""} to ${after}`;
    case "booking_retried":
      return "Booking retried";
    default:
      return `Unknown event (${String(event.action)})`;
  }
}

async function loadHistoryEvents(
  db: Db,
  expenseId: string
): Promise<ExpenseEvents[]> {
  const { rows } = await db.listRows<ExpenseEvents>("app", "expense_events", [
    Query.equal("expense_id", expenseId),
    Query.orderDesc("$createdAt"),
    Query.limit(HISTORY_LIMIT),
  ]);
  return rows;
}

/**
 * The extra card data for one expense. Loaded fresh for every notification, so
 * the next approver sees the changes made at earlier steps. The three reads
 * run at once; hints and history are worded once the receipts are in.
 */
export async function loadApprovalCardDetails(
  db: Db,
  expenseId: string
): Promise<ApprovalCardDetails> {
  const [expenseParts, receiptParts, events] = await Promise.all([
    bestEffort("expense lookup", EMPTY_EXPENSE_PARTS, () =>
      loadExpenseParts(db, expenseId)
    ),
    bestEffort("receipts lookup", UNREAD_RECEIPTS, () =>
      loadReceiptParts(db, expenseId)
    ),
    bestEffort("history lookup", [] as ExpenseEvents[], () =>
      loadHistoryEvents(db, expenseId)
    ),
  ]);
  return {
    declaration: expenseParts.declaration,
    fallbackNote: expenseParts.fallbackNote,
    hints: expenseParts.hints
      .map((hint) => hintText(hint, receiptParts.nameById))
      .filter((text): text is string => Boolean(text)),
    history: events.map((event) => ({
      at: formatEventTime(event.$createdAt),
      text: describeHistoryEvent(event, receiptParts.labelById),
    })),
    missingAccount: receiptParts.missingAccount,
    receipts: receiptParts.receipts,
  };
}
