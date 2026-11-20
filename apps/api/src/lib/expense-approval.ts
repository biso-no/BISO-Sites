// Expense approval orchestration: creates the per-step approval chain, notifies
// approvers (Teams card + Outlook email), and records decisions (advancing the
// chain or rejecting). Shared by the Teams bot endpoint and the web approval
// page so both decision channels converge on the same idempotent logic.

import { createHash, randomBytes } from "node:crypto";
import { ID, type Models, Query } from "@repo/api";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovalIssues,
  type ExpenseApprovals,
  type ExpenseApprovalsApproverRole,
  ExpenseApprovalsStatus,
  type ExpenseEvents,
  type Expenses,
  ExpensesStatus,
  type Users,
} from "@repo/api/types/appwrite";
import {
  type ApprovalCardData,
  buildApprovalCard,
  buildApprovalEmailHtml,
  buildDecisionResultCard,
  ensureBotChatForUser,
  sendApprovalEmail,
  sendProactiveCard,
  updateProactiveCard,
} from "@repo/connectors/teams-bot";
import {
  chainFailedIssueReason,
  directoryKey,
  getCampusApprovalPlan,
  isRebuildIssue,
  NO_APPROVER_ISSUE_REASON,
} from "@repo/shared/utils/expense-approvers";
import { recordExpenseEvents } from "@repo/shared/utils/expense-events";
import { deleteExamplesForExpense } from "@repo/shared/utils/expense-examples";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import { type GuardedApproverStep, guardChain } from "./expense-approval-guard";
import {
  confirmDirectoryApprover,
  setAdminDirectoryApprover,
} from "./expense-approver-directory";
import {
  type ApproverResolutionIssue,
  type ResolvedApproverStep,
  resolveExpenseApprovers,
} from "./expense-approver-resolution";
import {
  type ApprovalCardDetails,
  hasReceiptWithoutAccount,
  loadApprovalCardDetails,
  loadExpenseReceiptRows,
} from "./expense-card-details";
import { getGraphService } from "./graph";

const HTTP_NOT_FOUND = 404;
const TOKEN_TTL_DAYS = 14;
const NATIONAL_CAMPUS_ID = "5";
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
  /** The submitter's user id, when the caller has it; saves a read. */
  submitterUserId?: string;
  total: number;
}

export function stepLabel(
  role: string,
  index: number,
  count: number,
  campusId?: string
): string {
  const roleText: Record<string, string> = {
    finance: "Department financial manager",
    manager: "Department manager",
    deputy: "Department deputy",
    controller: "Campus financial controller",
    president: "Campus president",
    national: "General manager",
  };
  const base =
    role === "controller" && campusId === NATIONAL_CAMPUS_ID
      ? "Controller"
      : (roleText[role] ?? role);
  return count > 1 ? `Step ${index} of ${count} — ${base}` : base;
}

const TRAILING_SLASHES = /\/+$/;

/** The expense's page in the admin, where an account is set. */
function expenseAdminUrl(expenseId: string): string {
  const base = (
    process.env.EXPENSE_ADMIN_URL || "https://admin.biso.no"
  ).replace(TRAILING_SLASHES, "");
  return `${base}/expenses/${expenseId}`;
}

function cardDataFor(
  context: ApprovalChainContext,
  row: ExpenseApprovals,
  rawToken: string,
  totalSteps: number,
  details: ApprovalCardDetails
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
    stepLabel: stepLabel(
      row.approver_role,
      row.step,
      totalSteps,
      context.campusId
    ),
    viewUrl,
    ...details,
    adminUrl: expenseAdminUrl(row.expense_id),
  };
}

interface DeliveryResult {
  emailDelivered: boolean;
  teamsDelivered: boolean;
}

function notifiedEvent(row: ExpenseApprovals, delivery: DeliveryResult) {
  return {
    action: "notified" as const,
    actorKind: "system" as const,
    after: row.approver_email.toLowerCase(),
    expenseId: row.expense_id,
    note: [
      delivery.teamsDelivered && "teams",
      delivery.emailDelivered && "email",
    ]
      .filter(Boolean)
      .join(","),
  };
}

/**
 * Notifies the approver for a step via Teams (best-effort) and Outlook email
 * (always). Writes the `notified` event unless `recordEvent` is false, in which
 * case the caller writes it from the returned delivery result. Persists Teams ids when a card was sent. Throws when neither channel
 * delivered: the raw token only lives in the notification, so a step with no
 * usable link must not be accepted silently (the caller fails the submission).
 */
