// Expense approval orchestration: creates the per-step approval chain, notifies
// approvers (Teams card + Outlook email), and records decisions (advancing the
// chain or rejecting). Shared by the Teams bot endpoint and the web approval
// page so both decision channels converge on the same idempotent logic.

import { createHash, randomBytes } from "node:crypto";
import { ID, type Models, Query } from "@repo/api";
import { appwriteErrorStatus } from "@repo/api/errors";
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
import {
  directoryKey,
  getCampusApprovalPlan,
} from "@repo/shared/utils/expense-approvers";
import { recordExpenseEvents } from "@repo/shared/utils/expense-events";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import {
  confirmDirectoryApprover,
  setAdminDirectoryApprover,
} from "./expense-approver-directory";
import {
  type ApproverResolutionIssue,
  type ResolvedApproverStep,
  resolveExpenseApprovers,
} from "./expense-approver-resolution";
import { getGraphService } from "./graph";

const HTTP_NOT_FOUND = 404;
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
    "https://biso.no"
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
  submitterIsController: boolean;
  submitterIsFinancialManager: boolean;
  submitterName: string;
  total: number;
}

export function stepLabel(role: string, index: number, count: number): string {
  const roleText: Record<string, string> = {
    finance: "Department financial manager",
    manager: "Department manager",
    deputy: "Department deputy",
    controller: "Campus financial controller",
    president: "Campus president",
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

  await recordExpenseEvents(db, [
    {
      action: "notified",
      actorKind: "system",
      after: row.approver_email.toLowerCase(),
      expenseId: row.expense_id,
      note: teamsDelivered ? "teams,email" : "email",
    },
  ]);
}

export interface CreateChainResult {
  notified: boolean;
  stepsCreated: number;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** The `approver_resolved` history note: role and source, or the fallback. */
function approverResolvedNote(step: ResolvedApproverStep): string {
  return step.fallbackFor
    ? `${step.role} (${step.fallbackFor} fallback)`
    : `${step.role} via ${step.source}`;
}

async function recordResolutionIssues(
  db: AdminDb,
  expenseId: string,
  issues: readonly ApproverResolutionIssue[]
): Promise<void> {
  for (const issue of issues) {
    await db.createRow("app", "expense_approval_issues", ID.unique(), {
      expense_id: expenseId,
      campus_id: issue.campusId,
      department: issue.department,
      role_sought: issue.roleSought,
      reason: truncateReason(issue.reason),
      status: "open",
    });
  }
}

/**
 * Resolves approvers, creates the chain rows, and notifies the first step.
 * Writes a remediation issue when an approver can't be found, once the chain
 * rows hold the claim, so a racing duplicate submit records none.
 */
export async function createApprovalChain(
  context: ApprovalChainContext
): Promise<CreateChainResult> {
  const { db } = await createAdminClient();

  const { steps, issues } = await resolveExpenseApprovers(
    {
      campusId: context.campusId,
      campusName: context.campusLabel,
      departmentId: context.departmentId,
      departmentName: context.departmentName,
      submitterIsController: context.submitterIsController,
      submitterIsFinancialManager: context.submitterIsFinancialManager,
    },
    { db }
  );

  if (steps.length === 0) {
    // Nobody approves this one, so the queue has to see it. The sought role is
    // the plan's last step, the one that would have approved it.
    const lastPlanned = getCampusApprovalPlan({
      campusId: context.campusId,
      departmentId: context.departmentId,
      submitterIsController: context.submitterIsController,
      submitterIsFinancialManager: context.submitterIsFinancialManager,
    }).at(-1);
    await recordResolutionIssues(db, context.expenseId, [
      ...issues,
      {
        campusId: context.campusId,
        department: context.departmentName ?? "(none)",
        reason:
          "No approver could be resolved. The reimbursement is pending with no approval step.",
        roleSought: lastPlanned?.role ?? "controller",
      },
    ]);
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
        approver_email: step.email.trim().toLowerCase(),
        approver_aad_id: step.aadId,
        directory_key: step.directoryKey,
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
        decided_by_email: null,
        on_behalf: false,
      }
    );
    created.push(row);
  }

  // The chain rows are the claim: a duplicate submit has failed by now.
  await recordResolutionIssues(db, context.expenseId, issues);

  await recordExpenseEvents(
    db,
    steps.map((step) => ({
      action: "approver_resolved",
      actorKind: "system",
      after: step.email,
      expenseId: context.expenseId,
      note: approverResolvedNote(step),
    }))
  );

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
  status?: string;
  departmentRel?: { Name?: string } | null;
  campusRel?: { name?: string } | null;
};

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

const EXPENSE_SUMMARY_SELECT = [
  "$id",
  "campus",
  "department",
  "total",
  "description",
  "userId",
  "status",
  "$sequence",
  "departmentRel.Name",
  "campusRel.name",
];

