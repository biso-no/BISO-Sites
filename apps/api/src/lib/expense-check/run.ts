// The background check of a submitted reimbursement. The submit route answers
// the student first and runs this in `after()`; the backstop runs it for a
// check that run lost. It claims the expense, lets the AI agent settle what it
// can, runs the fixed AI steps for whatever is still unsettled, and only then
// tells the approvers (or accounting, while direct booking is off), exactly
// once. Keep the check behind `runExpenseCheck` so the runner can be swapped.

import { ID, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import { type Expenses, ExpensesCheckState } from "@repo/api/types/appwrite";
import { syncExamplesForExpense } from "@repo/shared/utils/expense-examples";
import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import {
  getFeatureFlagStates,
  isFeatureEnabled,
} from "@repo/shared/utils/feature-flags-server";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import {
  type AccountingDetails,
  buildAccountingDetails,
  loadAccountingLookups,
} from "../expense-accounting-details";
import {
  ApprovalChainFailedError,
  ensureApprovalChain,
} from "../expense-approval";
import { enrichUnsettled, flagCheckIncomplete } from "../expense-submission";
import { generateExpensePdf } from "../pdf/expense-pdf";
import { type AgentAnswer, runCheckAgent } from "./agent";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type CheckOutcome = "done" | "fallback" | "skipped";

/**
 * The AI agent's part of the check: it settles what it can, stores it, and
 * answers whether it did (`AgentAnswer`), with any hints the fixed steps must
 * keep. Without an answer the fixed steps do the work and the approvers see
 * `ai_check_incomplete`.
 */
export type CheckAgent = (expenseId: string) => Promise<AgentAnswer>;

/** No agent: the fixed steps alone, as the backstop's second try runs. */
export const noAgent: CheckAgent = async () => false;

/**
 * The AI check (`./agent`): the agent proposes with read-only tools, and code
 * stores only what it validates.
 */
export const aiCheckAgent: CheckAgent = (expenseId) => runCheckAgent(expenseId);

export interface CheckDeps {
  /** The agent to ask; the AI check unless a caller passes another. */
  agent?: CheckAgent;
  /**
   * The caller's own `check_claim` increment result, such as the backstop's
   * after it reset a stale claim. Without one the run increments the claim
   * itself and must see 1.
   */
  claim?: number;
  now?: () => number;
}

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
  "occasion",
  "eventName",
  "approver_hints",
  "submitter_is_controller",
  "submitter_is_financial_manager",
  "user.*",
  "departmentRel.*",
  "campusRel.*",
  "expenseAttachments.*",
];

/** The claim and state columns the run reads once it holds the claim. */
const STATE_COLUMNS = [
  "$id",
  "check_claim",
  "check_finished_at",
  "check_state",
];

type FinishedOutcome = Exclude<CheckOutcome, "skipped">;

/**
 * Whether the AI is on: true or false, or null when the flags can't be read.
 * Then the AI counts as unavailable, and the check still notifies.
 */
async function readAiEnabled(): Promise<boolean | null> {
  try {
    const flags = await getFeatureFlagStates();
    return flags.expenses_module && flags.expenses_ocr;
  } catch (error) {
    console.error(
      "[expense-check] could not read the flags; checking without the AI:",
      error
    );
    return null;
  }
}

/**
 * The fixed steps for whatever is still unsettled. When they fail, the
 * decisions that need no AI are made instead (defaults, `type_defaulted`,
 * `account_missing`), so every receipt has a type or a hint, and the check
 * is flagged; the approvers are told either way.
 */
async function runFixedSteps(
  admin: AdminClient,
  expenseId: string,
  check: {
    aiEnabled: boolean;
    /** Hints the agent's answer hands on; kept only when it answered. */
    agentHints: ApproverHint[];
    answered: boolean;
    now: () => number;
  }
): Promise<FinishedOutcome> {
  try {
    await enrichUnsettled(admin, expenseId, {
      aiEnabled: check.aiEnabled,
      extraHints: check.answered ? check.agentHints : [INCOMPLETE],
      now: check.now,
    });
    return check.answered
      ? ExpensesCheckState.DONE
      : ExpensesCheckState.FALLBACK;
  } catch (error) {
    console.error(
      `[expense-check] the fixed steps failed for ${expenseId}; deciding without the AI:`,
      error
    );
  }
  // The agent's own findings, such as its doubts of an account, still stand;
  // one incomplete flag replaces its own.
  const kept = check.answered
    ? check.agentHints.filter((hint) => hint.code !== INCOMPLETE.code)
    : [];
  try {
    await enrichUnsettled(admin, expenseId, {
      aiEnabled: false,
      extraHints: [...kept, INCOMPLETE],
      now: check.now,
    });
  } catch (error) {
    console.error(
      `[expense-check] could not decide ${expenseId} without the AI; notifying anyway:`,
      error
    );
    await flagCheckIncomplete(admin.db, expenseId).catch((cause: unknown) => {
      console.error(
        `[expense-check] could not flag ${expenseId} as incomplete:`,
        cause
      );
    });
  }
  return ExpensesCheckState.FALLBACK;
}

