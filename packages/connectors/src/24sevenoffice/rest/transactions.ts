/**
 * Finago REST API — General Ledger Transactions
 *
 * POST /transactions is a new endpoint not yet in the generated schema.d.ts.
 * Types are defined manually here based on the published API spec.
 */

import { CAMPUS_DEPARTMENT_IDS } from "../invoice";
import { getAccessToken } from "./auth";
import { DEPARTMENT_DIMENSION_TYPE } from "./departments";

const BASE_URL = "https://rest.api.24sevenoffice.com/v1";

type TransactionLine = {
  accountNumber: number;
  amount: number; // positive = debit, negative = credit
  tax: { number: number };
  comment?: string;
  dimensions?: Array<{ type: number; value: string }>;
};

type PostTransactionRequest = {
  transactionTypeNumber: number;
  date: string; // ISO 8601 date (YYYY-MM-DD)
  lines: TransactionLine[];
  comment?: string; // max 75 chars
};

type PostTransactionResponse = {
  transactionId: string;
};

export type ShopTransactionParams = {
  orderId: string;
  date: string;
  total: number;
  items: Array<{
    unit_price: number;
    quantity: number;
    finago_account_number?: number | null;
  }>;
  campusId?: string | null;
  comment?: string;
};

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
    ? CAMPUS_DEPARTMENT_IDS[params.campusId]
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
