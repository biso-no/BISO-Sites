// The background check of a submitted reimbursement. The submit route answers
// the student first and runs this in `after()`; the backstop runs it for a
// check that run lost. It claims the expense, lets the AI agent settle what it
// can, runs the fixed AI steps for whatever is still unsettled, and only then
// tells the approvers (or accounting, while direct booking is off), exactly
// once. Keep the check behind `runExpenseCheck` so the runner can be swapped.

import { ID, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import {
  type Expenses,
  ExpensesCheckState,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { syncExamplesForExpense } from "@repo/shared/utils/expense-examples";
import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import {
  getFeatureFlagStates,
  isFeatureEnabled,
} from "@repo/shared/utils/feature-flags-server";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import {
  ApprovalChainFailedError,
  createApprovalChain,
} from "../expense-approval";
import { enrichUnsettled, flagCheckIncomplete } from "../expense-submission";
import { generateExpensePdf } from "../pdf/expense-pdf";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type CheckOutcome = "done" | "fallback" | "skipped";

/**
 * The AI agent's part of the check: it settles what it can, stores it, and
 * answers whether it did. Without an answer the fixed steps do the work and
 * the approvers see `ai_check_incomplete`.
 */
export type CheckAgent = (expenseId: string) => Promise<boolean>;

/** No agent yet (Stage 4 Task 5 plugs it in): no check gets an answer. */
export const noAgent: CheckAgent = async () => false;

export interface CheckDeps {
  agent?: CheckAgent;
  now?: () => number;
}

const HTTP_CONFLICT = 409;
const EXPENSES_BUCKET = "expenses";
const INCOMPLETE: ApproverHint = { code: "ai_check_incomplete" };

/** A check that is waiting to run, or ran and was lost. */
const OPEN_CHECK_STATES = new Set<string | null | undefined>([
  ExpensesCheckState.QUEUED,
  ExpensesCheckState.RUNNING,
]);

/** What notifying needs of the expense, read after the check wrote to it. */
const SUBMISSION_COLUMNS = [
  "$id",
  "$sequence",
  "campus",
  "department",
  "description",
  "total",
  "userId",
  "submitter_is_controller",
  "submitter_is_financial_manager",
  "user.*",
  "departmentRel.*",
  "campusRel.*",
  "expenseAttachments.*",
];

/**
 * True when a unique index already holds the row: the approval chain's
 * unique (expense_id, step) index means another run created the chain.
 */
function isRowConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, type } = error as { code?: unknown; type?: unknown };
  return (
    code === HTTP_CONFLICT ||
    type === "row_already_exists" ||
    type === "document_already_exists"
  );
}

/**
 * The agent's turn, then the fixed steps for whatever is still unsettled.
 * `fallback` when the agent gave no answer or the fixed steps failed; the
 * approvers then see `ai_check_incomplete`. With the AI off there is no
 * agent to ask, and the fixed steps make no model call.
 */
async function checkExpense(
  admin: AdminClient,
  expenseId: string,
  agent: CheckAgent,
  now: () => number
): Promise<Exclude<CheckOutcome, "skipped">> {
  const flags = await getFeatureFlagStates();
  const aiEnabled = flags.expenses_module && flags.expenses_ocr;
  let answered = !aiEnabled;
  if (aiEnabled) {
    try {
      answered = await agent(expenseId);
    } catch (error) {
      console.error(
        `[expense-check] the agent failed for ${expenseId}; the fixed steps take over:`,
        error
      );
    }
  }
  try {
    await enrichUnsettled(admin, expenseId, {
      extraHints: answered ? [] : [INCOMPLETE],
      now,
    });
  } catch (error) {
    console.error(
      `[expense-check] the fixed steps failed for ${expenseId}; notifying anyway:`,
      error
    );
    await flagCheckIncomplete(admin.db, expenseId).catch((cause: unknown) => {
      console.error(
        `[expense-check] could not flag ${expenseId} as incomplete:`,
        cause
      );
    });
    return ExpensesCheckState.FALLBACK;
  }
  return answered ? ExpensesCheckState.DONE : ExpensesCheckState.FALLBACK;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Renders and stores the PDF cover sheet, then returns the email attachment
 * ids: the cover sheet first, followed by the receipts.
 */
async function storeEmailAttachments(
  storage: AdminClient["storage"],
  expense: Expenses,
  refNumber: string
): Promise<string[]> {
  const profile = expense.user;
  const addressParts = [profile?.address, profile?.zip, profile?.city].filter(
    Boolean
  );

  const pdfBuffer = await generateExpensePdf({
    reimbursementNumber: refNumber,
    name: profile?.name ?? "",
    address: addressParts.join(", ") || "Ikke oppgitt",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    bankAccount: profile?.bank_account ?? "",
    invoiceDate: formatDate(new Date()),
    campusAndUnit: `${expense.departmentRel.Name} - ${expense.campusRel.name}`,
    purpose: expense.description ?? "",
    attachments: expense.expenseAttachments.map((att) => ({
      description: att.description ?? "",
      date: att.date ? formatDate(new Date(att.date)) : "",
      amount: att.amount ?? 0,
    })),
    subtotal: expense.total,
    total: expense.total,
  });

  const uploadedPdf = await storage.createFile(
    EXPENSES_BUCKET,
    ID.unique(),
    InputFile.fromBuffer(pdfBuffer, `refusjon-${refNumber}.pdf`)
  );

  return [
    `${EXPENSES_BUCKET}:${uploadedPdf.$id}`,
    ...expense.expenseAttachments.map(
      (attachment) => `${EXPENSES_BUCKET}:${attachment.url}`
    ),
  ];
}

/**
 * Direct booking off: emails the cover sheet and receipts to the submitter
 * and to accounting, then marks the expense `pending` (it already is). A
 * failure throws, so the check stays `running` and the backstop tries again.
 */
async function submitByEmail(
  { db, messaging, storage }: AdminClient,
  expense: Expenses
): Promise<void> {
  // Appwrite Messaging only delivers to registered users, so accounting's inbox
  // is backed by a dedicated user. Checked before anything is sent, so a missing
  // env var can't email the submitter for a submission that then fails.
  const invoiceUserId = process.env.INVOICE_USER_ID;
  if (!invoiceUserId) {
    throw new Error("INVOICE_USER_ID environment variable is not set");
  }

  const refNumber = reimbursementNumber(expense.$sequence);
  const submitterName = expense.user?.name ?? "";
  const attachments = await storeEmailAttachments(storage, expense, refNumber);

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: `Expense ${refNumber} has been received`,
    content: `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
    <p>Reimbursement number: ${refNumber}</p>
`,
    users: [expense.userId],
    attachments,
    html: true,
  });

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: `User ${submitterName} has submitted expense ${refNumber}`,
    content: `
    <h1>Hello,</h1>

    <p>${submitterName} has submitted a new reimbursement for ${expense.departmentRel.Name} campus ${expense.campusRel.name}</p>
    <p>Reimbursement number: ${refNumber}</p>
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`,
    users: [invoiceUserId],
    attachments,
    html: true,
  });

  await db.updateRow("app", "expense", expense.$id, {
    status: ExpensesStatus.PENDING,
  });
}