async function notifyStep(
  context: ApprovalChainContext,
  row: ExpenseApprovals,
  rawToken: string,
  totalSteps: number,
  aadId: string | null,
  options: { recordEvent?: boolean } = {}
): Promise<DeliveryResult> {
  const { db } = await createAdminClient();
  // Loaded for every notification (first step, next step, resend), so the
  // next approver sees the changes made at earlier steps.
  const details = await loadApprovalCardDetails(db, row.expense_id);
  const data = cardDataFor(context, row, rawToken, totalSteps, details);

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

  const delivery = { emailDelivered, teamsDelivered };
  if (options.recordEvent !== false) {
    await recordExpenseEvents(db, [notifiedEvent(row, delivery)]);
  }
  return delivery;
}

export interface CreateChainResult {
  notified: boolean;
  stepsCreated: number;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** The `approver_resolved` history note: role and source, or the fallback. */
function approverResolvedNote(
  step: Pick<ResolvedApproverStep, "fallbackFor" | "role" | "source">
): string {
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

/** The account email on a user row, or null when the row is gone. */
async function loadUserEmail(
  db: AdminDb,
  userId: string
): Promise<string | null> {
  const user = await db
    .getRow<Users>("app", "user", userId)
    .catch((error: unknown) => {
      // A missing user row only means there is no email to compare.
      if (appwriteErrorStatus(error) === HTTP_NOT_FOUND) {
        return null;
      }
      throw error;
    });
  return user?.email?.trim().toLowerCase() || null;
}

/** The submitter's account email (trimmed, lowercased), or null when unknown. */
async function loadSubmitterEmail(
  db: AdminDb,
  expenseId: string,
  userId?: string
): Promise<string | null> {
  let id = userId;
  if (!id) {
    const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select(["$id", "userId"]),
    ]);
    id = expense?.userId;
  }
  return id ? loadUserEmail(db, id) : null;
}

/** Issue writes are best-effort once the chain exists: never thrown. */
async function recordResolutionIssuesSafely(
  db: AdminDb,
  expenseId: string,
  issues: readonly ApproverResolutionIssue[]
): Promise<void> {
  for (const issue of issues) {
    try {
      await recordResolutionIssues(db, expenseId, [issue]);
    } catch (error) {
      console.error("[expense-approval] issue write failed:", error);
    }
  }
}

export interface CreateChainOptions {
  /** A failure leaves the expense pending instead of returning it to draft. */
  keepPendingOnFailure?: boolean;
  /**
   * A failure records an approval issue the IT queue can act on (rebuild the
   * chain), then throws `ApprovalChainFailedError`. For the background check,
   * where nobody is waiting for an answer.
   */
  recordIssue?: boolean;
}

/**
 * The approval chain could not be built in the background, and an approval
 * issue now says so. The expense is pending with no steps; a global admin
 * rebuilds the chain once the cause is fixed.
 */
export class ApprovalChainFailedError extends Error {
  constructor(cause: unknown) {
    super(
      `The approval chain could not be created: ${
        cause instanceof Error ? cause.message : "unknown error"
      }`,
      { cause }
    );
    this.name = "ApprovalChainFailedError";
  }
}

/** The issue of a chain that failed in the background, so IT can rebuild it. */
async function recordChainFailureIssue(
  context: ApprovalChainContext,
  error: unknown
): Promise<void> {
  const { db } = await createAdminClient();
  // The step that was to be notified first.
  const firstPlanned = getCampusApprovalPlan({
    campusId: context.campusId,
    departmentId: context.departmentId,
    submitterIsController: context.submitterIsController,
    submitterIsFinancialManager: context.submitterIsFinancialManager,
  }).at(0);
  const cause = error instanceof Error ? error.message : "unknown error";
  await db.createRow("app", "expense_approval_issues", ID.unique(), {
    expense_id: context.expenseId,
    campus_id: context.campusId,
    department: context.departmentName ?? "(none)",
    role_sought: firstPlanned?.role ?? "controller",
    reason: truncateReason(chainFailedIssueReason(cause)),
    status: "open",
  });
}

