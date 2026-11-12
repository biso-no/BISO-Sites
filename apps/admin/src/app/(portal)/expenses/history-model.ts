import { maskBankAccount } from "@/lib/expense-access";
import type { ExpenseDetailEvent } from "./expenses-data";

export interface DescribedEvent {
  /** Key under `adminPortal.expenses.history`. */
  key: string;
  values: Record<string, string>;
}

const EDITABLE_FIELDS = [
  "amount",
  "total",
  "account_number",
  "cost_type",
  "cost_type_text",
  "date",
  "description",
  "bank_account",
  "occasion",
  "approver_email",
] as const;

/** Localised words the notes are shown with; without them a note stays as stored. */
export interface HistoryLabels {
  /** The word before a reason, as in "Reason: Too high". */
  reason: string;
  /** Role labels keyed like `adminPortal.expenses.roles`. */
  roles: Record<string, string>;
}

/** The English phrases the api writes after "On behalf of", and the role each means. */
const ROLE_PHRASES: Record<string, string> = {
  "the campus controller": "controller",
  "the controller": "controller",
  "the general manager": "national",
  "the campus president": "president",
  "the deputy manager": "deputy",
  "the department manager": "manager",
  "the financial manager": "finance",
  "the national approver": "national",
};

const ON_BEHALF_NOTE = /^On behalf of (.+?)(?: · Reason: ([\s\S]*))?$/;
/** The ledger transaction id leads the note; a status-write warning may follow it. */
const TRANSACTION_ID = /^\S+/;
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

function localiseRole(role: string, labels?: HistoryLabels): string {
  const key = ROLE_PHRASES[role.trim().toLowerCase()];
  return (key && labels?.roles[key]) || role;
}

function describeDecision(
  base: "approved" | "rejected",
  note: string | null,
  labels?: HistoryLabels
): DescribedEvent {
  const parsed = parseDecisionNote(note);
  const reason =
    labels && parsed.reason
      ? `${labels.reason}: ${parsed.reason}`
      : parsed.reason;
  return parsed.role === null
    ? { key: base, values: { reason } }
    : {
        key: `${base}OnBehalf`,
        values: { reason, role: localiseRole(parsed.role, labels) },
      };
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
export function describeEvent(
  event: ExpenseDetailEvent,
  labels?: HistoryLabels
): DescribedEvent {
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
      return describeDecision("approved", event.note, labels);
    case "rejected":
      return describeDecision("rejected", event.note, labels);
    case "approver_resolved":
      // A person swapping the approver is an edit; the resolver's pick is not.
      return event.field === "approver_email" &&
        (event.actorKind === "admin" || event.actorKind === "approver")
        ? describeEdit(event)
        : { key: "approverResolved", values: { email: event.after ?? "" } };
    case "notified":
      return { key: "notified", values: { email: event.after ?? "" } };
    case "booked": {
      const id = TRANSACTION_ID.exec(event.note?.trim() ?? "")?.[0];
      return id
        ? { key: "booked", values: { id } }
        : { key: "bookedPlain", values: {} };
    }
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
