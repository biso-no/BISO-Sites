// Expense approval orchestration: creates the per-step approval chain, notifies
// approvers (Teams card + Outlook email), and records decisions (advancing the
// chain or rejecting). Shared by the Teams bot endpoint and the web approval
// page so both decision channels converge on the same idempotent logic.

import { createHash, randomBytes } from "node:crypto";
import { ID, type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovals,
  type ExpenseApprovalsApproverRole,
  ExpenseApprovalsStatus,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import {
  type ApprovalCardData,
  buildApprovalCard,
  buildApprovalEmailHtml,
  ensureBotChatForUser,
  sendApprovalEmail,
  sendProactiveCard,
} from "@repo/connectors/teams-bot";
import { resolveExpenseApprovers } from "./expense-approver-resolution";

const TOKEN_TTL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// `expense_approval_issues.reason` is capped at 500 chars in the schema; cap here
// so a long Graph/Mail error can't make the remediation createRow throw and
// swallow the recovery path.
const MAX_ISSUE_REASON_CHARS = 500;

function truncateReason(reason: string): string {
  return reason.length > MAX_ISSUE_REASON_CHARS
    ? `${reason.slice(0, MAX_ISSUE_REASON_CHARS - 3)}...`
    : reason;
}

function webBaseUrl(): string {
  return (
    process.env.EXPENSE_APPROVAL_WEB_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://web.biso.no"
  );
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface ApprovalChainContext {
  campusId: string;
  campusLabel: string;
  currency: string;
  departmentId: string | null;
  departmentLabel: string;
  departmentName: string | null;
  description: string;
  expenseId: string;
  reimbursementNumber: string;
  submitterIsFinancialManager: boolean;
  submitterName: string;
  total: number;
}

function stepLabel(role: string, index: number, count: number): string {
  const roleText: Record<string, string> = {
    finance: "Department financial manager",
    manager: "Department manager",
    deputy: "Department deputy",
    controller: "Campus financial controller",
    national: "National approver",
  };
  const base = roleText[role] ?? role;
  return count > 1 ? `Step ${index} of ${count} — ${base}` : base;
}

function cardDataFor(
  context: ApprovalChainContext,
  row: ExpenseApprovals,
  rawToken: string,
  totalSteps: number
): ApprovalCardData {
  const viewUrl = `${webBaseUrl()}/fs/approve/${rawToken}`;
  return {
    approvalId: row.$id,
    token: rawToken,
    reimbursementNumber: context.reimbursementNumber,
    submitterName: context.submitterName,
    departmentName: context.departmentLabel,
    campusName: context.campusLabel,
    total: context.total,
    currency: context.currency,
    description: context.description,
    stepLabel: stepLabel(row.approver_role, row.step, totalSteps),
    viewUrl,
  };
}

/**
 * Notifies the approver for a step via Teams (best-effort) and Outlook email
 * (always). Persists Teams ids when a card was sent. Throws when neither channel
 * delivered: the raw token only lives in the notification, so a step with no
 * usable link must not be accepted silently (the caller fails the submission).
 */
async function notifyStep(
  context: ApprovalChainContext,
  row: ExpenseApprovals,
  rawToken: string,
  totalSteps: number,
  aadId: string | null
): Promise<void> {
  const { db } = await createAdminClient();
  const data = cardDataFor(context, row, rawToken, totalSteps);

  let conversationId: string | null = null;
  let activityId: string | null = null;

  if (aadId) {
    try {
      const chatId = await ensureBotChatForUser(aadId);
      if (chatId) {
        conversationId = chatId;
        activityId =
          (await sendProactiveCard({
            chatId,
            tenantId: process.env.TEAMS_BOT_APP_TENANT_ID || "",
            card: buildApprovalCard(data),
          })) ?? null;
      }
    } catch (error) {
      console.error("[expense-approval] Teams notify failed:", error);
    }
  }

  let emailDelivered = false;
  try {
    await sendApprovalEmail({
      to: row.approver_email,
      subject: `Reimbursement ${context.reimbursementNumber} needs your approval`,
      html: buildApprovalEmailHtml({
        ...data,
        approveUrl: `${data.viewUrl}?intent=approve`,
        rejectUrl: `${data.viewUrl}?intent=reject`,
      }),
    });
    emailDelivered = true;
  } catch (error) {
    console.error("[expense-approval] Email notify failed:", error);
  }

  if (conversationId || activityId) {
    await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
      teams_conversation_id: conversationId,
      teams_activity_id: activityId,
    } as Partial<ExpenseApprovals>);
  }

  const teamsDelivered = Boolean(activityId);
  if (!(teamsDelivered || emailDelivered)) {
    throw new Error(
      `Could not deliver the approval notification to ${row.approver_email} via Teams or email.`
    );
  }
}

