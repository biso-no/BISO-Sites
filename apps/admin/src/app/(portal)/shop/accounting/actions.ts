"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  FeatureFlags,
  LedgerAccounts,
  SalesTypes,
  ShopSettings,
} from "@repo/api/types/appwrite";
import { getFlagDef, mergeFlagStates } from "@repo/shared/utils/feature-flags";
import {
  SALES_TYPES_TABLE,
  SEED_SALES_TYPES,
  SHOP_ACCOUNTING_ROW_ID,
  SHOP_SETTINGS_TABLE,
  type ShopAccountingSettings,
  shopAccountingSettingsSchema,
} from "@repo/shared/utils/finago-shop-accounting";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { syncLedgerAccounts } from "@/lib/finago/ledger-accounts-sync";
import { canManageAccounting } from "@/lib/roles";
import { logAuditEvent } from "../../_actions/audit-log";
import {
  type LedgerAccountOption,
  revenueAccountOptions,
  SALES_TYPE_ID_RE,
  type SalesTypeInput,
  salesTypeIdFromLabel,
  salesTypeInputSchema,
  settingsOrDefault,
} from "./accounting-model";

const PAGE_PATH = "/shop/accounting";
const FEATURE_FLAGS_TABLE = "feature_flags";
const LEDGER_ACCOUNTS_TABLE = "ledger_accounts";
const POSTING_FLAG_KEY = "shop_ledger_posting";

export type ActionResult<T> = { data: T } | { error: string };

export interface SalesTypeView {
  $id: string;
  accountNumber: number;
  active: boolean;
  labelEn: string;
  labelNo: string;
  sortOrder: number;
}

export interface AccountingView {
  accounts: LedgerAccountOption[];
  lastSyncedAt: string | null;
  postingEnabled: boolean;
  salesTypes: SalesTypeView[];
  settings: ShopAccountingSettings;
  settingsSaved: boolean;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireAccountingAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!canManageAccounting(ctx.roles)) {
    throw new Error(
      "Forbidden: only global and campus admins can manage accounting settings"
    );
  }
  return ctx;
}

function toSalesTypeView(row: SalesTypes): SalesTypeView {
  return {
    $id: row.$id,
    accountNumber: row.account_number,
    active: row.active !== false,
    labelEn: row.label_en,
    labelNo: row.label_no,
    sortOrder: row.sort_order ?? 0,
  };
}

function failure(error: unknown, fallback: string): { error: string } {
  if (isRedirectError(error)) {
    throw error;
  }
  return { error: error instanceof Error ? error.message : fallback };
}

async function readPostingEnabled(db: AdminDb): Promise<boolean> {
  const result = await db.listRows<FeatureFlags>("app", FEATURE_FLAGS_TABLE, [
    Query.equal("key", POSTING_FLAG_KEY),
    Query.limit(1),
  ]);
  return mergeFlagStates(
    result.rows.map((row) => ({ enabled: row.enabled, key: row.key }))
  ).shop_ledger_posting;
}

async function readSettingsRow(db: AdminDb): Promise<ShopSettings | null> {
  return await db
    .getRow<ShopSettings>("app", SHOP_SETTINGS_TABLE, SHOP_ACCOUNTING_ROW_ID)
    .catch(() => null);
}

export async function getAccountingView(): Promise<AccountingView> {
  await requireAccountingAccess();
  const { db } = await createAdminClient();

  const [salesTypes, accounts, settingsRow, postingEnabled] = await Promise.all(
    [
      db.listRows<SalesTypes>("app", SALES_TYPES_TABLE, [
        Query.orderAsc("sort_order"),
        Query.limit(100),
      ]),
      db.listRows<LedgerAccounts>("app", LEDGER_ACCOUNTS_TABLE, [
        Query.orderAsc("account_number"),
        Query.limit(500),
      ]),
      readSettingsRow(db),
      readPostingEnabled(db),
    ]
  );

  const { saved, settings } = settingsOrDefault(settingsRow?.general);
  const lastSyncedAt =
    accounts.rows
      .map((row) => row.synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    accounts: revenueAccountOptions(accounts.rows),
    lastSyncedAt,
    postingEnabled,
    salesTypes: salesTypes.rows.map(toSalesTypeView),
    settings,
    settingsSaved: saved,
  };
}

