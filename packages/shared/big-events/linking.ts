import "server-only";

import { type Models, Query } from "@repo/api";
import { BIG_EVENT_TABLES, type LinkMethod } from "./tables";
import type { BigEventParticipantRow } from "./types";

/** The slice of the Appwrite tables client linking needs (admin or web). */
export interface LinkingDb {
  listRows<T extends Models.Row>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: T[] }>;
  updateRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    data?: Record<string, unknown>
  ): Promise<unknown>;
}

/** Why a ticket can't be linked to an account (spec D4). */
export type LinkRefusal =
  | "not_bi_linked"
  | "linked_to_other"
  | "account_has_ticket";

export type LinkResult = { ok: true } | { ok: false; reason: LinkRefusal };

interface AccountRow extends Models.Row {
  email: string | null;
  student_id: string | null;
}

const DATABASE_ID = "app";
const USER_TABLE = "user";
/** Appwrite accepts at most 100 values in one `Query.equal`. */
const EMAIL_CHUNK = 100;

/** An account is BI-linked when BI sign-in wrote its student number. */
function isBiLinked(account: Pick<AccountRow, "student_id"> | undefined) {
  return Boolean(account?.student_id?.trim());
}

/**
 * BI-linked accounts by email: lowercased email → user id. Accounts without a
 * student number are left out, so a ticket is never linked to a Gmail-only
 * account that would hide it from the student's real BI account.
 */
export async function findBiLinkedAccountsByEmail(
  db: LinkingDb,
  emails: string[]
): Promise<Map<string, string>> {
  const wanted = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    ),
  ];
  const found = new Map<string, string>();
  for (let start = 0; start < wanted.length; start += EMAIL_CHUNK) {
    const chunk = wanted.slice(start, start + EMAIL_CHUNK);
    const { rows } = await db.listRows<AccountRow>(DATABASE_ID, USER_TABLE, [
      Query.equal("email", chunk),
      Query.select(["$id", "email", "student_id"]),
      Query.limit(EMAIL_CHUNK),
    ]);
    for (const account of rows) {
      const email = account.email?.trim().toLowerCase();
      if (email && isBiLinked(account) && !found.has(email)) {
        found.set(email, account.$id);
      }
    }
  }
  return found;
}

async function findAccount(
  db: LinkingDb,
  userId: string
): Promise<AccountRow | undefined> {
  const { rows } = await db.listRows<AccountRow>(DATABASE_ID, USER_TABLE, [
    Query.equal("$id", [userId]),
    Query.select(["$id", "student_id"]),
    Query.limit(1),
  ]);
  return rows[0];
}

/** Whether another participant of the same big event already holds this account. */
async function accountHasOtherTicket(
  db: LinkingDb,
  participant: BigEventParticipantRow,
  userId: string
): Promise<boolean> {
  const { rows } = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    BIG_EVENT_TABLES.participants,
    [
      Query.equal("big_event_id", [participant.big_event_id]),
      Query.equal("user_id", [userId]),
      Query.select(["$id"]),
      Query.limit(2),
    ]
  );
  return rows.some((row) => row.$id !== participant.$id);
}

/**
 * Links a participant to an account (spec D4). Refused when the ticket is
 * linked to someone else, when the account isn't BI-linked, or when the
 * account already holds another ticket in the same big event. Linking the
 * account a ticket already has is fine. Callers pass a freshly read row.
 */
export async function linkParticipant(
  db: LinkingDb,
  input: {
    method: LinkMethod;
    now?: Date;
    participant: BigEventParticipantRow;
    userId: string;
  }
): Promise<LinkResult> {
  const { participant, userId } = input;
  if (participant.user_id === userId) {
    return { ok: true };
  }
  if (participant.user_id) {
    return { ok: false, reason: "linked_to_other" };
  }
  if (!isBiLinked(await findAccount(db, userId))) {
    return { ok: false, reason: "not_bi_linked" };
  }
  if (await accountHasOtherTicket(db, participant, userId)) {
    return { ok: false, reason: "account_has_ticket" };
  }
  await db.updateRow(
    DATABASE_ID,
    BIG_EVENT_TABLES.participants,
    participant.$id,
    {
      link_method: input.method,
      linked_at: (input.now ?? new Date()).toISOString(),
      suggested_reason: null,
      suggested_user_id: null,
      user_id: userId,
    }
  );
  return { ok: true };
}

/** Removes the link; the old account's membership check no longer applies. */
export async function unlinkParticipant(
  db: LinkingDb,
  participantId: string
): Promise<void> {
  await db.updateRow(
    DATABASE_ID,
    BIG_EVENT_TABLES.participants,
    participantId,
    {
      link_method: null,
      linked_at: null,
      membership_checked_at: null,
      membership_valid: null,
      user_id: null,
    }
  );
}