export interface CreateChainResult {
  notified: boolean;
  stepsCreated: number;
}

/**
 * Resolves approvers, creates the chain rows, and notifies the first step.
 * Writes a remediation issue when a department approver can't be found.
 */
export async function createApprovalChain(
  context: ApprovalChainContext
): Promise<CreateChainResult> {
  const { db } = await createAdminClient();

  const { steps, issue } = await resolveExpenseApprovers({
    campusId: context.campusId,
    departmentId: context.departmentId,
    departmentName: context.departmentName,
    submitterIsFinancialManager: context.submitterIsFinancialManager,
  });

  if (issue) {
    await db.createRow("app", "expense_approval_issues", ID.unique(), {
      expense_id: context.expenseId,
      campus_id: issue.campusId,
      department: issue.department,
      role_sought: issue.roleSought,
      reason: truncateReason(issue.reason),
      status: "open",
    });
  }

  if (steps.length === 0) {
    await db.updateRow("app", "expense", context.expenseId, {
      status: ExpensesStatus.PENDING,
    });
    return { stepsCreated: 0, notified: false };
  }

  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * MS_PER_DAY
  ).toISOString();
  const rawTokens = new Map<number, string>();

  const created: ExpenseApprovals[] = [];
  for (const step of steps) {
    const rawToken = randomBytes(24).toString("hex");
    rawTokens.set(step.step, rawToken);
    const row = await db.createRow<ExpenseApprovals>(
      "app",
      "expense_approvals",
      ID.unique(),
      {
        expense_id: context.expenseId,
        step: step.step,
        approver_role: step.role as ExpenseApprovalsApproverRole,
        approver_email: step.email,
        approver_aad_id: step.aadId,
        status: ExpenseApprovalsStatus.PENDING,
        decided_by: null,
        decided_at: null,
        reason: null,
        teams_conversation_id: null,
        teams_activity_id: null,
        token_hash: hashToken(rawToken),
        expires_at: expiresAt,
        consumed_at: null,
        campus_id: context.campusId,
        department: context.departmentName,
        decision_lock: 0,
      }
    );
    created.push(row);
  }

  const first = created.find((row) => row.step === 1) ?? created[0];
  const firstStep = steps.find((step) => step.step === first.step);

  // Transition the expense to `pending` BEFORE notifying. The chain rows already
  // exist (their creation was the atomic claim via the unique (expense_id, step)
  // index), so the approval links we send always point at a submitted expense, not
  // a draft — and the submit route no longer needs a separate post-notify status
  // update that could fail and strand a draft with live approval links.
  await db.updateRow("app", "expense", context.expenseId, {
    status: ExpensesStatus.PENDING,
  });

  try {
    await notifyStep(
      context,
      first,
      rawTokens.get(first.step) ?? "",
      steps.length,
      firstStep?.aadId ?? null
    );
  } catch (error) {
    // The first approver is unreachable — roll the whole submission back: delete
    // the chain rows (which also invalidates any link already delivered) and return
    // the expense to draft so it can be retried cleanly.
    await Promise.all(
      created.map((row) =>
        db.deleteRow("app", "expense_approvals", row.$id).catch(() => undefined)
      )
    );
    await db
      .updateRow("app", "expense", context.expenseId, {
        status: ExpensesStatus.DRAFT,
      })
      .catch(() => undefined);
    throw error;
  }

  return { stepsCreated: created.length, notified: true };
}

