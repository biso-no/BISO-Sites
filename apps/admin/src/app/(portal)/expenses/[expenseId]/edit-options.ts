import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  ExpenseCostTypes,
  FinagoProjects,
  FinagoProjectUsage,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import { departmentCandidates } from "@repo/shared/utils/finago-projects";
import { todayInOslo } from "@/lib/oslo-day";
import {
  EXPENSE_ACCOUNT_MAX,
  EXPENSE_ACCOUNT_MIN,
} from "../settings/types-model";
import type { ExpenseTypeOption } from "./receipt-edit";

const MAX_ROWS = 500;
const MAX_PROJECTS = 5000;

export interface ProjectOption {
  name: string;
  projectId: string;
  /** One the receipt's department has used lately. */
  suggested: boolean;
}

const NORWEGIAN_TAIL = "æøå";

/** Lowercased, with æ ø å placed after z as in Norwegian (not by Unicode order, nor Bun's broken "nb" collator). */
function sortKey(name: string): string {
  return [...name.toLowerCase()]
    .map((ch) => {
      const at = NORWEGIAN_TAIL.indexOf(ch);
      return at === -1 ? ch : String.fromCharCode("z".charCodeAt(0) + 1 + at);
    })
    .join("");
}

const byName = (a: ProjectOption, b: ProjectOption) => {
  const [x, y] = [sortKey(a.name), sortKey(b.name)];
  if (x === y) {
    return 0;
  }
  return x < y ? -1 : 1;
};

/** Active projects: the department's candidates first, then all the others. */
export function projectOptions(input: {
  departmentId: string | null;
  projects: FinagoProjects[];
  today: string;
  usage: FinagoProjectUsage[];
}): ProjectOption[] {
  const active = input.projects.filter((project) => project.active);
  const suggested = new Set(
    input.departmentId
      ? departmentCandidates({
          departmentId: input.departmentId,
          projects: active,
          today: input.today,
          usage: input.usage,
        }).map((project) => project.project_id)
      : []
  );
  const options = active.map((project) => ({
    name: project.name,
    projectId: project.project_id,
    suggested: suggested.has(project.project_id),
  }));
  return [
    ...options.filter((option) => option.suggested).sort(byName),
    ...options.filter((option) => !option.suggested).sort(byName),
  ];
}

export interface EditAccountOption {
  accountNumber: number;
  name: string;
  taxCode: number | null;
}

/** The active types, expense accounts and projects a receipt can be corrected to. */
export async function loadReceiptEditOptions(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  departmentId: string | null
): Promise<{
  accounts: EditAccountOption[];
  projects: ProjectOption[];
  types: ExpenseTypeOption[];
}> {
  const [types, accounts, projects, usage] = await Promise.all([
    db.listRows<ExpenseCostTypes>("app", "expense_cost_types", [
      Query.equal("active", true),
      Query.orderAsc("sort_order"),
      Query.limit(MAX_ROWS),
    ]),
    db.listRows<LedgerAccounts>("app", "ledger_accounts", [
      Query.between("account_number", EXPENSE_ACCOUNT_MIN, EXPENSE_ACCOUNT_MAX),
      Query.orderAsc("account_number"),
      Query.limit(MAX_ROWS),
    ]),
    db.listRows<FinagoProjects>("app", "finago_projects", [
      Query.equal("active", true),
      Query.limit(MAX_PROJECTS),
    ]),
    departmentId
      ? db.listRows<FinagoProjectUsage>("app", "finago_project_usage", [
          Query.equal("department_id", departmentId),
          Query.limit(MAX_PROJECTS),
        ])
      : Promise.resolve({ rows: [] as FinagoProjectUsage[] }),
  ]);
  return {
    accounts: accounts.rows
      .filter((row) => row.active !== false)
      .map((row) => ({
        accountNumber: row.account_number,
        name: row.name ?? "",
        taxCode: row.tax_code ?? null,
      })),
    projects: projectOptions({
      departmentId,
      projects: projects.rows,
      today: todayInOslo(),
      usage: usage.rows,
    }),
    types: types.rows.map((row) => ({
      accountNumber: row.account_number,
      label: row.label,
      labelNo: row.label_no ?? null,
      slug: row.slug,
      taxCode: row.tax_code ?? null,
    })),
  };
}
