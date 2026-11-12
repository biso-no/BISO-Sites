import "server-only";

import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovalIssues,
  type ExpenseApprovals,
  type ExpenseAttachments,
  type ExpenseCostTypes,
  type ExpenseEvents,
  type Expenses,
  ExpensesStatus,
  type LedgerAccounts,
} from "@repo/api/types/appwrite";
import { costTypeLabel } from "@repo/shared/utils/expense-cost-types";
import {
  type ApproverHint,
  parseApproverHints,
  parseReceiptIssues,
} from "@repo/shared/utils/expense-hints";
import { receiptFileId } from "@repo/shared/utils/receipt-file-id";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import {
  currentPendingStep,
  type ExpenseAccessStep,
  type ExpensePermissions,
  type ExpenseViewer,
  expensePermissions,
  expenseVisibilityQueries,
  maskBankAccount,
} from "@/lib/expense-access";
import {
  emptyResult,
  firstParam,
  type ListSearchParams,
  type PageSize,
  type PaginatedResult,
  parseListParams,
} from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";

export type ExpenseListView = "all" | "mine" | "attention";

export interface ExpenseListFilters {
  campusId: string | null;
  departmentId: string | null;
  page: number;
  q: string;
  size: PageSize;
  status: string | null;
  view: ExpenseListView;
}

export interface ExpenseListRow {
  campusName: string;
  currentStep: { approverEmail: string; role: string } | null;
  departmentName: string;
  flags: { approverIssue: boolean; failed: boolean; hints: number };
  id: string;
  reference: string;
  status: string;
  submittedAt: string;
  submitterName: string;
  total: number;
}

/** Statuses the list can filter on. `draft` is a student's unsent form. */
export const EXPENSE_LIST_STATUSES: string[] = Object.values(
  ExpensesStatus
).filter((status) => status !== ExpensesStatus.DRAFT);

const VIEWS: readonly ExpenseListView[] = ["all", "mine", "attention"];
const SEQUENCE_QUERY = /^\d{1,9}$/;
/** The first reimbursement number is 10001, i.e. `$sequence` 1. */
const SEQUENCE_OFFSET = 10_000;
const LOOKUP_LIMIT = 100;
const STEPS_PER_EXPENSE_CAP = 10;

const SELECT = [
  "$id",
  "$sequence",
  "$createdAt",
  "status",
  "total",
  "campus",
  "department",
  "approver_hints",
  "userId",
  "user.name",
  "departmentRel.Name",
  "campusRel.name",
];

export function resolveExpenseListFilters(
  sp: ListSearchParams
): ExpenseListFilters {
  const status = firstParam(sp, "status");
  const view = firstParam(sp, "view");
  return {
    ...parseListParams(sp),
    campusId: firstParam(sp, "campus") || null,
    departmentId: firstParam(sp, "department") || null,
    status: status && EXPENSE_LIST_STATUSES.includes(status) ? status : null,
    view: VIEWS.find((v) => v === view) ?? "all",
  };
}

export interface ExpenseListIds {
  /** Expenses the viewer is an approver on, for the visibility rule. */
  approverExpenseIds: string[];
  /** Expenses with an open approver issue (attention view). */
  issueExpenseIds: string[];
  /** Expenses waiting on the viewer right now (mine view). */
  mineExpenseIds: string[];
}

/** A reimbursement number: 1-9 digits that map to a positive sequence. */
function isSequenceQuery(q: string): boolean {
  return SEQUENCE_QUERY.test(q) && Number(q) - SEQUENCE_OFFSET > 0;
}