export interface ApprovalReceipt {
  amount: number;
  date: string | null;
  description: string;
  fileId: string | null;
  id: string;
  type: string;
}

export interface ApprovalContext {
  approverRole: string;
  campusLabel: string;
  currency: string;
  departmentLabel: string;
  description: string;
  expired: boolean;
  receipts: ApprovalReceipt[];
  reimbursementNumber: string;
  status: "pending" | "approved" | "rejected";
  stepLabel: string;
  total: number;
}

type ExpenseContextRow = Models.Row & {
  campus: string;
  department: string;
  total: number;
  description: string | null;
  departmentRel?: { Name?: string } | null;
  campusRel?: { name?: string } | null;
  expenseAttachments?: Array<{
    $id: string;
    description: string | null;
    amount: number | null;
    date: string | null;
    url: string | null;
    type: string;
    sort_order: number | null;
  }>;
};

/** Read-only approval context for the web approval page (token-gated). */
export async function getApprovalContext(
  rawToken: string
): Promise<ApprovalContext | null> {
  const { db } = await createAdminClient();
  const found = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [Query.equal("token_hash", hashToken(rawToken)), Query.limit(1)]
  );
  const row = found.rows[0];
  if (!row) {
    return null;
  }

  const expense = await db.getRow<ExpenseContextRow>(
    "app",
    "expense",
    row.expense_id,
    [
      Query.select([
        "$id",
        "campus",
        "department",
        "total",
        "description",
        "$sequence",
        "departmentRel.Name",
        "campusRel.name",
        "expenseAttachments.*",
      ]),
    ]
  );

  const totalSteps = await countSteps(row.expense_id);
  const expired = Date.now() > new Date(row.expires_at).getTime();
  const attachments = [...(expense.expenseAttachments ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return {
    reimbursementNumber: reimbursementNumber(
      (expense as unknown as { $sequence: number }).$sequence
    ),
    departmentLabel: expense.departmentRel?.Name ?? expense.department,
    campusLabel: expense.campusRel?.name ?? expense.campus,
    total: expense.total,
    currency: "NOK",
    description: expense.description ?? "",
    status: row.status,
    stepLabel: stepLabel(row.approver_role, row.step, totalSteps),
    approverRole: row.approver_role,
    expired,
    receipts: attachments.map((att) => ({
      id: att.$id,
      description: att.description ?? "",
      amount: att.amount ?? 0,
      date: att.date,
      // Don't expose file ids once the link has expired — the file proxy rejects
      // them anyway, but this keeps the expired context from leaking ids.
      fileId: expired ? null : att.url,
      type: att.type,
    })),
  };
}

/** Validates that a file belongs to the expense behind the token (file proxy). */
export async function approvalOwnsFile(
  rawToken: string,
  fileId: string
): Promise<boolean> {
  const { db } = await createAdminClient();
  const found = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [Query.equal("token_hash", hashToken(rawToken)), Query.limit(1)]
  );
  const row = found.rows[0];
  if (!row) {
    return false;
  }
  // Expired links must not download receipts, even if the file id is known.
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return false;
  }
  const expense = await db.getRow<ExpenseContextRow>(
    "app",
    "expense",
    row.expense_id,
    [Query.select(["$id", "expenseAttachments.*"])]
  );
  return (expense.expenseAttachments ?? []).some((att) => att.url === fileId);
}

export type DecisionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      decision: "approved" | "rejected";
      finalized: boolean;
      expenseId: string;
      reimbursementNumber: string;
    };

type ExpenseSummaryRow = Models.Row & {
  campus: string;
  department: string;
  total: number;
  description: string | null;
  userId: string;
  departmentRel?: { Name?: string } | null;
  campusRel?: { name?: string } | null;
};