/**
 * Resolves approvers, creates the chain rows, and notifies the first step.
 * Writes a remediation issue when an approver can't be found, once the chain
 * rows hold the claim, so a racing duplicate submit records none.
 *
 * With `recordIssue`, any other failure is recorded as an approval issue and
 * thrown as `ApprovalChainFailedError`; when even that write fails, the
 * original error is thrown, as nobody has been told. A row conflict is
 * thrown as it is: another run holds the chain, so nothing failed.
 */
export async function createApprovalChain(
  context: ApprovalChainContext,
  options: CreateChainOptions = {}
): Promise<CreateChainResult> {
  if (!options.recordIssue) {
    return await buildApprovalChain(context, options);
  }
  try {
    return await buildApprovalChain(context, options);
  } catch (error) {
    if (isRowConflictError(error)) {
      throw error;
    }
    await recordChainFailureIssue(context, error);
    throw new ApprovalChainFailedError(error);
  }
}

/**
 * Whether an approver was told about this submission: a `notified` event no
 * older than the latest `submitted` one. `createApprovalChain` writes it once
 * the chain stands and its first step was notified.
 */
async function notifiedSinceSubmit(
  db: AdminDb,
  expenseId: string
): Promise<boolean> {
  const latest = (action: "notified" | "submitted") =>
    db.listRows<ExpenseEvents>("app", "expense_events", [
      Query.equal("expense_id", expenseId),
      Query.equal("action", action),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  const [notified, submitted] = await Promise.all([
    latest("notified"),
    latest("submitted"),
  ]);
  const notifiedAt = notified.rows[0]?.$createdAt;
  const submittedAt = submitted.rows[0]?.$createdAt;
  return Boolean(notifiedAt && (!submittedAt || notifiedAt >= submittedAt));
}

/**
 * The background check's approval chain, in background mode
 * (`keepPendingOnFailure`, `recordIssue`), told to its first approver exactly
 * once, also when the check runs again after being cut off.
 *
 * A row conflict means an earlier run created step rows. A `notified` event
 * since the submit means the link went out, and nothing more is done.
 * Without one nobody holds a link: when every step is still pending, the
 * rows are deleted and the chain is built again in full, which notifies. A
 * step already decided means the chain moved on, so IT gets a "Could not
 * notify" issue to resend the current step instead.
 */
export async function ensureApprovalChain(
  context: ApprovalChainContext
): Promise<void> {
  const options = { keepPendingOnFailure: true, recordIssue: true };
  try {
    await createApprovalChain(context, options);
    return;
  } catch (error) {
    if (!isRowConflictError(error)) {
      throw error;
    }
  }

  const { db } = await createAdminClient();
  if (await notifiedSinceSubmit(db, context.expenseId)) {
    return;
  }
  const { rows } = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [
      Query.equal("expense_id", context.expenseId),
      Query.orderAsc("step"),
      Query.limit(STEP_LOOKUP_LIMIT),
    ]
  );
  const isPending = (row: ExpenseApprovals) =>
    row.status === ExpenseApprovalsStatus.PENDING;
  if (!rows.every(isPending)) {
    const current = rows.find(isPending);
    if (current) {
      await writeNotificationIssue(
        db,
        current,
        {
          campusId: context.campusId,
          department: context.departmentName ?? "(none)",
        },
        "no notification was recorded after the check"
      );
    }
    return;
  }
  // One at a time: each row is read again just before its delete, because an
  // approver may have opened the link since the list above. A row being
  // decided (`decision_lock`) or already used (`consumed_at`) stops the
  // rebuild and gets the resend issue instead. A failed read or delete
  // throws, so the check stays running and tries again.
  for (const row of rows) {
    const current = await db.getRow<ExpenseApprovals>(
      "app",
      "expense_approvals",
      row.$id
    );
    if (current.decision_lock > 0 || current.consumed_at) {
      await writeNotificationIssue(
        db,
        current,
        {
          campusId: context.campusId,
          department: context.departmentName ?? "(none)",
        },
        "an approver opened the link while the chain was being rebuilt"
      );
      return;
    }
    await db.deleteRow("app", "expense_approvals", row.$id);
  }
  await createApprovalChain(context, options);
}

async function buildApprovalChain(
  context: ApprovalChainContext,
  options: CreateChainOptions
): Promise<CreateChainResult> {
  const { db } = await createAdminClient();

  // Independent reads: the submitter's email is only compared afterwards.
  const [resolved, submitterEmail] = await Promise.all([
    resolveExpenseApprovers(
      {
        campusId: context.campusId,
        campusName: context.campusLabel,
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        submitterIsController: context.submitterIsController,
        submitterIsFinancialManager: context.submitterIsFinancialManager,
      },
      { db }
    ),
    loadSubmitterEmail(db, context.expenseId, context.submitterUserId),
  ]);
  const { steps, issues } = guardChain(context, resolved, submitterEmail);

  if (steps.length === 0) {
    // No chain row exists, so nothing is claimed: these issue writes may
    // throw, and the caller then sees the failure. Nobody approves this one,
    // so the queue has to see it. The sought role is the plan's last step,
    // the one that would have approved it.
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
        reason: NO_APPROVER_ISSUE_REASON,
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
  const createStepRow = async (step: GuardedApproverStep) => {
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
  };

  // The first row is the claim: a racing duplicate submit fails here with a
  // 409, holds nothing of ours, and so must not roll anything back.
  await createStepRow(steps[0]);

  let delivery: DeliveryResult = {
    emailDelivered: false,
    teamsDelivered: false,
  };
  let firstRow: ExpenseApprovals = created[0];
  try {
    for (const step of steps.slice(1)) {
      await createStepRow(step);
    }

    // Transition the expense to `pending` BEFORE notifying, so the approval
    // links we send always point at a submitted expense, not a draft.
    await db.updateRow("app", "expense", context.expenseId, {
      status: ExpensesStatus.PENDING,
    });

    const first = created.find((row) => row.step === 1) ?? created[0];
    const firstStep = steps.find((step) => step.step === first.step);
    delivery = await notifyStep(
      context,
      first,
      rawTokens.get(first.step) ?? "",
      steps.length,
      firstStep?.aadId ?? null,
      { recordEvent: false }
    );
    firstRow = first;
  } catch (error) {
    // Anything after the claim failed (a step row, the status write, or the
    // first approver being unreachable): delete the chain rows (which also
    // invalidates any link already delivered) and, unless the caller keeps it
    // pending, return the expense to draft so it can be resubmitted cleanly,
    // never stranded behind a 409.
    await Promise.all(
      created.map((row) =>
        db.deleteRow("app", "expense_approvals", row.$id).catch((cause) => {
          console.error(
            `[expense-approval] rollback: could not delete step row ${row.$id}:`,
            cause
          );
        })
      )
    );
    // A rebuild or the background check works on an expense that was
    // already submitted: it stays pending.
    if (!options.keepPendingOnFailure) {
      await db
        .updateRow("app", "expense", context.expenseId, {
          status: ExpensesStatus.DRAFT,
        })
        .catch((cause) => {
          console.error(
            `[expense-approval] rollback: could not return expense ${context.expenseId} to draft:`,
            cause
          );
        });
    }
    throw error;
  }

  // Best-effort history and issues, written only once the chain stands so a
  // rolled-back submission leaves no trail behind. Resolution comes before the
  // `notified` event, as it happened.
  await recordResolutionIssuesSafely(db, context.expenseId, issues);
  await recordExpenseEvents(db, [
    ...steps.map((step) => ({
      action: "approver_resolved" as const,
      actorKind: "system" as const,
      after: step.email.trim().toLowerCase(),
      expenseId: context.expenseId,
      note: approverResolvedNote(step),
    })),
    notifiedEvent(firstRow, delivery),
  ]);

  return { stepsCreated: created.length, notified: true };
}

export interface ApprovalReceipt {
  amount: number;
  date: string | null;
  description: string;
  fileId: string | null;
  id: string;
  /** The Finago project the receipt is booked on, or null. */
  projectName: string | null;
  type: string;
}

export interface ApprovalContext {
  /** The expense's admin page, where a missing account is set. */
  adminUrl: string;
  approverRole: string;
  campusLabel: string;
  currency: string;
  departmentLabel: string;
  description: string;
  expired: boolean;
  /** A receipt with an amount has no account, so the page offers no Approve. */
  missingAccount: boolean;
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
    account_number?: number | null;
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
      ]),
    ]
  );

  const totalSteps = await countSteps(row.expense_id);
  const expired = Date.now() > new Date(row.expires_at).getTime();
  const attachments = await loadExpenseReceiptRows(db, row.expense_id);

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
    stepLabel: stepLabel(
      row.approver_role,
      row.step,
      totalSteps,
      String(expense.campus)
    ),
    approverRole: row.approver_role,
    expired,
    adminUrl: expenseAdminUrl(row.expense_id),
    missingAccount: hasReceiptWithoutAccount(attachments),
    receipts: attachments.map((att) => ({
      id: att.$id,
      description: att.description ?? "",
      amount: att.amount ?? 0,
      date: att.date,
      // Don't expose file ids once the link has expired — the file proxy rejects
      // them anyway, but this keeps the expired context from leaking ids.
      fileId: expired ? null : att.url,
      projectName: att.project_name?.trim() || null,
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

/** Stable reasons an approval action is refused, for callers to branch on. */
export type ApprovalErrorCode =
  | "invalid_link"
  | "link_expired"
  | "not_found"
  | "not_current_step"
  | "not_pending"
  | "in_progress"
  | "self_approver"
  | "same_approver"
  | "account_missing";

export type DecisionResult =
  | { ok: false; error: string; code: ApprovalErrorCode }
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
    code: "in_progress",
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
    if (desired === ExpensesStatus.REJECTED) {
      await deleteExamplesForExpense(db, expenseId);
    }
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
  national: "the general manager",
};

/** The role as shown after "On behalf of"; National's controller is just "the controller". */
function roleNoun(
  role: ExpenseApprovalsApproverRole,
  campusId: string | null | undefined
): string {
  return role === "controller" && String(campusId) === NATIONAL_CAMPUS_ID
    ? "the controller"
    : ROLE_NOUN[role];
}

const GRAPH_LOOKUP_TIMEOUT_MS = 6000;
const CARD_UPDATE_TIMEOUT_MS = 5000;
const NOTE_SEPARATOR = " · ";
const NOT_CURRENT_STEP_ERROR = "This step is not waiting for a decision.";
const NOT_PENDING_ERROR =
  "This reimbursement is no longer waiting for approval.";
const HAS_STEPS_ERROR = "This reimbursement already has approval steps.";
const NOT_REBUILDABLE_ERROR =
  "Only a reimbursement left without an approval chain when it was submitted can have its approval chain rebuilt.";
const ISSUE_LOOKUP_LIMIT = 100;
/** More steps than any approval plan has. */
const STEP_LOOKUP_LIMIT = 20;
const HTTP_CONFLICT = 409;
const ACCOUNT_MISSING_ERROR =
  "A receipt has no account yet. Set it in admin before approving.";

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
  /** Where the decision came from; a Teams click already updates its own card. */
  source?: "teams" | "web";
}

/**
 * Replaces the sent Teams card with the decision result when the step was
 * decided somewhere else (the web page or the admin), so the approver cannot
 * click a stale card. Best-effort and bounded: it runs after the decision is
 * fully applied, and a failure or a call slower than
 * `CARD_UPDATE_TIMEOUT_MS` is logged and never fails the decision.
 */
async function updateSentCard(
  row: ExpenseApprovals,
  input: StepDecisionInput,
  refNumber: string
): Promise<void> {
  if (
    input.source === "teams" ||
    !row.teams_conversation_id ||
    !row.teams_activity_id
  ) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      updateProactiveCard({
        activityId: row.teams_activity_id,
        card: buildDecisionResultCard({
          decidedBy: input.actor.name,
          decision: input.decision,
          reimbursementNumber: refNumber,
        }),
        chatId: row.teams_conversation_id,
        tenantId: process.env.TEAMS_BOT_APP_TENANT_ID || "",
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`timed out after ${CARD_UPDATE_TIMEOUT_MS} ms`)),
          CARD_UPDATE_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    console.error("[expense-approval] Teams card update failed:", error);
  } finally {
    clearTimeout(timer);
  }
}

