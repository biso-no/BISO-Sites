/**
 * Finago REST API — General Ledger Transactions
 *
 * POST /transactions is a new endpoint not yet in the generated schema.d.ts.
 * Types are defined manually here based on the published API spec.
 */

import { getAccessToken } from "./auth";
import { finago } from "./client";
import { DEPARTMENT_DIMENSION_TYPE } from "./departments";
import type { components } from "./schema";

const BASE_URL = "https://rest.api.24sevenoffice.com/v1";

const COMMENT_MAX_LENGTH = 75;
const CENTS = 100;

/**
 * Campus to 24SevenOffice DepartmentId mapping for webshop general-ledger
 * transactions. This is a distinct legacy department scheme from the one
 * membership invoices use (`CAMPUS_INVOICE_DEPARTMENT_IDS` in
 * `@repo/shared/utils/finago-membership-invoice`) and is unrelated to
 * membership purchases, so it is kept local rather than imported — this
 * package cannot depend on `@repo/shared` (workspace cycle).
 */
const SHOP_CAMPUS_DEPARTMENT_IDS: Record<string, number> = {
  "1": 2, // Oslo
  "2": 301, // Bergen
  "3": 601, // Trondheim
  "4": 801, // Stavanger
  "5": 1002, // National
};

interface TransactionLine {
  accountNumber: number;
  amount: number; // positive = debit, negative = credit
  comment?: string;
  dimensions?: Array<{ type: number; value: string }>;
  tax: { number: number };
}

interface PostTransactionRequest {
  comment?: string; // max 75 chars
  date: string; // ISO 8601 date (YYYY-MM-DD)
  lines: TransactionLine[];
  transactionTypeNumber: number;
}

interface PostTransactionResponse {
  transactionId: string;
}

export interface ShopTransactionParams {
  campusId?: string | null;
  comment?: string;
  date: string;
  items: Array<{
    unit_price: number;
    quantity: number;
    finago_account_number?: number | null;
  }>;
  orderId: string;
  total: number;
}

async function postTransaction(
  request: PostTransactionRequest
): Promise<PostTransactionResponse> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `[Finago] POST /transactions failed: ${response.status} ${body}`
    );
  }

  return response.json() as Promise<PostTransactionResponse>;
}

export async function postShopTransaction(
  params: ShopTransactionParams
): Promise<string> {
  const transactionTypeNumber = Number(
    process.env.TFSO_SHOP_TRANSACTION_TYPE_NUMBER
  );
  const vippsReceivableAccount = Number(
    process.env.TFSO_VIPPS_RECEIVABLE_ACCOUNT
  );

  if (!(transactionTypeNumber && vippsReceivableAccount)) {
    throw new Error(
      "[Finago] TFSO_SHOP_TRANSACTION_TYPE_NUMBER and TFSO_VIPPS_RECEIVABLE_ACCOUNT must be set"
    );
  }

  const departmentId = params.campusId
    ? SHOP_CAMPUS_DEPARTMENT_IDS[params.campusId]
    : undefined;

  const departmentDimension: TransactionLine["dimensions"] = departmentId
    ? [{ type: DEPARTMENT_DIMENSION_TYPE, value: String(departmentId) }]
    : undefined;

  // Debit: Vipps receivables (total amount, positive)
  const debitLine: TransactionLine = {
    accountNumber: vippsReceivableAccount,
    amount: params.total,
    tax: { number: 0 },
    comment: `Order ${params.orderId}`.slice(0, 75),
    dimensions: departmentDimension,
  };

  // Credit: Revenue accounts per product, grouped by account number (negative)
  const accountTotals = new Map<number, number>();
  for (const item of params.items) {
    if (!item.finago_account_number) {
      console.warn(
        "[Finago] Item has no finago_account_number, skipping revenue line"
      );
      continue;
    }
    const lineAmount = item.unit_price * item.quantity;
    accountTotals.set(
      item.finago_account_number,
      (accountTotals.get(item.finago_account_number) ?? 0) + lineAmount
    );
  }

  if (accountTotals.size === 0) {
    throw new Error(
      `[Finago] No items with finago_account_number for order ${params.orderId} — skipping transaction`
    );
  }

  const creditLines: TransactionLine[] = Array.from(
    accountTotals.entries()
  ).map(([accountNumber, amount]) => ({
    accountNumber,
    amount: -amount, // credit
    tax: { number: 0 },
    dimensions: departmentDimension,
  }));

  const result = await postTransaction({
    transactionTypeNumber,
    date: params.date,
    comment: (params.comment ?? `Shop order ${params.orderId}`).slice(0, 75),
    lines: [debitLine, ...creditLines],
  });

  return result.transactionId;
}

export interface ShopRefundTransactionParams {
  /** Minor units (øre) per revenue account, as allocated by the refund. */
  allocation: Array<{ accountNumber: number; amountMinor: number }>;
  /** Total refunded, in NOK. */
  amount: number;
  campusId?: string | null;
  comment?: string;
  date: string;
  orderId: string;
}

