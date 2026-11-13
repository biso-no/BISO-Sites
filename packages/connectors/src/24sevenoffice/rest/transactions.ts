/**
 * Finago REST API — General Ledger Transactions
 *
 * Pure voucher builders (expense reimbursements, webshop sales and refunds)
 * plus `POST /transactions` transport through the typed client.
 */

import {
  closedPeriodDate,
  type DateShift,
  dayAfter,
  nextPeriodStart,
  periodContaining,
} from "./booking-dates";
import { finago } from "./client";
import { CUSTOMER_DIMENSION_TYPE } from "./customers";
import {
  CAMPUS_DIMENSION_TYPE,
  DEPARTMENT_DIMENSION_TYPE,
} from "./departments";
import type { FiscalPeriod } from "./fiscal-periods";
import type { components } from "./schema";

const COMMENT_MAX_LENGTH = 75;
const CENTS = 100;

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
  /** Receipt date (YYYY-MM-DD); falls back to the params `date`. */
  date?: string;
  /** Our attachment id. Never sent to Finago. */
  ref?: string;
  /** Tax code number (see GET /taxes); defaults to 0 (no tax). */
  taxCode?: number;
}

export interface BuildExpenseTransactionParams {
  /** Recipient bank account used for the bank payout. */
  bankAccount: string;
  comment?: string;
  /**
   * The Finago customer the reimbursement is paid to. Set on every
   * supplier-debt line, so the debt sits on that person's ledger.
   */
  customerId: number;
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
 * cost account, and one credit per distinct receipt date to the supplier-debt
 * account carries the recipient bank account for payout. Lines balance to zero
 * per date.
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

  // Finago balances per date, so sum each date in integer øre and credit it.
  const centsByDate = new Map<string, number>();
  const debitLines: TransactionLineT[] = params.receipts.map((receipt) => {
    const date = receipt.date ?? params.date;
    const amount = round2(receipt.amount);
    centsByDate.set(
      date,
      (centsByDate.get(date) ?? 0) + Math.round(amount * CENTS)
    );
    return {
      accountNumber: receipt.accountNumber,
      amount,
      date,
      tax: { number: receipt.taxCode ?? 0 },
      comment: receipt.comment?.slice(0, COMMENT_MAX_LENGTH),
      dimensions,
    };
  });
  const dates = [...centsByDate.keys()].sort();

  const creditDimensions: DimensionT[] = [
    ...(dimensions ?? []),
    {
      dimensionType: CUSTOMER_DIMENSION_TYPE,
      value: String(params.customerId),
    },
  ];
  const creditLines: TransactionLineT[] = dates.map((date) => ({
    accountNumber: params.supplierAccountNumber,
    amount: -((centsByDate.get(date) ?? 0) / CENTS),
    date,
    tax: { number: 0 },
    dimensions: creditDimensions,
    invoice: {
      bankAccount: params.bankAccount,
      dueDate: params.dueDate,
      number: params.invoiceNumber,
    },
  }));

  return {
    transactionTypeNumber: params.transactionTypeNumber,
    date: dates.at(-1) ?? params.date,
    comment: params.comment?.slice(0, COMMENT_MAX_LENGTH),
    documentId: params.documentId,
    lines: [...debitLines, ...creditLines],
  };
}

