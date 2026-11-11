"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ExpenseCostTypes,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import { STARTING_EXPENSE_COST_TYPES } from "@repo/shared/utils/expense-cost-types";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { syncLedgerAccounts } from "@/lib/finago/ledger-accounts-sync";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "../../_actions/audit-log";
import {
  EXPENSE_ACCOUNT_MAX,
  EXPENSE_ACCOUNT_MIN,
  type ExpenseAccountOption,
  type ExpenseTypeInput,
  type ExpenseTypeView,
  expenseTypeInputSchema,
  slugFromLabel,
} from "./types-model";

const PAGE_PATH = "/expenses/settings";
const TYPES_TABLE = "expense_cost_types";
const LEDGER_ACCOUNTS_TABLE = "ledger_accounts";
const MAX_ROWS = 500;

export type ActionResult<T> = { data: T } | { error: string };

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireExpensesAdmin(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    throw new Error("Forbidden: only global admins can manage expense types");
  }
  return ctx;
}

function failure(error: unknown, fallback: string): { error: string } {
  if (isRedirectError(error)) {
    throw error;
  }
  return { error: error instanceof Error ? error.message : fallback };
}

function toView(
  row: ExpenseCostTypes,
  accountNames: Map<number, string | null>
): ExpenseTypeView {
  return {
    $id: row.$id,
    accountName: accountNames.get(row.account_number) ?? null,
    accountNumber: row.account_number,
    active: row.active !== false,
    askOccasion: row.ask_occasion === true,
    description: row.description ?? null,
    label: row.label,
    labelNo: row.label_no ?? null,
    slug: row.slug,
    sortOrder: row.sort_order ?? 0,
    taxCode: row.tax_code ?? null,
  };
}

async function readAccounts(db: AdminDb): Promise<LedgerAccounts[]> {
  const result = await db.listRows<LedgerAccounts>(
    "app",
    LEDGER_ACCOUNTS_TABLE,
    [
      Query.between("account_number", EXPENSE_ACCOUNT_MIN, EXPENSE_ACCOUNT_MAX),
      Query.orderAsc("account_number"),
      Query.limit(MAX_ROWS),
    ]
  );
  return result.rows.filter((row) => row.active !== false);
}

export async function getExpenseTypesView(): Promise<{
  accounts: ExpenseAccountOption[];
  tableEmpty: boolean;
  types: ExpenseTypeView[];
}> {
  await requireExpensesAdmin();
  const { db } = await createAdminClient();
  const [types, accounts] = await Promise.all([
    db.listRows<ExpenseCostTypes>("app", TYPES_TABLE, [
      Query.orderAsc("sort_order"),
      Query.limit(MAX_ROWS),
    ]),
    readAccounts(db),
  ]);
  const names = new Map(
    accounts.map((account) => [account.account_number, account.name])
  );
  return {
    accounts: accounts.map((account) => ({
      accountNumber: account.account_number,
      name: account.name ?? "",
      taxCode: account.tax_code ?? 0,
    })),
    tableEmpty: types.rows.length === 0,
    types: types.rows.map((row) => toView(row, names)),
  };
}

/** Creates (`id` null) or updates an expense type. Audited. */
export async function saveExpenseType(
  id: string | null,
  input: ExpenseTypeInput
): Promise<ActionResult<ExpenseTypeView>> {
  try {
    const ctx = await requireExpensesAdmin();
    const parsed = expenseTypeInputSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid type" };
    }
    const data = parsed.data;

    const { db } = await createAdminClient();
    const account = await db
      .getRow<LedgerAccounts>(
        "app",
        LEDGER_ACCOUNTS_TABLE,
        String(data.accountNumber)
      )
      .catch(() => null);
    if (!account || account.active === false) {
      return {
        error: `Account ${data.accountNumber} is not an active account. Sync accounts from Finago or pick another.`,
      };
    }

    const fields = {
      account_number: data.accountNumber,
      active: data.active,
      ask_occasion: data.askOccasion,
      description: data.description,
      label: data.label,
      label_no: data.labelNo,
      sort_order: data.sortOrder,
      tax_code: data.taxCode ?? account.tax_code ?? 0,
    };

    let row: ExpenseCostTypes;
    let rowId: string;
    if (id) {
      // The slug is the stable key other rows point at: never rewritten.
      rowId = id;
      row = await db.updateRow<ExpenseCostTypes>(
        "app",
        TYPES_TABLE,
        id,
        fields
      );
    } else {
      const existing = await db.listRows<ExpenseCostTypes>("app", TYPES_TABLE, [
        Query.select(["slug"]),
        Query.limit(MAX_ROWS),
      ]);
      rowId = slugFromLabel(
        data.label,
        new Set(existing.rows.map((existingRow) => existingRow.slug))
      );
      row = await db.createRow<ExpenseCostTypes>("app", TYPES_TABLE, rowId, {
        ...fields,
        campus_id: null,
        ocr_category: null,
        slug: rowId,
      });
    }

    await logAuditEvent(
      ctx,
      id ? "expense_type.update" : "expense_type.create",
      {
        payload: fields,
        resourceId: rowId,
        resourceType: TYPES_TABLE,
      }
    );
    revalidatePath(PAGE_PATH);
    return {
      data: toView(row, new Map([[account.account_number, account.name]])),
    };
  } catch (error) {
    return failure(error, "Failed to save expense type");
  }
}

/**
 * Creates the starting types whose slug has no row yet. Never overwrites a
 * row, so edits made on this page survive. Audited.
 */
export async function seedStartingExpenseTypes(): Promise<
  ActionResult<{ created: number; skipped: number }>
> {
  try {
    const ctx = await requireExpensesAdmin();
    const { db } = await createAdminClient();
    const existing = await db.listRows<ExpenseCostTypes>("app", TYPES_TABLE, [
      Query.select(["slug"]),
      Query.limit(MAX_ROWS),
    ]);
    const taken = new Set(existing.rows.map((row) => row.slug));

    let created = 0;
    let skipped = 0;
    for (const seed of STARTING_EXPENSE_COST_TYPES) {
      if (taken.has(seed.slug)) {
        skipped += 1;
        continue;
      }
      await db.createRow("app", TYPES_TABLE, seed.slug, {
        account_number: seed.accountNumber,
        active: seed.active,
        ask_occasion: seed.askOccasion,
        campus_id: null,
        description: seed.description ?? null,
        label: seed.label,
        label_no: seed.labelNo ?? null,
        ocr_category: null,
        slug: seed.slug,
        sort_order: seed.sortOrder,
        tax_code: seed.taxCode ?? null,
      });
      created += 1;
    }

    await logAuditEvent(ctx, "expense_type.seed", {
      payload: { created, skipped },
      resourceType: TYPES_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: { created, skipped } };
  } catch (error) {
    return failure(error, "Failed to load the starting list");
  }
}

/** Re-syncs the chart of accounts from Finago. Audited. */
export async function syncExpenseAccounts(): Promise<
  ActionResult<{ failed: number; succeeded: number; syncedAt: string }>
> {
  try {
    const ctx = await requireExpensesAdmin();
    const { db } = await createAdminClient();
    const result = await syncLedgerAccounts(db);

    await logAuditEvent(ctx, "ledger_accounts.sync", {
      payload: { failed: result.failed, succeeded: result.succeeded },
      resourceType: LEDGER_ACCOUNTS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return {
      data: {
        failed: result.failed,
        succeeded: result.succeeded,
        syncedAt: result.syncedAt,
      },
    };
  } catch (error) {
    return failure(error, "Failed to sync accounts from Finago");
  }
}