/**
 * Direct booking on: builds the approval chain and notifies its first step,
 * routed by the flags the submitter declared, as stored on the expense. A
 * chain that fails is recorded as an approval issue for IT (the expense stays
 * pending, and a global admin rebuilds the chain); a chain another run holds
 * already went out.
 */
async function submitForApproval(expense: Expenses): Promise<void> {
  try {
    await createApprovalChain(
      {
        expenseId: expense.$id,
        campusId: expense.campus,
        departmentId: expense.department ?? null,
        departmentName: expense.departmentRel?.Name ?? null,
        submitterIsController: expense.submitter_is_controller,
        submitterIsFinancialManager: expense.submitter_is_financial_manager,
        reimbursementNumber: reimbursementNumber(expense.$sequence),
        submitterName: expense.user?.name || "BISO member",
        submitterUserId: expense.userId,
        departmentLabel: expense.departmentRel?.Name ?? expense.department,
        campusLabel: expense.campusRel?.name ?? expense.campus,
        total: expense.total,
        currency: "NOK",
        description: expense.description ?? "",
      },
      { keepPendingOnFailure: true, recordIssue: true }
    );
  } catch (error) {
    if (isRowConflictError(error)) {
      return;
    }
    if (error instanceof ApprovalChainFailedError) {
      console.error(
        `[expense-check] the approval chain failed for ${expense.$id}; an approval issue was recorded:`,
        error
      );
      return;
    }
    throw error;
  }
}

/** Tells the approvers, or accounting while direct booking is off. */
async function notifyAfterCheck(
  admin: AdminClient,
  expenseId: string
): Promise<void> {
  const expense = await admin.db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select(SUBMISSION_COLUMNS),
  ]);
  if (await isFeatureEnabled("expenses_ledger_posting")) {
    await submitForApproval(expense);
  } else {
    await submitByEmail(admin, expense);
  }
}

/**
 * Checks a submitted reimbursement, then notifies its approvers (or emails
 * accounting) exactly once.
 *
 * The claim is an atomic `check_claim` increment: only the run that observes
 * exactly 1 checks the expense, so two submits of the same draft, or a
 * submit and the backstop, run one check and one notification. A check that
 * is not waiting (`queued` or `running`) is left alone.
 *
 * The state is written last: a run that dies before notifying is still
 * `running`, and the backstop finishes it. A notification that fails with
 * nobody told throws for the same reason; the example sync after it is
 * best-effort.
 */
export async function runExpenseCheck(
  expenseId: string,
  deps: CheckDeps = {}
): Promise<CheckOutcome> {
  const now = deps.now ?? Date.now;
  const agent = deps.agent ?? noAgent;
  const admin = await createAdminClient();
  const { db } = admin;

  // No `max` bound: a lost race is the `!== 1` answer, and a thrown error
  // (the column not deployed, an outage) is a real failure.
  const claimed = await db.incrementRowColumn<Expenses>({
    databaseId: "app",
    tableId: "expense",
    rowId: expenseId,
    column: "check_claim",
    value: 1,
  });
  if (
    (claimed.check_claim ?? 0) !== 1 ||
    !OPEN_CHECK_STATES.has(claimed.check_state)
  ) {
    return "skipped";
  }

  await db.updateRow("app", "expense", expenseId, {
    check_state: ExpensesCheckState.RUNNING,
    check_started_at: new Date(now()).toISOString(),
  });
  const outcome = await checkExpense(admin, expenseId, agent, now);
  await notifyAfterCheck(admin, expenseId);
  await db.updateRow("app", "expense", expenseId, {
    check_state: outcome,
    check_finished_at: new Date(now()).toISOString(),
  });
  // Only a submission that went out teaches anything; the sync logs and
  // swallows its own failures.
  await syncExamplesForExpense(db, expenseId, { confirmed: false });
  return outcome;
}