/**
 * Posts the compensating transaction for a refunded shop order: the exact
 * mirror of `postShopTransaction`, with every sign flipped.
 *
 * The original booking debits the receivable account and credits each product's
 * revenue account. A refund gives the money back, so the receivable is credited
 * and the revenue accounts are debited. The allocation is computed upstream (by
 * `allocateAmountAcrossAccounts`) and already sums to the refunded amount, so
 * the lines here balance to zero without further rounding.
 */
/**
 * Pure builder for the refund reversal, split out so the line construction and
 * its balance invariant are testable without a network call.
 */
export function buildShopRefundTransactionInput(
  params: ShopRefundTransactionParams & {
    receivableAccountNumber: number;
    transactionTypeNumber: number;
  }
): PostTransactionRequest {
  if (params.allocation.length === 0) {
    throw new Error(
      `[Finago] No revenue accounts resolved for refund on order ${params.orderId}`
    );
  }

  // The allocation must account for every krone refunded. A refunded product
  // with no `finago_account_number` drops out of the allocation, and crediting
  // receivables by the (smaller) allocation sum would post a transaction that
  // balances perfectly while understating the cash actually returned — a
  // silently wrong ledger. Fail instead: the refund itself still stands, and
  // the caller records the ledger failure for manual posting.
  const allocatedMinor = params.allocation.reduce(
    (sum, entry) => sum + entry.amountMinor,
    0
  );
  const refundedMinor = Math.round(params.amount * CENTS);
  if (allocatedMinor !== refundedMinor) {
    throw new Error(
      `[Finago] Refund allocation for order ${params.orderId} covers ${allocatedMinor} of ${refundedMinor} øre — refusing to post a partial reversal. Check that every refunded product has a finago_account_number.`
    );
  }

  const departmentId = params.campusId
    ? SHOP_CAMPUS_DEPARTMENT_IDS[params.campusId]
    : undefined;
  const departmentDimension: TransactionLine["dimensions"] = departmentId
    ? [{ type: DEPARTMENT_DIMENSION_TYPE, value: String(departmentId) }]
    : undefined;

  // Debit each revenue account back by its refunded share (positive).
  const debitLines: TransactionLine[] = params.allocation.map((entry) => ({
    accountNumber: entry.accountNumber,
    amount: entry.amountMinor / CENTS,
    tax: { number: 0 },
    dimensions: departmentDimension,
  }));

  // Credit the receivable account by the same total (negative). Summing the
  // debit lines rather than trusting `params.amount` is what guarantees the
  // transaction balances to zero: the allocation is the rounded truth.
  const total = debitLines.reduce((sum, line) => sum + line.amount, 0);
  const creditLine: TransactionLine = {
    accountNumber: params.receivableAccountNumber,
    amount: -total,
    tax: { number: 0 },
    comment: `Refund ${params.orderId}`.slice(0, COMMENT_MAX_LENGTH),
    dimensions: departmentDimension,
  };

  return {
    transactionTypeNumber: params.transactionTypeNumber,
    date: params.date,
    comment: (params.comment ?? `Refund order ${params.orderId}`).slice(
      0,
      COMMENT_MAX_LENGTH
    ),
    lines: [...debitLines, creditLine],
  };
}

export async function postShopRefundTransaction(
  params: ShopRefundTransactionParams
): Promise<string> {
  const transactionTypeNumber = Number(
    process.env.TFSO_SHOP_TRANSACTION_TYPE_NUMBER
  );
  const vippsReceivableAccount = Number(
    process.env.TFSO_VIPPS_RECEIVABLE_ACCOUNT
  );

  if (!(transactionTypeNumber && vippsReceivableAccount)) {
    throw new Error(
      "[Finago] TFSO_SHOP_TRANSACTION_TYPE_NUMBER and TFSO_VIPPS_RECEIVABLE_ACCOUNT must be set"
    );
  }

  const result = await postTransaction(
    buildShopRefundTransactionInput({
      ...params,
      receivableAccountNumber: vippsReceivableAccount,
      transactionTypeNumber,
    })
  );

  return result.transactionId;
}

// ---------------------------------------------------------------------------
// Expense / reimbursement transactions
// ---------------------------------------------------------------------------

type TransactionInputT = components["schemas"]["TransactionInput"];
type TransactionLineT = components["schemas"]["TransactionLine"];
type DimensionT = NonNullable<TransactionLineT["dimensions"]>[number];