const ROLE_NOUN: Record<ExpenseApprovalsApproverRole, string> = {
  finance: "the financial manager",
  manager: "the department manager",
  deputy: "the deputy manager",
  controller: "the campus controller",
  president: "the campus president",
  national: "the national approver",
};

const GRAPH_LOOKUP_TIMEOUT_MS = 6000;
const NOTE_SEPARATOR = " · ";
const NOT_CURRENT_STEP_ERROR = "This step is not waiting for a decision.";

export interface ApprovalActor {
  email: string | null;
  kind: "approver" | "admin";
  name: string;
}

interface StepDecisionInput {
  actor: ApprovalActor;
  decision: "approved" | "rejected";
  onBehalf: boolean;
  reason?: string;
  /** The id path only decides the current step of a pending expense. */
  requireCurrentStep: boolean;
}

function decisionNote(
  row: ExpenseApprovals,
  input: StepDecisionInput
): string | null {
  const parts: string[] = [];
  if (input.onBehalf) {
    parts.push(`On behalf of ${ROLE_NOUN[row.approver_role]}`);
  }
  const reason = input.reason?.trim();
  if (reason) {
    parts.push(`Reason: ${reason}`);
  }
  return parts.length > 0 ? parts.join(NOTE_SEPARATOR) : null;
}

/** True when `row` is the lowest-numbered pending step of a pending expense. */
async function isCurrentStep(
  db: AdminDb,
  row: ExpenseApprovals,
  expense: ExpenseSummaryRow
): Promise<boolean> {
  if (expense.status !== ExpensesStatus.PENDING) {
    return false;
  }
  const pending = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [
      Query.equal("expense_id", row.expense_id),
      Query.equal("status", ExpenseApprovalsStatus.PENDING),
      Query.orderAsc("step"),
      Query.limit(1),
    ]
  );
  return pending.rows[0]?.$id === row.$id;
}

/**
 * Applies a decision to a loaded step row: claim, write, then reject / notify
 * the next step / finalize. Shared by the token path and the by-id path.
 */