/** The `expense` list queries, or `null` when the result is provably empty. */
export function buildExpenseListQueries(
  viewer: ExpenseViewer,
  filters: ExpenseListFilters,
  ids: ExpenseListIds,
  opts: { textSearchOnly?: boolean } = {}
): string[] | null {
  if (filters.view === "mine" && ids.mineExpenseIds.length === 0) {
    return null;
  }
  const queries = [
    Query.notEqual("status", ExpensesStatus.DRAFT),
    Query.orderDesc("$createdAt"),
    Query.select(SELECT),
    ...paginationQueries(filters),
    ...expenseVisibilityQueries(viewer, ids.approverExpenseIds),
  ];
  if (filters.view === "mine") {
    queries.push(
      Query.equal("status", ExpensesStatus.PENDING),
      Query.equal("$id", ids.mineExpenseIds)
    );
  }
  if (filters.view === "attention") {
    const sides = [Query.equal("status", ExpensesStatus.FAILED)];
    if (ids.issueExpenseIds.length > 0) {
      sides.push(Query.equal("$id", ids.issueExpenseIds));
    }
    queries.push(sides.length === 1 ? (sides[0] as string) : Query.or(sides));
  }
  if (filters.status) {
    queries.push(Query.equal("status", filters.status));
  }
  if (filters.campusId) {
    queries.push(Query.equal("campus", filters.campusId));
  }
  if (filters.departmentId) {
    queries.push(Query.equal("department", filters.departmentId));
  }
  if (filters.q) {
    queries.push(
      !opts.textSearchOnly && isSequenceQuery(filters.q)
        ? Query.equal("$sequence", Number(filters.q) - SEQUENCE_OFFSET)
        : Query.search("description", filters.q)
    );
  }
  return queries;
}

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function listViewerSteps(
  db: Db,
  viewer: ExpenseViewer,
  pending: boolean
) {
  if (viewer.emails.length === 0) {
    return [];
  }
  const { rows } = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [
      Query.equal("approver_email", viewer.emails),
      ...(pending ? [Query.equal("status", "pending")] : []),
      Query.select(["expense_id"]),
      Query.limit(LOOKUP_LIMIT),
    ]
  );
  return rows;
}

async function listStepsFor(
  db: Db,
  expenseIds: string[]
): Promise<(ExpenseAccessStep & { expense_id: string })[]> {
  if (expenseIds.length === 0) {
    return [];
  }
  const { rows } = await db.listRows<ExpenseApprovals>(
    "app",
    "expense_approvals",
    [
      Query.equal("expense_id", expenseIds),
      Query.select([
        "$id",
        "expense_id",
        "step",
        "approver_role",
        "approver_email",
        "status",
      ]),
      Query.limit(expenseIds.length * STEPS_PER_EXPENSE_CAP),
    ]
  );
  return rows;
}

async function listOpenIssueExpenseIds(
  db: Db,
  expenseIds?: string[]
): Promise<string[]> {
  if (expenseIds?.length === 0) {
    return [];
  }
  const { rows } = await db.listRows<ExpenseApprovalIssues>(
    "app",
    "expense_approval_issues",
    [
      Query.equal("status", "open"),
      ...(expenseIds ? [Query.equal("expense_id", expenseIds)] : []),
      Query.select(["expense_id"]),
      Query.limit(expenseIds ? expenseIds.length * 5 : LOOKUP_LIMIT),
    ]
  );
  return [
    ...new Set(
      rows.map((r) => r.expense_id).filter((id): id is string => Boolean(id))
    ),
  ];
}

/** Expenses whose CURRENT pending step is one of the viewer's own. */
async function listMineExpenseIds(
  db: Db,
  viewer: ExpenseViewer
): Promise<string[]> {
  const mine = await listViewerSteps(db, viewer, true);
  const candidateIds = [...new Set(mine.map((s) => s.expense_id))];
  const steps = await listStepsFor(db, candidateIds);
  return candidateIds.filter((id) => {
    const current = currentPendingStep(
      ExpensesStatus.PENDING,
      steps.filter((s) => s.expense_id === id)
    );
    return current && viewer.emails.includes(current.approver_email);
  });
}