function decisionNote(
  row: ExpenseApprovals,
  input: StepDecisionInput,
  campusId: string | null | undefined
): string | null {
  const parts: string[] = [];
  if (input.onBehalf) {
    parts.push(`On behalf of ${roleNoun(row.approver_role, campusId)}`);
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

  if (expense.status !== ExpensesStatus.PENDING) {
    return { ok: false, code: "not_pending", error: NOT_PENDING_ERROR };
  }

  if (input.requireCurrentStep && !(await isCurrentStep(db, row, expense))) {
    return {
      ok: false,
      code: "not_current_step",
      error: NOT_CURRENT_STEP_ERROR,
    };
  }

  // The card and the page hide Approve here, but an old card or a crafted
  // call must not book an account nobody chose. Rejecting stays open. Checked
  // after the expense status, so an old link on a decided expense says so.
  if (
    input.decision === "approved" &&
    (await expenseLacksAccount(db, row.expense_id))
  ) {
    return { ok: false, code: "account_missing", error: ACCOUNT_MISSING_ERROR };
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
      note: decisionNote(row, input, expense.campus),
    },
  ]);

  const result = await applyDecisionOutcome(db, row, expense, input, refNumber);
  // Last, so a slow Teams call never holds up the status or the next step.
  await updateSentCard(row, input, refNumber);
  return result;
}