async function decideStep(
  db: AdminDb,
  row: ExpenseApprovals,
  input: StepDecisionInput
): Promise<DecisionResult> {
  const expense = await db.getRow<ExpenseSummaryRow>(
    "app",
    "expense",
    row.expense_id,
    [Query.select(EXPENSE_SUMMARY_SELECT)]
  );
  const refNumber = reimbursementNumber(expense.$sequence);

  if (row.status !== ExpenseApprovalsStatus.PENDING) {
    // This step is already decided. A previous request may have recorded the step
    // decision but failed before transitioning the expense, so reconcile the
    // expense status from the chain — this heals a stuck-pending expense on retry.
    await reconcileExpenseStatus(row.expense_id);
    return decidedResult(row, refNumber);
  }

  if (input.requireCurrentStep && !(await isCurrentStep(db, row, expense))) {
    return { ok: false, error: NOT_CURRENT_STEP_ERROR };
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

  const actorEmail = input.actor.email;
  try {
    await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
      status:
        input.decision === "approved"
          ? ExpenseApprovalsStatus.APPROVED
          : ExpenseApprovalsStatus.REJECTED,
      decided_by: input.actor.name,
      decided_by_email: actorEmail,
      on_behalf: input.onBehalf,
      decided_at: new Date().toISOString(),
      reason: input.reason ?? null,
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

  await recordExpenseEvents(db, [
    {
      action: input.decision,
      actorEmail,
      actorKind: input.actor.kind,
      actorName: input.actor.name,
      expenseId: row.expense_id,
      note: decisionNote(row, input),
    },
  ]);

  if (input.decision === "rejected") {
    await db.updateRow("app", "expense", row.expense_id, {
      status: ExpensesStatus.REJECTED,
    });
    await notifySubmitter(expense.userId, refNumber, "rejected", input.reason);
    return {
      ok: true,
      decision: "rejected",
      finalized: true,
      expenseId: row.expense_id,
      reimbursementNumber: refNumber,
    };
  }

  // Approved: a directory approver who answered is now confirmed (best-effort).
  // Someone deciding on the approver's behalf confirms nothing about them.
  if (row.directory_key && !input.onBehalf) {
    await confirmDirectoryApprover(db, row.directory_key, row.approver_email);
  }

  // Notify the next pending step, or finalize.
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

  return await decideStep(db, row, {
    actor: {
      email: row.approver_email.toLowerCase(),
      kind: "approver",
      name: params.decidedBy,
    },
    decision: params.decision,
    onBehalf: false,
    reason: params.reason,
    requireCurrentStep: false,
  });
}

/**
 * Records an approve/reject decision for the step with id `approvalId` (the
 * admin path). Same chain logic as the token path, but there is no link to
 * expire, so the step must instead be the current one of a pending expense.
 */
export async function decideApprovalStep(params: {
  approvalId: string;
  decision: "approved" | "rejected";
  actor: ApprovalActor;
  onBehalf: boolean;
  reason?: string;
}): Promise<DecisionResult> {
  const { db } = await createAdminClient();
  let row: ExpenseApprovals;
  try {
    row = await db.getRow<ExpenseApprovals>(
      "app",
      "expense_approvals",
      params.approvalId
    );
  } catch (error) {
    if (appwriteErrorStatus(error) === HTTP_NOT_FOUND) {
      return { ok: false, error: "This approval step does not exist." };
    }
    throw error;
  }
  return await decideStep(db, row, {
    actor: {
      ...params.actor,
      email: params.actor.email?.toLowerCase() ?? null,
    },
    decision: params.decision,
    onBehalf: params.onBehalf,
    reason: params.reason,
    requireCurrentStep: true,
  });
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
  await reissueAndNotify(stepRow);
  return { ok: true };
}

/**
 * Mints a fresh token for `stepRow` and notifies its approver. Loads the expense
 * unless the caller already has it.
 */
async function reissueAndNotify(
  stepRow: ExpenseApprovals,
  loaded?: ExpenseSummaryRow
): Promise<void> {
  const { db } = await createAdminClient();
  const expense =
    loaded ??
    (await db.getRow<ExpenseSummaryRow>("app", "expense", stepRow.expense_id, [
      Query.select(EXPENSE_SUMMARY_SELECT),
    ]));
  await notifyPendingStep(
    expense,
    stepRow,
    reimbursementNumber(expense.$sequence)
  );
}

/** Looks the person up in Graph; null on any failure or after the timeout. */
async function lookupGraphPerson(
  email: string
): Promise<{ aadId: string; displayName: string } | null> {
  const signal = AbortSignal.timeout(GRAPH_LOOKUP_TIMEOUT_MS);
  try {
    const user = await Promise.race([
      getGraphService().getUser(email),
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
    ]);
    return user ? { aadId: user.id, displayName: user.displayName } : null;
  } catch (error) {
    console.warn("[expense-approval] Graph lookup failed:", error);
    return null;
  }
}

/** The directory key and scope a step's approver belongs to. */
function directoryTarget(
  row: ExpenseApprovals,
  expenseCampus: string
): { campusId: string; key: string; scope: "department" | "campus" } {
  const campusId = row.campus_id ?? expenseCampus;
  const scope =
    row.directory_key?.startsWith("dept:") ||
    (!row.directory_key && row.department)
      ? "department"
      : "campus";
  return {
    campusId,
    scope,
    key:
      row.directory_key ??
      directoryKey({
        campusId,
        departmentId: row.department,
        role: row.approver_role,
        scope,
      }),
  };
}

/**
 * Replaces the approver of the current step, remembers the choice in the
 * approver directory for future expenses, and sends the new approver a fresh
 * approval link. Refuses a step that is not the current one.
 */
export async function changeStepApprover(params: {
  approvalId: string;
  email: string;
  actor: ApprovalActor;
}): Promise<{ ok: true; notified: boolean } | { ok: false; error: string }> {
  const { db } = await createAdminClient();
  let row: ExpenseApprovals;
  try {
    row = await db.getRow<ExpenseApprovals>(
      "app",
      "expense_approvals",
      params.approvalId
    );
  } catch (error) {
    if (appwriteErrorStatus(error) === HTTP_NOT_FOUND) {
      return { ok: false, error: "This approval step does not exist." };
    }
    throw error;
  }
  const expense = await db.getRow<ExpenseSummaryRow>(
    "app",
    "expense",
    row.expense_id,
    [Query.select(EXPENSE_SUMMARY_SELECT)]
  );
  if (
    row.status !== ExpenseApprovalsStatus.PENDING ||
    !(await isCurrentStep(db, row, expense))
  ) {
    return { ok: false, error: NOT_CURRENT_STEP_ERROR };
  }

  const email = params.email.trim().toLowerCase();
  const person = await lookupGraphPerson(email);
  await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
    approver_aad_id: person?.aadId ?? null,
    approver_email: email,
  } as Partial<ExpenseApprovals>);

  const target = directoryTarget(row, expense.campus);
  await setAdminDirectoryApprover(db, {
    aadId: person?.aadId ?? null,
    campusId: target.campusId,
    departmentId: row.department,
    displayName: person?.displayName ?? null,
    email,
    key: target.key,
    role: row.approver_role,
    scope: target.scope,
  });

  await recordExpenseEvents(db, [
    {
      action: "approver_resolved",
      actorEmail: params.actor.email,
      actorKind: params.actor.kind,
      actorName: params.actor.name,
      after: email,
      before: row.approver_email,
      expenseId: row.expense_id,
      field: "approver_email",
      note: "changed in admin",
    },
  ]);

  const stepRow: ExpenseApprovals = {
    ...row,
    approver_aad_id: person?.aadId ?? null,
    approver_email: email,
  };
  try {
    await reissueAndNotify(stepRow, expense);
  } catch (error) {
    await recordNotificationIssue(expense, stepRow, error);
    return { ok: true, notified: false };
  }
  return { ok: true, notified: true };
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
    submitterIsController: false,
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
