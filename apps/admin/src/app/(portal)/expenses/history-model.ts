import { maskBankAccount } from "@/lib/expense-access";
import type { ExpenseDetailEvent } from "./expenses-data";

export interface DescribedEvent {
  /** Key under `adminPortal.expenses.history`. */
  key: string;
  values: Record<string, string>;
}

const EDITABLE_FIELDS = [
  "amount",
  "account_number",
  "cost_type",
  "cost_type_text",
  "date",
  "description",
  "bank_account",
  "occasion",
  "approver_email",
] as const;

const ON_BEHALF_NOTE = /^On behalf of (.+?)(?: · Reason: ([\s\S]*))?$/;
const REASON_NOTE = /^Reason: ([\s\S]*)$/;

function parseDecisionNote(note: string | null): {
  reason: string;
  role: string | null;
} {
  const text = note?.trim() ?? "";
  const onBehalf = ON_BEHALF_NOTE.exec(text);
  if (onBehalf) {
    return { reason: onBehalf[2] ?? "", role: onBehalf[1] ?? null };
  }
  return { reason: REASON_NOTE.exec(text)?.[1] ?? "", role: null };
}

function describeDecision(
  base: "approved" | "rejected",
  note: string | null
): DescribedEvent {
  const { reason, role } = parseDecisionNote(note);
  return role === null
    ? { key: base, values: { reason } }
    : { key: `${base}OnBehalf`, values: { reason, role } };
}

function describeEdit(event: ExpenseDetailEvent): DescribedEvent {
  const field = event.field ?? "";
  const known = EDITABLE_FIELDS.find((f) => f === field);
  const show = (value: string | null) =>
    field === "bank_account" && value ? maskBankAccount(value) : (value ?? "");
  const values = { after: show(event.after), before: show(event.before) };
  return known
    ? { key: `edited.${known}`, values }
    : { key: "edited.other", values: { ...values, field } };
}

/** Maps one history row to an i18n key and the values to interpolate. */
export function describeEvent(event: ExpenseDetailEvent): DescribedEvent {
  switch (event.action) {
    case "submitted":
      return { key: "submitted", values: {} };
    case "ai_classified":
      return { key: "aiClassified", values: { type: event.after ?? "" } };
    case "ai_account_chosen":
      return { key: "aiAccountChosen", values: { account: event.after ?? "" } };
    case "edited":
      return describeEdit(event);
    case "approved":
      return describeDecision("approved", event.note);
    case "rejected":
      return describeDecision("rejected", event.note);
    case "approver_resolved":
      return { key: "approverResolved", values: { email: event.after ?? "" } };
    case "notified":
      return { key: "notified", values: { email: event.after ?? "" } };
    case "booked":
      return { key: "booked", values: { id: event.after ?? "" } };
    case "booking_failed":
      return { key: "bookingFailed", values: { note: event.note ?? "" } };
    case "date_shifted":
      return {
        key: "dateShifted",
        values: {
          from: event.before ?? "",
          note: event.note ?? "",
          to: event.after ?? "",
        },
      };
    case "booking_retried":
      return { key: "bookingRetried", values: {} };
    default:
      return { key: "unknown", values: { action: String(event.action) } };
  }
}