/** Creates (`id` null) or updates a sales type. Audited. */
export async function saveSalesType(
  id: string | null,
  input: SalesTypeInput
): Promise<ActionResult<SalesTypeView>> {
  try {
    const ctx = await requireAccountingAccess();
    const parsed = salesTypeInputSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sales type" };
    }

    const { db } = await createAdminClient();
    const account = await db
      .getRow<LedgerAccounts>(
        "app",
        LEDGER_ACCOUNTS_TABLE,
        String(parsed.data.account_number)
      )
      .catch(() => null);
    if (!account) {
      return {
        error: `Account ${parsed.data.account_number} is not in the synced chart of accounts. Sync from Finago first.`,
      };
    }

    const rowId = id ?? salesTypeIdFromLabel(parsed.data.label_no);
    if (!SALES_TYPE_ID_RE.test(rowId)) {
      return { error: "Could not derive an id from the Norwegian label" };
    }
    if (!id) {
      const existing = await db
        .getRow<SalesTypes>("app", SALES_TYPES_TABLE, rowId)
        .catch(() => null);
      if (existing) {
        return {
          error: "A sales type with this Norwegian label already exists",
        };
      }
    }

    const row = await db.upsertRow<SalesTypes>(
      "app",
      SALES_TYPES_TABLE,
      rowId,
      parsed.data
    );

    await logAuditEvent(ctx, id ? "sales_type.update" : "sales_type.create", {
      payload: parsed.data,
      resourceId: rowId,
      resourceType: SALES_TYPES_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: toSalesTypeView(row) };
  } catch (error) {
    return failure(error, "Failed to save sales type");
  }
}

/** Creates the four approved sales types that do not exist yet. Audited. */
export async function seedDefaultSalesTypes(): Promise<
  ActionResult<{ created: number }>
> {
  try {
    const ctx = await requireAccountingAccess();
    const { db } = await createAdminClient();

    let created = 0;
    for (const seed of SEED_SALES_TYPES) {
      const existing = await db
        .getRow<SalesTypes>("app", SALES_TYPES_TABLE, seed.$id)
        .catch(() => null);
      if (existing) {
        continue;
      }
      await db.createRow("app", SALES_TYPES_TABLE, seed.$id, {
        account_number: seed.account_number,
        active: true,
        label_en: seed.label_en,
        label_no: seed.label_no,
        sort_order: seed.sort_order,
      });
      created += 1;
    }

    await logAuditEvent(ctx, "sales_type.seed", {
      payload: { created },
      resourceType: SALES_TYPES_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: { created } };
  } catch (error) {
    return failure(error, "Failed to create default sales types");
  }
}

/** Saves the voucher type and clearing accounts. Audited. */
export async function saveShopAccountingSettings(
  input: ShopAccountingSettings
): Promise<ActionResult<ShopAccountingSettings>> {
  try {
    const ctx = await requireAccountingAccess();
    const parsed = shopAccountingSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error:
          "Clearing accounts must be 4-digit account numbers and the voucher type a positive number",
      };
    }

    const { db } = await createAdminClient();
    await db.upsertRow<ShopSettings>(
      "app",
      SHOP_SETTINGS_TABLE,
      SHOP_ACCOUNTING_ROW_ID,
      { general: JSON.stringify(parsed.data) }
    );

    await logAuditEvent(ctx, "shop_accounting.update", {
      payload: parsed.data,
      resourceId: SHOP_ACCOUNTING_ROW_ID,
      resourceType: SHOP_SETTINGS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: parsed.data };
  } catch (error) {
    return failure(error, "Failed to save shop accounting settings");
  }
}

/**
 * Switches webshop ledger posting on or off. Switching on requires saved
 * settings and at least one active sales type, so the first sweep cannot
 * fail every order. Audited like the feature flags page.
 */
export async function setShopLedgerPosting(
  enabled: boolean
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const ctx = await requireAccountingAccess();
    const { db } = await createAdminClient();

    if (enabled) {
      const [settingsRow, activeTypes] = await Promise.all([
        readSettingsRow(db),
        db.listRows<SalesTypes>("app", SALES_TYPES_TABLE, [
          Query.equal("active", true),
          Query.limit(1),
        ]),
      ]);
      if (
        !settingsOrDefault(settingsRow?.general).saved ||
        activeTypes.rows.length === 0
      ) {
        return {
          error:
            "Save the posting settings and add at least one active sales type before switching posting on",
        };
      }
    }

    const existing = await db.listRows<FeatureFlags>(
      "app",
      FEATURE_FLAGS_TABLE,
      [Query.equal("key", POSTING_FLAG_KEY), Query.limit(1)]
    );
    const existingRow = existing.rows[0];
    const row = existingRow
      ? await db.updateRow<FeatureFlags>(
          "app",
          FEATURE_FLAGS_TABLE,
          existingRow.$id,
          { enabled }
        )
      : await db.createRow<FeatureFlags>(
          "app",
          FEATURE_FLAGS_TABLE,
          ID.unique(),
          {
            description: null,
            enabled,
            key: POSTING_FLAG_KEY,
            title: getFlagDef(POSTING_FLAG_KEY)?.title ?? POSTING_FLAG_KEY,
          }
        );

    await logAuditEvent(ctx, "feature_flag.toggle", {
      payload: { enabled, key: POSTING_FLAG_KEY },
      resourceId: row.$id,
      resourceType: FEATURE_FLAGS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    revalidatePath("/settings/feature-flags");
    return { data: { enabled: row.enabled } };
  } catch (error) {
    return failure(error, "Failed to switch ledger posting");
  }
}

/** Re-syncs the chart of accounts and VAT numbers from Finago. Audited. */
export async function syncLedgerAccountsFromFinago(): Promise<
  ActionResult<{ failed: number; succeeded: number; syncedAt: string }>
> {
  try {
    const ctx = await requireAccountingAccess();
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
