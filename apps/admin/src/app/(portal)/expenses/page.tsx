import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUserAuthContext } from "@/lib/authorization";
import {
  canOpenExpensesSection,
  type ExpenseViewer,
} from "@/lib/expense-access";
import { getExpenseViewer } from "@/lib/expense-viewer";
import { firstParam, type ListSearchParams } from "@/lib/list-params";
import { PageHeader } from "../_components/page-header";
import { ExpensesList, type FilterOption } from "./_components/expenses-list";
import {
  EXPENSE_LIST_STATUSES,
  type ExpenseListFilters,
  listExpenses,
  resolveExpenseListFilters,
} from "./expenses-data";

const OPTION_LIMIT = 200;

/** Approver-only mailboxes have nothing to browse; start on their queue. */
function defaultViewFor(viewer: ExpenseViewer): ExpenseListFilters["view"] {
  const browsesCampuses =
    viewer.isGlobalAdmin ||
    viewer.isCampusAdmin ||
    viewer.controllerCampusIds.length > 0;
  return browsesCampuses ? "all" : "mine";
}

/** Campuses the viewer can see expenses for; every campus for global admins. */
async function listCampusOptions(
  viewer: ExpenseViewer
): Promise<FilterOption[]> {
  const ids = [
    ...new Set([
      ...(viewer.isCampusAdmin ? viewer.managedCampusIds : []),
      ...viewer.controllerCampusIds,
    ]),
  ];
  if (!viewer.isGlobalAdmin && ids.length === 0) {
    return [];
  }
  const { db } = await createAdminClient();
  const { rows } = await db.listRows<Campus>("app", "campus", [
    ...(viewer.isGlobalAdmin ? [] : [Query.equal("$id", ids)]),
    Query.select(["$id", "name"]),
    Query.orderAsc("name"),
    Query.limit(OPTION_LIMIT),
  ]);
  return rows.map((row) => ({ label: row.name, value: row.$id }));
}

async function listDepartmentOptions(
  campusId: string | null
): Promise<FilterOption[]> {
  if (!campusId) {
    return [];
  }
  const { db } = await createAdminClient();
  const { rows } = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.select(["Id", "Name"]),
    Query.orderAsc("Name"),
    Query.limit(OPTION_LIMIT),
  ]);
  return rows.map((row) => ({ label: row.Name, value: row.Id }));
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const [viewer, ctx] = await Promise.all([
    getExpenseViewer(),
    getUserAuthContext(),
  ]);
  if (!(viewer && ctx && canOpenExpensesSection(viewer, ctx.roles))) {
    notFound();
  }

  const sp = await searchParams;
  const defaultView = defaultViewFor(viewer);
  const filters = resolveExpenseListFilters(sp);
  if (!firstParam(sp, "view")) {
    filters.view = defaultView;
  }

  const [t, result, campusOptions, departmentOptions] = await Promise.all([
    getTranslations("adminPortal.expenses"),
    listExpenses(viewer, filters),
    listCampusOptions(viewer),
    listDepartmentOptions(filters.campusId),
  ]);

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <ExpensesList
        campusOptions={campusOptions}
        defaultView={defaultView}
        departmentOptions={departmentOptions}
        filters={filters}
        rows={result.rows}
        statusOptions={EXPENSE_LIST_STATUSES}
        total={result.total}
      />
    </div>
  );
}