/**
 * Closes the expense's open approval issues once it is rejected, so the IT
 * queue stops offering fixes for a dead expense. Best-effort.
 */
async function resolveOpenIssues(
  db: AdminDb,
  expenseId: string
): Promise<void> {
  try {
    const open = await db.listRows<Models.Row>(
      "app",
      "expense_approval_issues",
      [
        Query.equal("expense_id", expenseId),
        Query.equal("status", "open"),
        Query.limit(100),
      ]
    );
    for (const issue of open.rows) {
      await db.updateRow("app", "expense_approval_issues", issue.$id, {
        status: "resolved",
        resolved_by: "system: expense rejected",
        resolved_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[expense-approval] could not resolve open issues:", error);
  }
}

/**
 * After a step's decision is written: a rejection rejects the expense, an
 * approval confirms the directory entry and notifies the next step, or
 * finalizes the expense.
 */
async function applyDecisionOutcome(
  db: AdminDb,
  row: ExpenseApprovals,
  expense: ExpenseSummaryRow,
  input: StepDecisionInput,
  refNumber: string
): Promise<DecisionResult> {
  if (input.decision === "rejected") {
    await db.updateRow("app", "expense", row.expense_id, {
      status: ExpensesStatus.REJECTED,
    });
    await resolveOpenIssues(db, row.expense_id);
    // A rejected receipt teaches nothing; the delete logs its own failures.
    await deleteExamplesForExpense(db, row.expense_id);
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

/** True when a receipt of the expense has an amount but no account. */
async function expenseLacksAccount(
  db: AdminDb,
  expenseId: string
): Promise<boolean> {
  return hasReceiptWithoutAccount(await loadExpenseReceiptRows(db, expenseId));
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
  source?: "teams" | "web";
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
    return {
      ok: false,
      code: "invalid_link",
      error: "This approval link is invalid.",
    };
  }
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return {
      ok: false,
      code: "link_expired",
      error: "This approval link has expired.",
    };
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
    source: params.source,
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
      return {
        ok: false,
        code: "not_found",
        error: "This approval step does not exist.",
      };
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
 * Writes the "Could not notify" issue for a step: the IT queue offers a
 * resend for it, which re-issues the approval link.
 */
async function writeNotificationIssue(
  db: AdminDb,
  stepRow: ExpenseApprovals,
  place: { campusId: string; department: string | null },
  message: string
): Promise<void> {
  await db.createRow("app", "expense_approval_issues", ID.unique(), {
    expense_id: stepRow.expense_id,
    campus_id: place.campusId,
    department: place.department,
    role_sought: stepRow.approver_role,
    reason: truncateReason(
      `Could not notify ${stepRow.approver_email} for step ${stepRow.step} (${message}). Use resend to re-issue the approval link.`
    ),
    status: "open",
  });
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
  await writeNotificationIssue(
    db,
    stepRow,
    {
      campusId: expense.campus,
      department: expense.departmentRel?.Name ?? expense.department,
    },
    error instanceof Error ? error.message : "unknown error"
  );
}

/**
 * Re-issues a fresh token for the lowest pending approval step of an expense and
 * re-notifies that approver. Used by the IT remediation queue to recover a chain
 * whose next-step notification failed to deliver. Idempotent and safe to retry.
 */
export async function resendApprovalNotification(
  expenseId: string
): Promise<{ ok: boolean; error?: string; code?: "not_pending" }> {
  const { db } = await createAdminClient();
  const expense = await db.getRow<Models.Row & { status: ExpensesStatus }>(
    "app",
    "expense",
    expenseId,
    [Query.select(["$id", "status"])]
  );
  if (expense.status !== ExpensesStatus.PENDING) {
    return { ok: false, code: "not_pending", error: NOT_PENDING_ERROR };
  }
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

/** True when a unique index already holds the row (a racing request got there first). */
export function isRowConflictError(error: unknown): boolean {
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

type RebuildExpenseRow = ExpenseSummaryRow & {
  submitter_is_controller: boolean;
  submitter_is_financial_manager: boolean;
};

/**
 * Whether the expense has an issue `createApprovalChain` records when it
 * leaves a submission with no steps, in any status: no step resolved, or the
 * chain failed after the background check. A reimbursement sent to
 * accounting by email is pending with no steps too, but never has one. An
 * issue older than the expense's latest `submitted` event belongs to an
 * earlier submission (the expense was resubmitted by email since), so it does
 * not count. With no `submitted` event there is nothing to compare against
 * and any such issue counts.
 */
async function hasRebuildIssue(
  db: AdminDb,
  expenseId: string
): Promise<boolean> {
  const [{ rows }, { rows: submitted }] = await Promise.all([
    db.listRows<ExpenseApprovalIssues>("app", "expense_approval_issues", [
      Query.equal("expense_id", expenseId),
      Query.select(["reason", "$createdAt"]),
      Query.orderAsc("$createdAt"),
      Query.limit(ISSUE_LOOKUP_LIMIT),
    ]),
    db.listRows<ExpenseEvents>("app", "expense_events", [
      Query.equal("expense_id", expenseId),
      Query.equal("action", "submitted"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]),
  ]);
  const submittedAt = submitted[0]?.$createdAt;
  return rows.some(
    (row) =>
      isRebuildIssue(row.reason) &&
      (!submittedAt || row.$createdAt >= submittedAt)
  );
}

export type RebuildErrorCode =
  | "posting_disabled"
  | "not_pending"
  | "has_steps"
  | "not_rebuildable"
  | "not_found"
  | "failed";

/**
 * Builds the approval chain again for a pending expense that has none because
 * no approver could be found at submit, or the chain failed after the
 * background check. Refused while direct booking is off, and for any expense
 * without such an issue from that submit: one sent to accounting by email is
 * handled there, and approving it here too would pay it twice. Uses the submitter's flags saved on the expense, so the plan is
 * the one the submission would have got.
 */
export async function rebuildApprovalChain(params: {
  actor: ApprovalActor;
  expenseId: string;
}): Promise<
  | { ok: true; stepsCreated: number }
  | { ok: false; code: RebuildErrorCode; error: string }
> {
  if (!(await isFeatureEnabled("expenses_ledger_posting"))) {
    return {
      ok: false,
      code: "posting_disabled",
      error: "expenses_ledger_posting disabled",
    };
  }
  const { db } = await createAdminClient();
  const expense = await db
    .getRow<RebuildExpenseRow>("app", "expense", params.expenseId, [
      Query.select([
        ...EXPENSE_SUMMARY_SELECT,
        "submitter_is_controller",
        "submitter_is_financial_manager",
      ]),
    ])
    .catch((error: unknown) => {
      if (appwriteErrorStatus(error) === HTTP_NOT_FOUND) {
        return null;
      }
      throw error;
    });
  if (!expense) {
    return { ok: false, code: "not_found", error: "Expense not found." };
  }
  if (expense.status !== ExpensesStatus.PENDING) {
    return { ok: false, code: "not_pending", error: NOT_PENDING_ERROR };
  }
  const existing = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [Query.equal("expense_id", params.expenseId), Query.limit(1)]
  );
  if (existing.rows.length > 0) {
    return {
      ok: false,
      code: "has_steps",
      error: HAS_STEPS_ERROR,
    };
  }
  if (!(await hasRebuildIssue(db, params.expenseId))) {
    return {
      ok: false,
      code: "not_rebuildable",
      error: NOT_REBUILDABLE_ERROR,
    };
  }

  const submitter = await db
    .getRow<Users>("app", "user", expense.userId, [
      Query.select(["$id", "name"]),
    ])
    .catch((error: unknown) => {
      if (appwriteErrorStatus(error) === HTTP_NOT_FOUND) {
        return null;
      }
      throw error;
    });
  let result: CreateChainResult;
  try {
    result = await createApprovalChain(
      {
        ...buildContextFromExpense(
          expense,
          reimbursementNumber(expense.$sequence)
        ),
        submitterIsController: expense.submitter_is_controller,
        submitterIsFinancialManager: expense.submitter_is_financial_manager,
        submitterName: submitter?.name || "BISO member",
        submitterUserId: expense.userId,
      },
      { keepPendingOnFailure: true }
    );
  } catch (error) {
    if (isRowConflictError(error)) {
      return { ok: false, code: "has_steps", error: HAS_STEPS_ERROR };
    }
    console.error("[expense-approval] rebuild failed:", error);
    return {
      ok: false,
      code: "failed",
      error:
        "The approval chain could not be rebuilt. The expense is still pending with no steps. Try again.",
    };
  }
  await recordExpenseEvents(db, [
    {
      action: "edited",
      actorEmail: params.actor.email,
      actorKind: params.actor.kind,
      actorName: params.actor.name,
      expenseId: params.expenseId,
      field: "approval_chain",
      note:
        result.stepsCreated === 0
          ? "rebuilt in admin: no approver found"
          : `rebuilt in admin: ${result.stepsCreated} steps`,
    },
  ]);
  return { ok: true, stepsCreated: result.stepsCreated };
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

const DEPARTMENT_ROLES: ReadonlySet<string> = new Set([
  "finance",
  "manager",
  "deputy",
]);

/**
 * The directory entry a step's approver belongs to. Finance, manager and deputy
 * are per department (keyed by the expense's department id); the rest are per
 * campus. `row.department` holds the department NAME, so it is never used here.
 */
function directoryTarget(
  row: ExpenseApprovals,
  expense: ExpenseSummaryRow
): {
  campusId: string;
  departmentId: string | null;
  key: string;
  scope: "department" | "campus";
} {
  const isDepartmentRole = DEPARTMENT_ROLES.has(row.approver_role);
  const scope = isDepartmentRole ? "department" : "campus";
  const departmentId = isDepartmentRole ? (expense.department ?? null) : null;
  return {
    campusId: expense.campus,
    departmentId,
    scope,
    key:
      row.directory_key ??
      directoryKey({
        campusId: expense.campus,
        departmentId,
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
}): Promise<
  | {
      ok: true;
      notified: boolean;
      directorySaved: boolean;
      directorySkipped?: boolean;
    }
  | { ok: false; error: string; code: ApprovalErrorCode }
> {
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
      return {
        ok: false,
        code: "not_found",
        error: "This approval step does not exist.",
      };
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
    return {
      ok: false,
      code: "not_current_step",
      error: NOT_CURRENT_STEP_ERROR,
    };
  }

  const email = params.email.trim().toLowerCase();
  if (row.approver_email.trim().toLowerCase() === email) {
    return {
      ok: false,
      code: "same_approver",
      error: "This person is already the approver for the step.",
    };
  }
  if ((await loadUserEmail(db, expense.userId)) === email) {
    return {
      ok: false,
      code: "self_approver",
      error: "The submitter cannot approve their own expense.",
    };
  }
  const person = await lookupGraphPerson(email);
  await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
    approver_aad_id: person?.aadId ?? null,
    approver_email: email,
  } as Partial<ExpenseApprovals>);

  // The general manager is one organisation-wide directory entry (a step with
  // role "national", also as a fallback for a missing president/controller);
  // one expense must not rewrite it.
  let directorySaved = false;
  const directorySkipped = row.approver_role === "national";
  if (!directorySkipped) {
    const target = directoryTarget(row, expense);
    directorySaved = await setAdminDirectoryApprover(db, {
      aadId: person?.aadId ?? null,
      campusId: target.campusId,
      departmentId: target.departmentId,
      displayName: person?.displayName ?? null,
      email,
      key: target.key,
      role: row.approver_role,
      scope: target.scope,
    });
  }

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

  const skipped = directorySkipped ? { directorySkipped: true } : {};
  const stepRow: ExpenseApprovals = {
    ...row,
    approver_aad_id: person?.aadId ?? null,
    approver_email: email,
  };
  try {
    await reissueAndNotify(stepRow, expense);
  } catch (error) {
    await recordNotificationIssue(expense, stepRow, error);
    return { ok: true, notified: false, directorySaved, ...skipped };
  }
  return { ok: true, notified: true, directorySaved, ...skipped };
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
