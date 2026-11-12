import "server-only";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovalIssues,
  type ExpenseApprovals,
  type Expenses,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { parseApproverHints } from "@repo/shared/utils/expense-hints";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import {
  currentPendingStep,
  type ExpenseAccessStep,
  type ExpenseViewer,
  expenseVisibilityQueries,
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
const DIGITS_ONLY = /^\d+$/;
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

/** The `expense` list queries, or `null` when the result is provably empty. */
export function buildExpenseListQueries(
  viewer: ExpenseViewer,
  filters: ExpenseListFilters,
  ids: ExpenseListIds
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
      DIGITS_ONLY.test(filters.q)
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

  const queries = buildExpenseListQueries(viewer, filters, {
    approverExpenseIds: [...new Set(approverSteps.map((s) => s.expense_id))],
    issueExpenseIds,
    mineExpenseIds,
  });
  if (queries === null) {
    return emptyResult(filters);
  }

  const { rows, total } = await db.listRows<Expenses>(
    "app",
    "expense",
    queries
  );
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