/**
 * The agent's turn (`askAgent`), then the fixed steps. `fallback` when the
 * agent gave no answer, was not asked while the AI is on, or the flags could
 * not be read; the approvers then see `ai_check_incomplete`. With the AI off
 * there is no agent to ask, and the fixed steps make no model call.
 */
async function checkExpense(
  admin: AdminClient,
  expenseId: string,
  check: { agent: CheckAgent; askAgent: boolean; now: () => number }
): Promise<FinishedOutcome> {
  const ai = await readAiEnabled();
  const aiEnabled = ai === true;
  let answered = ai === false;
  let agentHints: ApproverHint[] = [];
  if (aiEnabled && check.askAgent) {
    try {
      const answer = await check.agent(expenseId);
      answered = answer !== false;
      agentHints = typeof answer === "object" ? answer.extraHints : [];
    } catch (error) {
      console.error(
        `[expense-check] the agent failed for ${expenseId}; the fixed steps take over:`,
        error
      );
    }
  }
  return await runFixedSteps(admin, expenseId, {
    agentHints,
    aiEnabled,
    answered,
    now: check.now,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Renders and stores a PDF cover sheet, and returns its attachment id.
 *
 * With `details`, it is accounting's sheet: each receipt's type, account and
 * project, then the occasion, the event and the check's flags. Without, it is
 * the plain sheet the student gets: description, date and amount only
 * (`pdfColumns` then keeps the three original columns), because a student
 * never sees accounts, projects or the check's flags.
 */
async function storeCoverSheet(
  storage: AdminClient["storage"],
  expense: Expenses,
  refNumber: string,
  details: AccountingDetails | null
): Promise<string> {
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
    attachments: expense.expenseAttachments.map((att, index) => ({
      description: att.description ?? "",
      date: att.date ? formatDate(new Date(att.date)) : "",
      amount: att.amount ?? 0,
      ...(details ? details.receipts[index] : {}),
    })),
    ...(details
      ? {
          event: details.event,
          flags: details.flags,
          occasion: details.occasion,
        }
      : {}),
    subtotal: expense.total,
    total: expense.total,
  });

  const uploadedPdf = await storage.createFile(
    EXPENSES_BUCKET,
    ID.unique(),
    InputFile.fromBuffer(pdfBuffer, `refusjon-${refNumber}.pdf`)
  );
  return `${EXPENSES_BUCKET}:${uploadedPdf.$id}`;
}

/** The receipt files, as email attachment ids. */
function receiptAttachments(expense: Expenses): string[] {
  return expense.expenseAttachments.map(
    (attachment) => `${EXPENSES_BUCKET}:${attachment.url}`
  );
}

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const HTML_SPECIAL = /[&<>"]/g;

function escapeHtml(text: string): string {
  return text.replace(HTML_SPECIAL, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * The receipts and the check's findings for accounting's email body, which is
 * English like the rest of that email. Empty values are left out or shown as a
 * dash.
 */
function accountingSummaryHtml(
  expense: Expenses,
  details: AccountingDetails
): string {
  const cell = (text: string) => `<td>${escapeHtml(text || "-")}</td>`;
  const rows = expense.expenseAttachments
    .map((att, index) => {
      const own = details.receipts[index];
      return `<tr>${[
        att.date ? formatDate(new Date(att.date)) : "",
        att.description ?? "",
        String(att.amount ?? 0),
        own?.type ?? "",
        own?.account ?? "",
        own?.project ?? "",
      ]
        .map(cell)
        .join("")}</tr>`;
    })
    .join("");
  const facts = [
    ["Occasion", details.occasion],
    ["Event", details.event],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<p>${label}: ${escapeHtml(value ?? "")}</p>`)
    .join("");
  const flags =
    details.flags.length > 0
      ? `<p>Flags from the AI check:</p><ul>${details.flags
          .map((flag) => `<li>${escapeHtml(flag)}</li>`)
          .join("")}</ul>`
      : "";
  return `${facts}
    <table cellpadding="4" border="1" style="border-collapse:collapse">
      <tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th><th>Account</th><th>Project</th></tr>
      ${rows}
    </table>
    ${flags}`;
}

/**
 * Direct booking off: emails the detailed cover sheet and receipts to
 * accounting, then a copy to the submitter with the plain sheet. The expense
 * is `pending` since the submit. Only a failure before accounting's email is
 * sent throws, so the check stays `running` and the backstop tries again
 * without anyone getting it twice; the submitter's copy, its sheet included,
 * is best-effort and made only once accounting's email is out.
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
  const lookups = await loadAccountingLookups(db, expense);
  const receipts = receiptAttachments(expense);
  const accountingSheet = await storeCoverSheet(
    storage,
    expense,
    refNumber,
    buildAccountingDetails(expense, lookups, "nb")
  );
  const summary = accountingSummaryHtml(
    expense,
    buildAccountingDetails(expense, lookups, "en")
  );

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: `User ${submitterName} has submitted expense ${refNumber}`,
    content: `
    <h1>Hello,</h1>

    <p>${submitterName} has submitted a new reimbursement for ${expense.departmentRel.Name} campus ${expense.campusRel.name}</p>
    <p>Reimbursement number: ${refNumber}</p>
    ${summary}
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`,
    users: [invoiceUserId],
    attachments: [accountingSheet, ...receipts],
    html: true,
  });

  try {
    const studentSheet = await storeCoverSheet(
      storage,
      expense,
      refNumber,
      null
    );
    await messaging.createEmail({
      messageId: ID.unique(),
      subject: `Expense ${refNumber} has been received`,
      content: `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
    <p>Reimbursement number: ${refNumber}</p>
`,
      users: [expense.userId],
      attachments: [studentSheet, ...receipts],
      html: true,
    });
  } catch (error) {
    console.error(
      `[expense-check] could not send the submitter's copy of ${expense.$id}:`,
      error
    );
  }
}

/**
 * Direct booking on: builds the approval chain and notifies its first step,
 * routed by the flags the submitter declared, as stored on the expense, once
 * (`ensureApprovalChain`). A chain that fails is recorded as an approval
 * issue for IT (the expense stays pending, and a global admin rebuilds the
 * chain).
 */
async function submitForApproval(expense: Expenses): Promise<void> {
  try {
    await ensureApprovalChain({
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
    });
  } catch (error) {
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
 * Takes the check: the caller's claim when it brings one (and nobody claimed
 * since), else an atomic `check_claim` increment that must read exactly 1.
 * Returns the state columns, or null when the claim is lost or the check is
 * not waiting (`queued` or `running`).
 */
async function claimCheck(
  db: AdminClient["db"],
  expenseId: string,
  claim: number | undefined
): Promise<Expenses | null> {
  if (claim === undefined) {
    // No `max` bound: a lost race is the `!== 1` answer, and a thrown error
    // (the column not deployed, an outage) is a real failure.
    const claimed = await db.incrementRowColumn<Expenses>({
      databaseId: "app",
      tableId: "expense",
      rowId: expenseId,
      column: "check_claim",
      value: 1,
    });
    if ((claimed.check_claim ?? 0) !== 1) {
      return null;
    }
  }
  const row = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select(STATE_COLUMNS),
  ]);
  const lost = claim !== undefined && row.check_claim !== claim;
  return lost || !OPEN_CHECK_STATES.has(row.check_state) ? null : row;
}

/**
 * Checks a submitted reimbursement, then notifies its approvers (or emails
 * accounting) exactly once.
 *
 * Only the run holding the claim checks the expense (`claimCheck`), so two
 * submits of the same draft, or a submit and the backstop, run one check. A
 * check that is not waiting is left alone.
 *
 * A check that finished before (`check_finished_at`) and is waiting again,
 * because a racing submit queued it, tells nobody again: its fixed steps run
 * once more to repair what that submit wrote, and its state is written again.
 *
 * The state is written last: a run that dies before notifying is still
 * `running`, and the backstop finishes it; notifying is safe to repeat
 * (`ensureApprovalChain`, accounting's email first). A notification that
 * fails with nobody told throws for the same reason; the example sync after
 * it is best-effort.
 */
export async function runExpenseCheck(
  expenseId: string,
  deps: CheckDeps = {}
): Promise<CheckOutcome> {
  const now = deps.now ?? Date.now;
  const admin = await createAdminClient();
  const { db } = admin;

  const claimed = await claimCheck(db, expenseId, deps.claim);
  if (!claimed) {
    return "skipped";
  }
  const told = Boolean(claimed.check_finished_at);

  await db.updateRow("app", "expense", expenseId, {
    check_state: ExpensesCheckState.RUNNING,
    check_started_at: new Date(now()).toISOString(),
  });
  const outcome = await checkExpense(admin, expenseId, {
    agent: deps.agent ?? aiCheckAgent,
    askAgent: !told,
    now,
  });
  if (!told) {
    await notifyAfterCheck(admin, expenseId);
  }
  await db.updateRow("app", "expense", expenseId, {
    check_state: outcome,
    check_finished_at: new Date(now()).toISOString(),
  });
  // Only a submission that went out teaches anything; the sync logs and
  // swallows its own failures.
  await syncExamplesForExpense(db, expenseId, { confirmed: false });
  return outcome;
}
