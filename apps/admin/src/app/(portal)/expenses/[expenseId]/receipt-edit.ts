/**
 * Receipt editing: the pure half. Decides what a correction changes and what
 * the history says about it. Appwrite reads/writes live in `actions.ts`.
 */
import {
  type ExpenseAttachments,
  ExpenseAttachmentsAccountSource,
} from "@repo/api/types/appwrite";
import { osloDayOf } from "@/lib/oslo-day";
import {
  EXPENSE_ACCOUNT_MAX,
  EXPENSE_ACCOUNT_MIN,
} from "../settings/types-model";

export interface ReceiptChanges {
  accountNumber?: number;
  amount?: number;
  costType?: string;
  date?: string;
  description?: string;
}

export interface ExpenseTypeOption {
  accountNumber: number;
  label: string;
  labelNo: string | null;
  slug: string;
  taxCode: number | null;
}

export interface ReceiptEditContext {
  accounts: Map<number, { active: boolean; taxCode: number | null }>;
  source: "approver" | "admin";
  /** Today's Oslo day, `YYYY-MM-DD`. */
  today: string;
  /** Active types only. */
  types: ExpenseTypeOption[];
}

export interface ReceiptEditEvent {
  after: string | null;
  before: string | null;
  field: string;
}

export type ReceiptEditPlan =
  | { events: ReceiptEditEvent[]; patch: Partial<ExpenseAttachments> }
  | { error: string };

/** The `expense_attachments.description` column size. */
export const RECEIPT_DESCRIPTION_MAX = 255;
export const RECEIPT_MIN_DATE = "2000-01-01";
export const RECEIPT_MAX_AMOUNT = 1_000_000;
const CENTS = 100;
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * CENTS) / CENTS;
}

/** The stored shape of a receipt day: midnight UTC, as Appwrite normalises a bare date. */
export function receiptDateValue(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function validDay(day: string, today: string): boolean {
  return (
    DAY_FORMAT.test(day) &&
    !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().startsWith(day) &&
    day >= RECEIPT_MIN_DATE &&
    day <= today
  );
}

function sameOrNull(value: string | null | undefined): string | null {
  return value ?? null;
}

interface Working {
  accountNumber: number | null;
  events: ReceiptEditEvent[];
  patch: Partial<ExpenseAttachments>;
}

function applyCostType(
  current: ExpenseAttachments,
  slug: string,
  ctx: ReceiptEditContext,
  work: Working
): string | null {
  const type = ctx.types.find((t) => t.slug === slug);
  if (!type) {
    return "That expense type is not available";
  }
  if (current.cost_type !== slug || current.cost_type_text) {
    work.events.push({
      after: slug,
      before:
        current.cost_type ??
        (current.cost_type_text ? `"${current.cost_type_text}"` : null),
      field: "cost_type",
    });
  }
  work.patch.cost_type = slug;
  work.patch.cost_type_text = null;
  work.patch.account_number = type.accountNumber;
  work.patch.tax_code = type.taxCode;
  work.patch.account_source =
    ExpenseAttachmentsAccountSource[
      ctx.source === "admin" ? "ADMIN" : "APPROVER"
    ];
  work.accountNumber = type.accountNumber;
  return null;
}

function applyAccount(
  accountNumber: number,
  ctx: ReceiptEditContext,
  work: Working
): string | null {
  const account = ctx.accounts.get(accountNumber);
  const inRange =
    Number.isInteger(accountNumber) &&
    accountNumber >= EXPENSE_ACCOUNT_MIN &&
    accountNumber <= EXPENSE_ACCOUNT_MAX;
  if (!(inRange && account?.active)) {
    return `Account ${accountNumber} is not an active expense account`;
  }
  if (accountNumber === work.accountNumber) {
    return null;
  }
  work.patch.account_number = accountNumber;
  work.patch.tax_code = account.taxCode ?? null;
  work.patch.account_source =
    ExpenseAttachmentsAccountSource[
      ctx.source === "admin" ? "ADMIN" : "APPROVER"
    ];
  work.accountNumber = accountNumber;
  return null;
}

function applyDate(
  current: ExpenseAttachments,
  day: string,
  ctx: ReceiptEditContext,
  work: Working
): string | null {
  if (!validDay(day, ctx.today)) {
    return `The date must be between ${RECEIPT_MIN_DATE} and today`;
  }
  const before = osloDayOf(current.date);
  if (before !== day) {
    work.patch.date = receiptDateValue(day);
    work.events.push({ after: day, before, field: "date" });
  }
  return null;
}

function applyDescription(
  current: ExpenseAttachments,
  raw: string,
  work: Working
): string | null {
  const text = raw.trim();
  if (text.length < 1 || text.length > RECEIPT_DESCRIPTION_MAX) {
    return `The description must be 1 to ${RECEIPT_DESCRIPTION_MAX} characters`;
  }
  if (text !== (current.description ?? "")) {
    work.patch.description = text;
    work.events.push({
      after: text,
      before: sameOrNull(current.description),
      field: "description",
    });
  }
  return null;
}

function applyAmount(
  current: ExpenseAttachments,
  raw: number,
  work: Working
): string | null {
  if (!Number.isFinite(raw) || raw <= 0 || raw > RECEIPT_MAX_AMOUNT) {
    return `The amount must be above 0 and at most ${RECEIPT_MAX_AMOUNT}`;
  }
  const amount = round2(raw);
  if (amount <= 0) {
    return "The amount must be at least 0.01";
  }
  if (amount !== current.amount) {
    work.patch.amount = amount;
    work.events.push({
      after: String(amount),
      before: current.amount === null ? null : String(current.amount),
      field: "amount",
    });
  }
  return null;
}

/** Plans one receipt correction. Only fields that actually change are patched and logged. */
export function planReceiptEdit(
  current: ExpenseAttachments,
  changes: ReceiptChanges,
  ctx: ReceiptEditContext
): ReceiptEditPlan {
  const isSupporting = (current.amount ?? 0) <= 0;
  if (
    isSupporting &&
    (changes.amount !== undefined ||
      changes.costType !== undefined ||
      changes.accountNumber !== undefined)
  ) {
    return {
      error: "A supporting statement only has a date and a description",
    };
  }

  const work: Working = {
    accountNumber: current.account_number,
    events: [],
    patch: {},
  };
  const steps: (string | null)[] = [];
  if (changes.costType !== undefined) {
    steps.push(applyCostType(current, changes.costType, ctx, work));
  }
  if (changes.accountNumber !== undefined) {
    // After the type, so an explicit account wins over the type's.
    steps.push(applyAccount(changes.accountNumber, ctx, work));
  }
  if (changes.date !== undefined) {
    steps.push(applyDate(current, changes.date, ctx, work));
  }
  if (changes.description !== undefined) {
    steps.push(applyDescription(current, changes.description, work));
  }
  if (changes.amount !== undefined) {
    steps.push(applyAmount(current, changes.amount, work));
  }
  const error = steps.find((step) => step !== null);
  if (error) {
    return { error };
  }

  const events = [...work.events];
  if (work.accountNumber !== current.account_number) {
    // Keep the type event first, then the account it brought.
    const at = events.findIndex((e) => e.field === "cost_type");
    events.splice(at + 1, 0, {
      after: work.accountNumber === null ? null : String(work.accountNumber),
      before:
        current.account_number === null ? null : String(current.account_number),
      field: "account_number",
    });
  }
  return { events, patch: work.patch };
}