export interface PostExpenseTransactionParams {
  bankAccount: string;
  /** Campus id ("1".."5") for the campus dimension. */
  campusId?: string | null;
  comment?: string;
  /** The Finago customer the reimbursement is paid to. */
  customerId: number;
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

export interface PostedExpenseTransaction {
  shifts: DateShift[];
  transactionId: string;
}

const DEFAULT_MAX_SHIFTS = 12;

function isInPeriod(date: string, period: FiscalPeriod): boolean {
  return date >= period.startingDate && date <= period.endingDate;
}

/**
 * Where the lines in the period holding `named` should go, or null when no
 * line is in that period or the move would pass `latestAllowed`.
 */
function planClosedPeriodMove(input: {
  latestAllowed: string | null;
  named: string;
  periods: FiscalPeriod[];
  receipts: ExpenseReceiptLine[];
}): { period: FiscalPeriod; target: string } | null {
  const { named, periods, receipts, latestAllowed } = input;
  const period = periodContaining(named, periods);
  if (
    !receipts.some(
      (receipt) => receipt.date && isInPeriod(receipt.date, period)
    )
  ) {
    return null;
  }
  // Later of the next listed start and the day after the closed period, so a
  // multi-month period is skipped in one retry.
  const afterPeriod = dayAfter(period.endingDate);
  const listed = nextPeriodStart(named, periods);
  const target = listed > afterPeriod ? listed : afterPeriod;
  if (latestAllowed && target > latestAllowed) {
    return null;
  }
  return { period, target };
}

/**
 * Posts receipts; when Finago rejects the transaction because a period is
 * closed and the message names a date, moves every line in the period holding
 * that date to the next period start and posts again. Without a named date, or
 * when no line is in that period, the error is rethrown. Lines never move past
 * the end of the period holding `today` (when given). Never mutates the
 * caller's receipts.
 */
export async function postWithClosedPeriodFallback(input: {
  maxShifts?: number;
  periods: FiscalPeriod[];
  post: (receipts: ExpenseReceiptLine[]) => Promise<string>;
  receipts: ExpenseReceiptLine[];
  /** YYYY-MM-DD. When set, no line moves past the period holding it. */
  today?: string;
}): Promise<PostedExpenseTransaction> {
  const maxShifts = input.maxShifts ?? DEFAULT_MAX_SHIFTS;
  const latestAllowed = input.today
    ? periodContaining(input.today, input.periods).endingDate
    : null;
  const shifts: DateShift[] = [];
  let receipts = input.receipts;

  for (let attempt = 0; ; attempt++) {
    try {
      const transactionId = await input.post(receipts);
      return { transactionId, shifts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const named = attempt >= maxShifts ? null : closedPeriodDate(message);
      if (!named) {
        throw error;
      }
      const move = planClosedPeriodMove({
        named,
        receipts,
        periods: input.periods,
        latestAllowed,
      });
      if (!move) {
        throw error;
      }
      const { period, target } = move;
      console.warn(
        `[Finago] closed period, moving lines from ${period.startingDate}..${period.endingDate} to ${target}: ${message}`
      );
      receipts = receipts.map((receipt) => {
        const from = receipt.date;
        if (!(from && isInPeriod(from, period))) {
          return receipt;
        }
        shifts.push({
          ref: receipt.ref ?? null,
          from,
          to: target,
          reason: "closed_period",
          finagoMessage: message,
        });
        return { ...receipt, date: target };
      });
    }
  }
}

/**
 * Posts a reimbursement to the general ledger and returns the transaction id
 * plus any date shifts made to get past closed periods.
 * Reads `TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER` and `TFSO_SUPPLIER_DEBT_ACCOUNT`.
 */
export async function postExpenseTransaction(
  params: PostExpenseTransactionParams & {
    periods?: FiscalPeriod[];
    /** YYYY-MM-DD; no closed-period retry moves a line past this period. */
    today?: string;
  }
): Promise<PostedExpenseTransaction> {
  const transactionTypeNumber = Number(
    process.env.TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER
  );
  const supplierAccountNumber = Number(process.env.TFSO_SUPPLIER_DEBT_ACCOUNT);

  if (!(transactionTypeNumber && supplierAccountNumber)) {
    throw new Error(
      "[Finago] TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER and TFSO_SUPPLIER_DEBT_ACCOUNT must be set"
    );
  }

  const dimensions = buildExpenseDimensions(
    params.campusId,
    params.departmentDimensionValue
  );

  return await postWithClosedPeriodFallback({
    receipts: params.receipts,
    periods: params.periods ?? [],
    today: params.today,
    post: async (receipts) => {
      const input = buildExpenseTransactionInput({
        transactionTypeNumber,
        supplierAccountNumber,
        date: params.date,
        comment: params.comment,
        customerId: params.customerId,
        documentId: params.documentId,
        bankAccount: params.bankAccount,
        dueDate: params.dueDate,
        invoiceNumber: params.invoiceNumber,
        receipts,
        dimensions,
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
    },
  });
}

// ---------------------------------------------------------------------------
// Webshop vouchers (Inntektsrapport)
// ---------------------------------------------------------------------------

export type ShopTransactionInput = TransactionInputT;

/** One revenue line of a webshop voucher. */
export interface ShopLedgerLine {
  accountNumber: number;
  /** Positive NOK, VAT-inclusive. */
  amount: number;
  comment?: string;
  /** The Finago department dimension value (`departments.Id`). */
  departmentId: string;
  /** Finago posting tax number, e.g. 3 (output VAT 25 %) or 5 (exempt). */
  vatCode: number;
}

export interface BuildShopTransactionParams {
  campusId?: string | null;
  /** The payment provider's clearing account, e.g. 1530 (Vipps). */
  clearingAccount: number;
  comment: string;
  date: string;
  lines: ShopLedgerLine[];
  /** Positive NOK the revenue lines must add up to exactly. */
  total: number;
  transactionTypeNumber: number;
}

function shopDimensions(
  departmentId: string,
  campusId: string | null | undefined
): DimensionT[] | undefined {
  const dimensions: DimensionT[] = [];
  if (departmentId) {
    dimensions.push({
      dimensionType: DEPARTMENT_DIMENSION_TYPE,
      value: departmentId,
    });
  }
  if (campusId) {
    dimensions.push({
      dimensionType: CAMPUS_DIMENSION_TYPE,
      value: String(campusId),
    });
  }
  return dimensions.length > 0 ? dimensions : undefined;
}

function assertShopLinesCoverTotal(params: BuildShopTransactionParams): void {
  if (params.lines.length === 0) {
    throw new Error("[Finago] A shop voucher needs at least one revenue line");
  }
  const linesMinor = params.lines.reduce(
    (sum, line) => sum + Math.round(line.amount * CENTS),
    0
  );
  const totalMinor = Math.round(params.total * CENTS);
  if (linesMinor !== totalMinor) {
    throw new Error(
      `[Finago] Shop lines cover ${linesMinor} of ${totalMinor} øre — refusing to post an unbalanced voucher`
    );
  }
}

function shopLines(
  params: BuildShopTransactionParams,
  sign: 1 | -1
): TransactionLineT[] {
  assertShopLinesCoverTotal(params);
  // Dimensions belong on revenue lines only; the clearing line carries none.
  const clearingLine: TransactionLineT = {
    accountNumber: params.clearingAccount,
    amount: sign * round2(params.total),
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    tax: { number: 0 },
  };
  const revenueLines: TransactionLineT[] = params.lines.map((line) => ({
    accountNumber: line.accountNumber,
    amount: -sign * round2(line.amount),
    comment: line.comment?.slice(0, COMMENT_MAX_LENGTH),
    dimensions: shopDimensions(line.departmentId, params.campusId),
    tax: { number: line.vatCode },
  }));
  return [clearingLine, ...revenueLines];
}

/**
 * A webshop sale: debit the provider's clearing account by the gross total,
 * credit each revenue line with its own VAT code. Finago books the VAT part of
 * a VAT-coded line to 2700. The payout voucher later credits the clearing
 * account by the gross amount and books the fee, so no fee line belongs here.
 */
export function buildShopTransactionInput(
  params: BuildShopTransactionParams
): ShopTransactionInput {
  return {
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    date: params.date,
    lines: shopLines(params, 1),
    transactionTypeNumber: params.transactionTypeNumber,
  };
}

/** A webshop refund: the exact mirror of `buildShopTransactionInput`. */
export function buildShopReversalTransactionInput(
  params: BuildShopTransactionParams
): ShopTransactionInput {
  return {
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    date: params.date,
    lines: shopLines(params, -1),
    transactionTypeNumber: params.transactionTypeNumber,
  };
}

/** Posts a prebuilt voucher to the general ledger and returns its id. */
export async function postLedgerTransaction(
  input: ShopTransactionInput
): Promise<string> {
  const { data, error } = await finago.POST("/transactions", {
    body: input,
    params: { header: { Authorization: "" } },
  });
  if (error || !data) {
    throw new Error(
      `[Finago] POST /transactions failed: ${JSON.stringify(error)}`
    );
  }
  return data.transactionId;
}