function reimbursementNumber(sequence: number | string): string {
  return String(10_000 + Number(sequence || 0)).padStart(5, "0");
}

/** Idempotent result for a step that is already decided. */
function decidedResult(
  row: ExpenseApprovals,
  refNumber: string
): DecisionResult {
  return {
    ok: true,
    decision:
      row.status === ExpenseApprovalsStatus.APPROVED ? "approved" : "rejected",
    finalized: true,
    expenseId: row.expense_id,
    reimbursementNumber: refNumber,
  };
}

/**
 * Loser of the atomic decision claim: another request is applying (or has applied)
 * the decision for this step. Re-read and return its outcome if it has landed,
 * otherwise report that it is in progress — without running any side effects.
 */
async function concurrentDecisionResult(
  rowId: string,
  refNumber: string
): Promise<DecisionResult> {
  const { db } = await createAdminClient();
  const fresh = await db.getRow<ExpenseApprovals>(
    "app",
    "expense_approvals",
    rowId
  );
  if (fresh.status !== ExpenseApprovalsStatus.PENDING) {
    return decidedResult(fresh, refNumber);
  }
  return {
    ok: false,
    error:
      "This approval is already being processed. Please refresh in a moment.",
  };
}

/**
 * Re-derives the expense status from its approval chain and applies it when the
 * expense is still `pending`. Heals a stuck expense when a step decision was
 * recorded but the follow-up expense-status update didn't land (the idempotent
 * retry path calls this). Never downgrades a terminal or posting status.
 */
async function reconcileExpenseStatus(expenseId: string): Promise<void> {
  const { db } = await createAdminClient();
  const expense = await db.getRow<Models.Row & { status: ExpensesStatus }>(
    "app",
    "expense",
    expenseId,
    [Query.select(["$id", "status"])]
  );
  if (expense.status !== ExpensesStatus.PENDING) {
    return;
  }

  const steps = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [Query.equal("expense_id", expenseId), Query.limit(50)]
  );
  if (steps.rows.length === 0) {
    return;
  }

  let desired: ExpensesStatus | null = null;
  if (steps.rows.some((s) => s.status === ExpenseApprovalsStatus.REJECTED)) {
    desired = ExpensesStatus.REJECTED;
  } else if (
    steps.rows.every((s) => s.status === ExpenseApprovalsStatus.APPROVED)
  ) {
    desired = ExpensesStatus.APPROVED;
  }

  if (desired) {
    await db.updateRow("app", "expense", expenseId, { status: desired });
  }
}

/**
 * Records an approve/reject decision for the step identified by `rawToken`.
 * Idempotent: a step that is already decided returns its existing outcome.
 * On final approval the expense moves to `approved` (the poster picks it up);
 * on rejection it moves to `rejected`.
 */