export async function listExpenses(
  viewer: ExpenseViewer,
  filters: ExpenseListFilters
): Promise<PaginatedResult<ExpenseListRow>> {
  const { db } = await createAdminClient();

  const [approverSteps, mineExpenseIds, issueExpenseIds] = await Promise.all([
    viewer.isGlobalAdmin ? [] : listViewerSteps(db, viewer, false),
    filters.view === "mine" ? listMineExpenseIds(db, viewer) : [],
    filters.view === "attention" ? listOpenIssueExpenseIds(db) : [],
  ]);

  const approverExpenseIds = [
    ...new Set(approverSteps.map((s) => s.expense_id)),
  ];
  const queries = buildExpenseListQueries(viewer, filters, {
    approverExpenseIds,
    issueExpenseIds,
    mineExpenseIds,
  });
  if (queries === null) {
    return emptyResult(filters);
  }

  let response: { rows: Expenses[]; total: number };
  try {
    response = await db.listRows<Expenses>("app", "expense", queries);
  } catch (error) {
    if (!isSequenceQuery(filters.q)) {
      throw error;
    }
    // The server may reject `$sequence` queries; fall back to description search.
    console.error("[expenses-list] sequence search failed", error);
    const fallback = buildExpenseListQueries(
      viewer,
      filters,
      { approverExpenseIds, issueExpenseIds, mineExpenseIds },
      { textSearchOnly: true }
    );
    response = await db.listRows<Expenses>("app", "expense", fallback ?? []);
  }
  const { rows, total } = response;
  const pageIds = rows.map((row) => row.$id);
  const [steps, issueIds] = await Promise.all([
    listStepsFor(db, pageIds),
    listOpenIssueExpenseIds(db, pageIds),
  ]);
  const issueSet = new Set(issueIds);

  return {
    page: filters.page,
    rows: rows.map((row) => {
      const current = currentPendingStep(
        row.status,
        steps.filter((s) => s.expense_id === row.$id)
      );
      return {
        campusName: row.campusRel?.name ?? "",
        currentStep: current
          ? {
              approverEmail: current.approver_email,
              role: current.approver_role,
            }
          : null,
        departmentName: row.departmentRel?.Name ?? "",
        flags: {
          approverIssue: issueSet.has(row.$id),
          failed: row.status === ExpensesStatus.FAILED,
          hints: parseApproverHints(row.approver_hints).length,
        },
        id: row.$id,
        reference: reimbursementNumber(row.$sequence),
        status: row.status,
        submittedAt: row.$createdAt,
        submitterName: row.user?.name ?? "",
        total: row.total,
      };
    }),
    size: filters.size,
    total,
  };
}

export interface ExpenseDetailReceipt {
  accountName: string | null;
  accountNumber: number | null;
  accountSource: string | null;
  aiConfidence: number | null;
  aiCostType: string | null;
  amount: number | null;
  bookedDate: string | null;
  costType: string | null;
  costTypeLabel: string | null;
  costTypeText: string | null;
  date: string | null;
  description: string | null;
  fileId: string | null;
  id: string;
  isSupporting: boolean;
  receiptIssues: string[];
}

export interface ExpenseDetailStep {
  approverEmail: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByEmail: string | null;
  id: string;
  isCurrent: boolean;
  onBehalf: boolean;
  reason: string | null;
  role: string;
  status: string;
  step: number;
}

export type ExpenseDetailEvent = Omit<
  ExpenseEvents,
  | keyof Models.Row
  | "action"
  | "expense_id"
  | "actor_email"
  | "actor_kind"
  | "actor_name"
  | "attachment_id"
> & {
  /** An `ExpenseEventsAction` value, as a string so unknown ones can be shown. */
  action: string;
  actorEmail: string | null;
  actorKind: string;
  actorName: string | null;
  at: string;
  attachmentId: string | null;
  id: string;
};

export interface ExpenseDetail {
  bankAccount: string;
  bookingFailure: string | null;
  campus: { id: string; name: string };
  department: { id: string; name: string };
  description: string;
  event: { id: string; title: string } | null;
  events: ExpenseDetailEvent[];
  hints: ApproverHint[];
  id: string;
  ledgerTransactionId: string | null;
  occasion: string;
  permissions: ExpensePermissions;
  presidentFallback: boolean;
  receipts: ExpenseDetailReceipt[];
  reference: string;
  status: string;
  steps: ExpenseDetailStep[];
  submitter: { email: string; name: string };
  switches: { controller: boolean; financialManager: boolean };
  total: number;
}

