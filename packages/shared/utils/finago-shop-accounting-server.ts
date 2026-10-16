/**
 * Webshop → Finago ledger posting: the loaders.
 *
 * Reads shop accounting settings, sales types and synced VAT codes from
 * Appwrite through whichever client the caller holds. A missing row (404)
 * answers `null` — "not configured yet" — which makes the poster release its
 * claim and the reconcile sweep retry. Any other read failure (outage,
 * timeout, 401) throws, so the caller reports an error rather than a
 * configuration gap; the poster still releases its claim on the way out.
 */
import { orNullIfNotFound } from "@repo/api/errors";
import type { WebshopProducts } from "@repo/api/types/appwrite";
import {
  LEDGER_ACCOUNTS_TABLE,
  parseShopAccountingSettings,
  type RevenueTarget,
  SALES_TYPES_TABLE,
  SHOP_ACCOUNTING_ROW_ID,
  SHOP_SETTINGS_TABLE,
  type ShopAccountingSettings,
  snapshotTarget,
} from "./finago-shop-accounting";
import type { ParsedOrderItem } from "./order-parsing";
import type { DbClient } from "./vipps-order-ops";

const DB_ID = "app";
const PRODUCTS_TABLE = "webshop_products";

export interface SalesTypeRow {
  $id: string;
  account_number: number;
  active?: boolean | null;
  label_en: string;
  label_no: string;
  sort_order?: number | null;
}

async function readRow<T>(
  db: DbClient,
  table: string,
  id: string
): Promise<T | null> {
  return (
    ((await orNullIfNotFound(db.getRow(DB_ID, table, id))) as T | null) ?? null
  );
}

export async function loadShopAccountingSettings(
  db: DbClient
): Promise<ShopAccountingSettings | null> {
  const row = await readRow<{ general?: string | null }>(
    db,
    SHOP_SETTINGS_TABLE,
    SHOP_ACCOUNTING_ROW_ID
  );
  return parseShopAccountingSettings(row?.general);
}

/** The posting tax number synced from Finago for a ledger account. */
export async function loadVatCodeForAccount(
  db: DbClient,
  accountNumber: number
): Promise<number | null> {
  const row = await readRow<{ vat_code?: number | null }>(
    db,
    LEDGER_ACCOUNTS_TABLE,
    String(accountNumber)
  );
  return typeof row?.vat_code === "number" ? row.vat_code : null;
}

/** Where a product's revenue is booked today, from its active sales type. */
export async function resolveRevenueTarget(
  db: DbClient,
  product: Pick<WebshopProducts, "departmentId" | "sales_type">
): Promise<RevenueTarget | null> {
  if (!(product.sales_type && product.departmentId)) {
    return null;
  }
  const salesType = await readRow<SalesTypeRow>(
    db,
    SALES_TYPES_TABLE,
    product.sales_type
  );
  if (
    !salesType ||
    salesType.active === false ||
    typeof salesType.account_number !== "number"
  ) {
    return null;
  }
  const vatCode = await loadVatCodeForAccount(db, salesType.account_number);
  if (vatCode === null) {
    return null;
  }
  return {
    accountNumber: salesType.account_number,
    departmentId: String(product.departmentId),
    vatCode,
  };
}

export async function resolveRevenueTargetForProduct(
  db: DbClient,
  productId: string
): Promise<RevenueTarget | null> {
  const product = await readRow<
    Pick<WebshopProducts, "departmentId" | "sales_type">
  >(db, PRODUCTS_TABLE, productId);
  if (!product) {
    return null;
  }
  return await resolveRevenueTarget(db, {
    departmentId: product.departmentId ?? null,
    sales_type: product.sales_type ?? null,
  });
}

/**
 * One target per order line: the checkout copy when the line has a complete
 * one, else the product's current sales type (orders placed before the copy
 * existed). Each product is read at most once.
 */
export async function resolveItemTargets(
  db: DbClient,
  items: ParsedOrderItem[]
): Promise<Array<RevenueTarget | null>> {
  const byProduct = new Map<string, RevenueTarget | null>();
  const targets: Array<RevenueTarget | null> = [];
  for (const item of items) {
    const snapshot = snapshotTarget(item);
    if (snapshot) {
      targets.push(snapshot);
      continue;
    }
    const productId = item.product_id;
    if (!productId) {
      targets.push(null);
      continue;
    }
    if (!byProduct.has(productId)) {
      byProduct.set(
        productId,
        await resolveRevenueTargetForProduct(db, productId)
      );
    }
    targets.push(byProduct.get(productId) ?? null);
  }
  return targets;
}

/** Whether this process can authenticate against the Finago REST API. */
export function hasFinagoRestCredentials(): boolean {
  return Boolean(
    process.env.TFSO_REST_CLIENT_ID &&
      process.env.TFSO_REST_CLIENT_SECRET &&
      process.env.TFSO_REST_ORG_ID
  );
}