export async function decideApproval(params: {
  rawToken: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  reason?: string;
}): Promise<DecisionResult> {
  const { db } = await createAdminClient();
  const tokenHash = hashToken(params.rawToken);

  const found = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [Query.equal("token_hash", tokenHash), Query.limit(1)]
  );
  const row = found.rows[0];
  if (!row) {
    return { ok: false, error: "This approval link is invalid." };
  }
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return { ok: false, error: "This approval link has expired." };
  }

  const expense = await db.getRow<ExpenseSummaryRow>(
    "app",
    "expense",
    row.expense_id,
    [
      Query.select([
        "$id",
        "campus",
        "department",
        "total",
        "description",
        "userId",
        "$sequence",
        "departmentRel.Name",
        "campusRel.name",
      ]),
    ]
  );
  const refNumber = reimbursementNumber(expense.$sequence);

  if (row.status !== ExpenseApprovalsStatus.PENDING) {
    // This step is already decided. A previous request may have recorded the step
    // decision but failed before transitioning the expense, so reconcile the
    // expense status from the chain — this heals a stuck-pending expense on retry.
    await reconcileExpenseStatus(row.expense_id);
    return decidedResult(row, refNumber);
  }

  // Atomically claim this step before applying the decision. Appwrite has no
  // conditional update, so two concurrent submissions of the same token (the Teams
  // card and the email link, or a double-click) could both pass the pending check
  // above and then apply conflicting decisions — one advancing the chain while the
  // other overwrites the step. incrementRowColumn is a server-side atomic
  // read-modify-write: only the run that takes decision_lock 0 -> 1 proceeds; any
  // other value means another request owns it, so we return its outcome. No `max`
  // bound — a lost race is the `!== 1` branch, while any thrown error is a real
  // failure (column not deployed, permissions, outage) that must surface.
  const claim = await db.incrementRowColumn<ExpenseApprovals>({
    databaseId: "app",
    tableId: "expense_approvals",
    rowId: row.$id,
    column: "decision_lock",
    value: 1,
  });
  if ((claim.decision_lock ?? 0) !== 1) {
    return await concurrentDecisionResult(row.$id, refNumber);
  }

  try {
    await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
      status:
        params.decision === "approved"
          ? ExpenseApprovalsStatus.APPROVED
          : ExpenseApprovalsStatus.REJECTED,
      decided_by: params.decidedBy,
      decided_at: new Date().toISOString(),
      reason: params.reason ?? null,
      consumed_at: new Date().toISOString(),
    } as Partial<ExpenseApprovals>);
  } catch (error) {
    // The claim succeeded but recording the decision failed. Release the claim so
    // the step can be retried, then surface the error (the step stays pending).
    await db
      .decrementRowColumn({
        databaseId: "app",
        tableId: "expense_approvals",
        rowId: row.$id,
        column: "decision_lock",
        value: 1,
        min: 0,
      })
      .catch(() => undefined);
    throw error;
  }

  if (params.decision === "rejected") {
    await db.updateRow("app", "expense", row.expense_id, {
      status: ExpensesStatus.REJECTED,
    });
    await notifySubmitter(expense.userId, refNumber, "rejected", params.reason);
    return {
      ok: true,
      decision: "rejected",
      finalized: true,
      expenseId: row.expense_id,
      reimbursementNumber: refNumber,
    };
  }

  // Approved — notify the next pending step, or finalize.
  const next = await db.listRows<ExpenseApprovals>("app", "expense_approvals", [
    Query.equal("expense_id", row.expense_id),
    Query.equal("status", ExpenseApprovalsStatus.PENDING),
    Query.orderAsc("step"),
    Query.limit(1),
  ]);

  const nextRow = next.rows[0];
  if (nextRow) {
    try {
      await notifyPendingStep(expense, nextRow, refNumber);
    } catch (error) {
      // The decision is already recorded, so don't fail the approver's action.
      // The next step's raw token only lived inside notifyPendingStep and is now
      // lost, so record a remediation issue; the IT queue recovers the chain via
      // resendApprovalNotification (which mints a fresh token).
      console.error("[expense-approval] next-step notify failed:", error);
      await recordNotificationIssue(expense, nextRow, error);
    }
    return {
      ok: true,
      decision: "approved",
      finalized: false,
      expenseId: row.expense_id,
      reimbursementNumber: refNumber,
    };
  }

  await db.updateRow("app", "expense", row.expense_id, {
    status: ExpensesStatus.APPROVED,
  });
  return {
    ok: true,
    decision: "approved",
    finalized: true,
    expenseId: row.expense_id,
    reimbursementNumber: refNumber,
  };
}

async function countSteps(expenseId: string): Promise<number> {
  const { db } = await createAdminClient();
  const all = await db.listRows<ExpenseApprovals>("app", "expense_approvals", [
    Query.equal("expense_id", expenseId),
    Query.limit(20),
  ]);
  return all.rows.length;
}

/**
 * Mints a fresh token (resetting expiry) for a pending step and notifies the
 * approver. The previous raw token is never recoverable, so this always issues a
 * new one — which makes it safe both when advancing the chain and when resending.
 */