const EVENT_LIMIT = 200;
const RECEIPT_LIMIT = 100;
const POSTING_MARKER = "posting";
const NATIONAL_CAMPUS_ID = "5";

const DETAIL_SELECT = [
  "$id",
  "$sequence",
  "status",
  "total",
  "campus",
  "department",
  "bank_account",
  "description",
  "occasion",
  "event_id",
  "eventName",
  "approver_hints",
  "userId",
  "ledger_transaction_id",
  "submitter_is_financial_manager",
  "submitter_is_controller",
  "user.name",
  "user.email",
  "departmentRel.Name",
  "campusRel.name",
  "expenseAttachments.*",
];

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 404
  );
}

function toReceipt(row: ExpenseAttachments): ExpenseDetailReceipt {
  return {
    accountName: null,
    accountNumber: row.account_number,
    accountSource: row.account_source,
    aiConfidence: row.ai_confidence,
    aiCostType: row.ai_cost_type,
    amount: row.amount,
    bookedDate: row.booked_date,
    costType: row.cost_type,
    costTypeLabel: null,
    costTypeText: row.cost_type_text,
    date: row.date,
    description: row.description,
    fileId: receiptFileId(row.url),
    id: row.$id,
    isSupporting: (row.amount ?? 0) <= 0,
    receiptIssues: parseReceiptIssues(row.receipt_issues),
  };
}

async function loadDetailParts(db: Db, expenseId: string, failed: boolean) {
  const [approvals, events, lastFailure] = await Promise.all([
    db.listRows<ExpenseApprovals>("app", "expense_approvals", [
      Query.equal("expense_id", expenseId),
      Query.orderAsc("step"),
      Query.select([
        "$id",
        "step",
        "approver_role",
        "approver_email",
        "status",
        "decided_by",
        "decided_by_email",
        "decided_at",
        "on_behalf",
        "reason",
      ]),
      Query.limit(STEPS_PER_EXPENSE_CAP * 3),
    ]),
    db.listRows<ExpenseEvents>("app", "expense_events", [
      Query.equal("expense_id", expenseId),
      Query.orderAsc("$createdAt"),
      Query.limit(EVENT_LIMIT),
    ]),
    failed
      ? db.listRows<ExpenseEvents>("app", "expense_events", [
          Query.equal("expense_id", expenseId),
          Query.equal("action", "booking_failed"),
          Query.orderDesc("$createdAt"),
          Query.limit(1),
        ])
      : Promise.resolve({ rows: [] as ExpenseEvents[] }),
  ]);
  return {
    approvals: approvals.rows,
    events: events.rows,
    failureNote: lastFailure.rows[0]?.note ?? null,
  };
}

/** Fills in the cost type labels and account names the receipts point at. */
async function withReceiptLabels(
  db: Db,
  receipts: ExpenseDetailReceipt[],
  locale: string
): Promise<ExpenseDetailReceipt[]> {
  const slugs = [
    ...new Set(receipts.map((r) => r.costType).filter((v): v is string => !!v)),
  ];
  const numbers = [
    ...new Set(
      receipts
        .map((r) => r.accountNumber)
        .filter((v): v is number => v !== null)
    ),
  ];
  const [types, accounts] = await Promise.all([
    slugs.length > 0
      ? db.listRows<ExpenseCostTypes>("app", "expense_cost_types", [
          Query.equal("slug", slugs),
          Query.select(["slug", "label", "label_no"]),
          Query.limit(LOOKUP_LIMIT),
        ])
      : { rows: [] as ExpenseCostTypes[] },
    numbers.length > 0
      ? db.listRows<LedgerAccounts>("app", "ledger_accounts", [
          Query.equal("account_number", numbers),
          Query.select(["account_number", "name"]),
          Query.limit(LOOKUP_LIMIT),
        ])
      : { rows: [] as LedgerAccounts[] },
  ]);
  return receipts.map((r) => {
    const type = types.rows.find((t) => t.slug === r.costType);
    return {
      ...r,
      accountName:
        accounts.rows.find((a) => a.account_number === r.accountNumber)?.name ??
        null,
      costTypeLabel: type
        ? costTypeLabel({ label: type.label, labelNo: type.label_no }, locale)
        : null,
    };
  });
}

