// Best-effort writer for the `expense_events` history table. History is an
// audit aid: a failed write is logged and swallowed so it can never change the
// outcome of a booking.

import { ID } from "@repo/api";

export type ExpenseEventActorKind =
  | "student"
  | "approver"
  | "admin"
  | "ai"
  | "system";

export type ExpenseEventAction =
  | "submitted"
  | "ai_classified"
  | "ai_account_chosen"
  | "edited"
  | "approved"
  | "rejected"
  | "approver_resolved"
  | "notified"
  | "booked"
  | "booking_failed"
  | "date_shifted";

export interface ExpenseEventInput {
  action: ExpenseEventAction;
  actorEmail?: string | null;
  actorKind: ExpenseEventActorKind;
  actorName?: string | null;
  after?: string | null;
  attachmentId?: string | null;
  before?: string | null;
  expenseId: string;
  field?: string | null;
  note?: string | null;
}

export interface ExpenseEventsDb {
  createRow: (
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
}

const MAX_TEXT_CHARS = 2000;
const MAX_FIELD_CHARS = 64;
const MAX_ACTOR_NAME_CHARS = 256;
const MAX_ACTOR_EMAIL_CHARS = 320;
const ELLIPSIS = "...";

function truncate(value: string | null | undefined, max: number) {
  if (value == null) {
    return undefined;
  }
  return value.length > max
    ? `${value.slice(0, max - ELLIPSIS.length)}${ELLIPSIS}`
    : value;
}

export async function recordExpenseEvents(
  db: ExpenseEventsDb,
  events: ExpenseEventInput[]
): Promise<void> {
  for (const event of events) {
    try {
      await db.createRow("app", "expense_events", ID.unique(), {
        expense_id: event.expenseId,
        actor_kind: event.actorKind,
        action: event.action,
        actor_email: truncate(event.actorEmail, MAX_ACTOR_EMAIL_CHARS),
        actor_name: truncate(event.actorName, MAX_ACTOR_NAME_CHARS),
        attachment_id: event.attachmentId ?? undefined,
        field: truncate(event.field, MAX_FIELD_CHARS),
        before: truncate(event.before, MAX_TEXT_CHARS),
        after: truncate(event.after, MAX_TEXT_CHARS),
        note: truncate(event.note, MAX_TEXT_CHARS),
      });
    } catch (error) {
      console.error(
        `[expense-events] failed to record ${event.action} for expense ${event.expenseId}`,
        error
      );
    }
  }
}