async function notifyPendingStep(
  expense: ExpenseSummaryRow,
  stepRow: ExpenseApprovals,
  refNumber: string
): Promise<void> {
  const { db } = await createAdminClient();
  const rawToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * MS_PER_DAY
  ).toISOString();
  await db.updateRow<ExpenseApprovals>(
    "app",
    "expense_approvals",
    stepRow.$id,
    {
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
    } as Partial<ExpenseApprovals>
  );
  const totalSteps = await countSteps(stepRow.expense_id);
  await notifyStep(
    buildContextFromExpense(expense, refNumber),
    stepRow,
    rawToken,
    totalSteps,
    stepRow.approver_aad_id
  );
}

/**
 * Records a remediation issue when an approver could not be notified, so the IT
 * "approval issues" queue surfaces it and can trigger a resend.
 */
async function recordNotificationIssue(
  expense: ExpenseSummaryRow,
  stepRow: ExpenseApprovals,
  error: unknown
): Promise<void> {
  const { db } = await createAdminClient();
  const message = error instanceof Error ? error.message : "unknown error";
  await db.createRow("app", "expense_approval_issues", ID.unique(), {
    expense_id: stepRow.expense_id,
    campus_id: expense.campus,
    department: expense.departmentRel?.Name ?? expense.department,
    role_sought: stepRow.approver_role,
    reason: truncateReason(
      `Could not notify ${stepRow.approver_email} for step ${stepRow.step} (${message}). Use resend to re-issue the approval link.`
    ),
    status: "open",
  });
}

/**
 * Re-issues a fresh token for the lowest pending approval step of an expense and
 * re-notifies that approver. Used by the IT remediation queue to recover a chain
 * whose next-step notification failed to deliver. Idempotent and safe to retry.
 */
export async function resendApprovalNotification(
  expenseId: string
): Promise<{ ok: boolean; error?: string }> {
  const { db } = await createAdminClient();
  const pending = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [
      Query.equal("expense_id", expenseId),
      Query.equal("status", ExpenseApprovalsStatus.PENDING),
      Query.orderAsc("step"),
      Query.limit(1),
    ]
  );
  const stepRow = pending.rows[0];
  if (!stepRow) {
    return { ok: false, error: "No pending approval step to notify." };
  }
  const expense = await db.getRow<ExpenseSummaryRow>(
    "app",
    "expense",
    expenseId,
    [
      Query.select([
        "$id",
        "campus",
        "department",
        "total",
        "description",
        "userId",
        "$sequence",
        "departmentRel.Name",
        "campusRel.name",
      ]),
    ]
  );
  const refNumber = reimbursementNumber(expense.$sequence);
  await notifyPendingStep(expense, stepRow, refNumber);
  return { ok: true };
}

function buildContextFromExpense(
  expense: ExpenseSummaryRow,
  refNumber: string
): ApprovalChainContext {
  return {
    expenseId: expense.$id,
    campusId: expense.campus,
    departmentId: expense.department ?? null,
    departmentName: expense.departmentRel?.Name ?? null,
    submitterIsFinancialManager: false,
    reimbursementNumber: refNumber,
    submitterName: "BISO member",
    departmentLabel: expense.departmentRel?.Name ?? expense.department,
    campusLabel: expense.campusRel?.name ?? expense.campus,
    total: expense.total,
    currency: "NOK",
    description: expense.description ?? "",
  };
}

async function notifySubmitter(
  userId: string,
  refNumber: string,
  decision: "approved" | "rejected",
  reason?: string
): Promise<void> {
  try {
    const { messaging } = await createAdminClient();
    const reasonHtml = reason ? `<p>Reason: ${reason}</p>` : "";
    await messaging.createEmail(
      ID.unique(),
      `Reimbursement ${refNumber} ${decision}`,
      `<h1>Reimbursement ${refNumber} ${decision}</h1>${reasonHtml}`,
      undefined,
      [userId]
    );
  } catch (error) {
    console.error("[expense-approval] submitter notify failed:", error);
  }
}