/**
 * One expense for the detail page, or null when it is missing, a draft or not
 * the viewer's to see.
 */
export async function getExpenseDetail(
  viewer: ExpenseViewer,
  expenseId: string,
  locale = "en"
): Promise<ExpenseDetail | null> {
  const { db } = await createAdminClient();
  let expense: Expenses;
  try {
    expense = await db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select(DETAIL_SELECT),
    ]);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
  if (expense.status === ExpensesStatus.DRAFT) {
    return null;
  }

  const parts = await loadDetailParts(
    db,
    expense.$id,
    expense.status === ExpensesStatus.FAILED
  );
  const accessSteps = parts.approvals.map((a) => ({
    $id: a.$id,
    approver_email: a.approver_email,
    approver_role: a.approver_role,
    status: a.status,
    step: a.step,
  }));
  const permissions = expensePermissions(
    viewer,
    {
      campus: expense.campus,
      status: expense.status,
      submitter_is_controller: expense.submitter_is_controller,
      submitter_is_financial_manager: expense.submitter_is_financial_manager,
      userId: expense.userId,
    },
    accessSteps
  );
  if (!permissions.canView) {
    return null;
  }

  const receipts = await withReceiptLabels(
    db,
    (expense.expenseAttachments ?? [])
      .slice(0, RECEIPT_LIMIT)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toReceipt),
    locale
  );
  const bankAccount = expense.bank_account ?? "";
  return {
    bankAccount: permissions.canEditBankAccount
      ? bankAccount
      : maskBankAccount(bankAccount),
    bookingFailure:
      expense.status === ExpensesStatus.FAILED ? parts.failureNote : null,
    campus: { id: expense.campus, name: expense.campusRel?.name ?? "" },
    department: {
      id: expense.department,
      name: expense.departmentRel?.Name ?? "",
    },
    description: expense.description ?? "",
    event: expense.event_id
      ? {
          id: expense.event_id,
          title: expense.eventName ?? expense.event_id,
        }
      : null,
    events: parts.events.map((e) => ({
      action: e.action,
      actorEmail: e.actor_email,
      actorKind: e.actor_kind,
      actorName: e.actor_name,
      after: e.after,
      at: e.$createdAt,
      attachmentId: e.attachment_id,
      before: e.before,
      field: e.field,
      id: e.$id,
      note: e.note,
    })),
    hints: parseApproverHints(expense.approver_hints),
    id: expense.$id,
    ledgerTransactionId:
      expense.ledger_transaction_id &&
      expense.ledger_transaction_id !== POSTING_MARKER
        ? expense.ledger_transaction_id
        : null,
    occasion: expense.occasion ?? "",
    permissions,
    presidentFallback:
      expense.campus !== NATIONAL_CAMPUS_ID &&
      parts.approvals.some((a) => a.approver_role === "national"),
    receipts,
    reference: reimbursementNumber(expense.$sequence),
    status: expense.status,
    steps: parts.approvals.map((a) => ({
      approverEmail: a.approver_email,
      decidedAt: a.decided_at,
      decidedBy: a.decided_by,
      decidedByEmail: a.decided_by_email,
      id: a.$id,
      isCurrent: a.$id === permissions.currentStepId,
      onBehalf: a.on_behalf === true,
      reason: a.reason,
      role: a.approver_role,
      status: a.status,
      step: a.step,
    })),
    submitter: {
      email: expense.user?.email ?? "",
      name: expense.user?.name ?? "",
    },
    switches: {
      controller: expense.submitter_is_controller,
      financialManager: expense.submitter_is_financial_manager,
    },
    total: expense.total,
  };
}
