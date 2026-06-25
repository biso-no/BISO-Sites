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
 * (always). Persists Teams ids when a card was sent.
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
  } catch (error) {
    console.error("[expense-approval] Email notify failed:", error);
  }

  if (conversationId || activityId) {
    await db.updateRow<ExpenseApprovals>("app", "expense_approvals", row.$id, {
      teams_conversation_id: conversationId,
      teams_activity_id: activityId,
    } as Partial<ExpenseApprovals>);
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
    departmentName: context.departmentName,
    submitterIsFinancialManager: context.submitterIsFinancialManager,
  });

  if (issue) {
    await db.createRow("app", "expense_approval_issues", ID.unique(), {
      expense_id: context.expenseId,
      campus_id: issue.campusId,
      department: issue.department,
      role_sought: issue.roleSought,
      reason: issue.reason,
      status: "open",
    });
  }

  if (steps.length === 0) {
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
      }
    );
    created.push(row);
  }

  const first = created.find((row) => row.step === 1) ?? created[0];
  const firstStep = steps.find((step) => step.step === first.step);
  await notifyStep(
    context,
    first,
    rawTokens.get(first.step) ?? "",
    steps.length,
    firstStep?.aadId ?? null
  );

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
    expired: Date.now() > new Date(row.expires_at).getTime(),
    receipts: attachments.map((att) => ({
      id: att.$id,
      description: att.description ?? "",
      amount: att.amount ?? 0,
      date: att.date,
      fileId: att.url,
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
    return {
      ok: true,
      decision:
        row.status === ExpenseApprovalsStatus.APPROVED
          ? "approved"
          : "rejected",
      finalized: true,
      expenseId: row.expense_id,
      reimbursementNumber: refNumber,
    };
  }

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
    // We don't hold the raw token for the next step, so re-issue one.
    const rawToken = randomBytes(24).toString("hex");
    await db.updateRow<ExpenseApprovals>(
      "app",
      "expense_approvals",
      nextRow.$id,
      { token_hash: hashToken(rawToken) } as Partial<ExpenseApprovals>
    );
    const totalSteps = await countSteps(row.expense_id);
    await notifyStep(
      buildContextFromExpense(expense, refNumber),
      nextRow,
      rawToken,
      totalSteps,
      nextRow.approver_aad_id
    );
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

function buildContextFromExpense(
  expense: ExpenseSummaryRow,
  refNumber: string
): ApprovalChainContext {
  return {
    expenseId: expense.$id,
    campusId: expense.campus,
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