function round2(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

/** A single receipt to debit to its resolved cost account. */
export interface ExpenseReceiptLine {
  accountNumber: number;
  /** Positive gross amount in NOK. */
  amount: number;
  comment?: string;
  /** Tax code number (see GET /taxes); defaults to 0 (no tax). */
  taxCode?: number;
}

export interface BuildExpenseTransactionParams {
  /** Recipient bank account used for the bank payout. */
  bankAccount: string;
  comment?: string;
  date: string;
  /** Dimensions (department + campus) applied to every line. */
  dimensions?: DimensionT[];
  documentId?: number;
  dueDate?: string;
  invoiceNumber?: string;
  receipts: ExpenseReceiptLine[];
  /** Supplier-debt account credited for the total owed (e.g. 2400). */
  supplierAccountNumber: number;
  transactionTypeNumber: number;
}

/**
 * Pure builder for a reimbursement transaction: each receipt is a debit on its
 * cost account, and a single credit to the supplier-debt account carries the
 * recipient bank account for payout. Lines always balance to zero.
 */
export function buildExpenseTransactionInput(
  params: BuildExpenseTransactionParams
): TransactionInputT {
  if (params.receipts.length === 0) {
    throw new Error(
      "[Finago] expense transaction requires at least one receipt"
    );
  }

  const dimensions =
    params.dimensions && params.dimensions.length > 0
      ? params.dimensions
      : undefined;

  const debitLines: TransactionLineT[] = params.receipts.map((receipt) => ({
    accountNumber: receipt.accountNumber,
    amount: round2(receipt.amount),
    tax: { number: receipt.taxCode ?? 0 },
    comment: receipt.comment?.slice(0, COMMENT_MAX_LENGTH),
    dimensions,
  }));

  const total = round2(debitLines.reduce((sum, line) => sum + line.amount, 0));

  const creditLine: TransactionLineT = {
    accountNumber: params.supplierAccountNumber,
    amount: -total,
    tax: { number: 0 },
    dimensions,
    invoice: {
      bankAccount: params.bankAccount,
      dueDate: params.dueDate,
      number: params.invoiceNumber,
    },
  };

  return {
    transactionTypeNumber: params.transactionTypeNumber,
    date: params.date,
    comment: params.comment?.slice(0, COMMENT_MAX_LENGTH),
    documentId: params.documentId,
    lines: [...debitLines, creditLine],
  };
}

export interface PostExpenseTransactionParams {
  bankAccount: string;
  /** Campus id ("1".."5") for the campus dimension. */
  campusId?: string | null;
  comment?: string;
  date: string;
  /** The department's 24SevenOffice dimension value (departments.Id). */
  departmentDimensionValue?: string | null;
  documentId?: number;
  dueDate?: string;
  invoiceNumber?: string;
  receipts: ExpenseReceiptLine[];
}

/**
 * Resolves the department + campus dimensions. Dimension type ids are
 * env-overridable because they are tenant-specific (verify against GET
 * /dimensions): department defaults to DEPARTMENT_DIMENSION_TYPE; the campus
 * dimension is only added when TFSO_CAMPUS_DIMENSION_TYPE is set.
 */
function buildExpenseDimensions(
  campusId: string | null | undefined,
  departmentDimensionValue: string | null | undefined
): DimensionT[] {
  const dimensions: DimensionT[] = [];

  const departmentType =
    Number(process.env.TFSO_DEPARTMENT_DIMENSION_TYPE) ||
    DEPARTMENT_DIMENSION_TYPE;
  if (departmentDimensionValue) {
    dimensions.push({
      dimensionType: departmentType,
      value: String(departmentDimensionValue),
    });
  }

  const campusType = Number(process.env.TFSO_CAMPUS_DIMENSION_TYPE);
  if (campusType && campusId) {
    dimensions.push({ dimensionType: campusType, value: String(campusId) });
  }

  return dimensions;
}

/**
 * Posts a reimbursement to the general ledger and returns the transaction id.
 * Reads `TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER` and `TFSO_SUPPLIER_DEBT_ACCOUNT`.
 */
export async function postExpenseTransaction(
  params: PostExpenseTransactionParams
): Promise<string> {
  const transactionTypeNumber = Number(
    process.env.TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER
  );
  const supplierAccountNumber = Number(process.env.TFSO_SUPPLIER_DEBT_ACCOUNT);

  if (!(transactionTypeNumber && supplierAccountNumber)) {
    throw new Error(
      "[Finago] TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER and TFSO_SUPPLIER_DEBT_ACCOUNT must be set"
    );
  }

  const input = buildExpenseTransactionInput({
    transactionTypeNumber,
    supplierAccountNumber,
    date: params.date,
    comment: params.comment,
    documentId: params.documentId,
    bankAccount: params.bankAccount,
    dueDate: params.dueDate,
    invoiceNumber: params.invoiceNumber,
    receipts: params.receipts,
    dimensions: buildExpenseDimensions(
      params.campusId,
      params.departmentDimensionValue
    ),
  });

  const { data, error } = await finago.POST("/transactions", {
    body: input,
    params: { header: { Authorization: "" } },
  });

  if (error || !data) {
    throw new Error(
      `[Finago] post expense transaction failed: ${JSON.stringify(error)}`
    );
  }

  return data.transactionId;
}
