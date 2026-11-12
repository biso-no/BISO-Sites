// Loads what an approver needs on the Teams card and in the email: receipts
// with their type and account, the AI/system hints, the latest history lines,
// the submitter's self-declaration and the national-fallback note. Every lookup
// is best-effort: a failure leaves that part empty and the card still sends.

import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  ExpenseApprovals,
  ExpenseAttachments,
  ExpenseEvents,
  Expenses,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import type { ApprovalCardData } from "@repo/connectors/teams-bot";
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

const ATTACHMENT_LIMIT = 100;
const HISTORY_LIMIT = 6;
const APPROVAL_LIMIT = 20;
const NATIONAL_CAMPUS_ID = "5";
const MAX_REASON_CHARS = 120;
const ISO_DATE_CHARS = 10;
const OSLO_TIME_ZONE = "Europe/Oslo";

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

function hintText(hint: ApproverHint): string | null {
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

async function loadExpenseParts(
  db: Db,
  expenseId: string
): Promise<
  Pick<ApprovalCardDetails, "declaration" | "fallbackNote" | "hints">
> {
  const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select([
      "$id",
      "campus",
      "approver_hints",
      "submitter_is_controller",
      "submitter_is_financial_manager",
    ]),
  ]);
  const hints = parseApproverHints(expense.approver_hints)
    .map(hintText)
    .filter((text): text is string => Boolean(text));

  let fallbackNote: string | null = null;
  if (String(expense.campus) !== NATIONAL_CAMPUS_ID) {
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
    if (steps.some((step) => step.approver_role === "national")) {
      fallbackNote =
        "No approver was found for the campus president, so the national approver decides instead.";
    }
  }
  return { declaration: declarationText(expense), fallbackNote, hints };
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
  receipts: ApprovalCardDetails["receipts"];
}

const EMPTY_RECEIPTS: ReceiptParts = {
  labelById: new Map(),
  missingAccount: false,
  receipts: [],
};

async function loadReceiptParts(
  db: Db,
  expenseId: string
): Promise<ReceiptParts> {
  const { rows } = await db.listRows<ExpenseAttachments>(
    "app",
    "expense_attachments",
    [
      Query.equal("expense_id", expenseId),
      Query.orderAsc("sort_order"),
      Query.limit(ATTACHMENT_LIMIT),
    ]
  );
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
  return {
    labelById: new Map(
      rows.map((row) => [row.$id, typeLabel(row, typeLabels)])
    ),
    missingAccount: priced.some((row) => row.account_number == null),
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
      const id = TRANSACTION_ID.exec(event.note?.trim() ?? "")?.[0];
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

async function loadHistory(
  db: Db,
  expenseId: string,
  labelById: Map<string, string>
): Promise<ApprovalCardDetails["history"]> {
  const { rows } = await db.listRows<ExpenseEvents>("app", "expense_events", [
    Query.equal("expense_id", expenseId),
    Query.orderDesc("$createdAt"),
    Query.limit(HISTORY_LIMIT),
  ]);
  return rows.map((event) => ({
    at: formatEventTime(event.$createdAt),
    text: describeHistoryEvent(event, labelById),
  }));
}

/**
 * The extra card data for one expense. Loaded fresh for every notification, so
 * the next approver sees the changes made at earlier steps.
 */
export async function loadApprovalCardDetails(
  db: Db,
  expenseId: string
): Promise<ApprovalCardDetails> {
  const [expenseParts, receiptParts] = await Promise.all([
    bestEffort(
      "expense lookup",
      { declaration: null, fallbackNote: null, hints: [] } as Awaited<
        ReturnType<typeof loadExpenseParts>
      >,
      () => loadExpenseParts(db, expenseId)
    ),
    bestEffort("receipts lookup", EMPTY_RECEIPTS, () =>
      loadReceiptParts(db, expenseId)
    ),
  ]);
  const history = await bestEffort("history lookup", [], () =>
    loadHistory(db, expenseId, receiptParts.labelById)
  );
  return {
    ...expenseParts,
    history,
    missingAccount: receiptParts.missingAccount,
    receipts: receiptParts.receipts,
  };
}
