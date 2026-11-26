"use server";

import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import {
  type LinkRefusal,
  linkParticipant,
  unlinkParticipant,
} from "@repo/shared/big-events/linking";
import { normalizePhone, phoneVariants } from "@repo/shared/big-events/phone";
import {
  BIG_EVENT_TABLES,
  type SuggestionReason,
} from "@repo/shared/big-events/tables";
import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";
import { z } from "zod";
import { campusNameFor } from "@/lib/announcements/audience-names";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  canSeeParticipant,
  participantCampusFilter,
} from "@/lib/big-events/access";
import {
  type AdminDb,
  type GrantedAccess,
  requireBigEvent,
  revalidateBigEvent,
} from "@/lib/big-events/action-helpers";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import { participantName } from "@/lib/big-events/participant-list";
import { logAuditEvent } from "./audit-log";

type Account = Models.Row &
  Pick<Users, "campus_id" | "email" | "name" | "student_id">;

/** An account the organizer can link a participant to. */
export interface LinkCandidate {
  campusName: string;
  email: string;
  /** Already linked to another participant of this big event. */
  hasTicketHere: boolean;
  id: string;
  name: string;
}

export type ManualLinkResult =
  | { ok: true }
  | { ok: false; reason: LinkRefusal | "no_suggestion" };

const DATABASE_ID = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const USER_TABLE = "user";
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 10;
/** Enough to tell one hit from several after leaving out a dismissed account. */
const SUGGESTION_LOOKUP_LIMIT = 3;
const SUGGESTION_CONCURRENCY = 5;
const ACCOUNT_FIELDS = ["$id", "campus_id", "email", "name", "student_id"];

const idSchema = z.string().min(1).max(36);
const idsSchema = z.array(idSchema);
const querySchema = z.string().max(100);

/** The participant, after checking the caller may see them. */
async function requireParticipant(
  db: AdminDb,
  participantId: string
): Promise<BigEventParticipantRow> {
  const response = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [Query.equal("$id", [idSchema.parse(participantId)]), Query.limit(1)]
  );
  const participant = response.rows[0];
  if (!participant) {
    throw new Error("This person is no longer on the list");
  }
  const { access } = await requireBigEvent(participant.big_event_id);
  if (!canSeeParticipant(access, participant)) {
    throw new Error("You can only change people from your own campus");
  }
  return participant;
}

function isBiLinked(account: Pick<Account, "student_id">): boolean {
  return Boolean(account.student_id?.trim());
}

async function auditLink(
  ctx: UserAuthContext,
  action: string,
  participant: BigEventParticipantRow,
  payload: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(ctx, action, {
    payload: { big_event_id: participant.big_event_id, ...payload },
    resourceId: participant.$id,
    resourceType: "big_event_participant",
  });
}

/** BI-linked accounts by name or email, for linking a participant by hand. */
export async function searchAccountsForLink(
  bigEventId: string,
  query: string
): Promise<LinkCandidate[]> {
  const q = querySchema.parse(query).trim();
  await requireBigEvent(bigEventId);
  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }
  // The user table is readable only with the service key.
  const { db } = await createAdminClient();
  const response = await db.listRows<Account>(DATABASE_ID, USER_TABLE, [
    Query.or([Query.contains("name", q), Query.contains("email", q)]),
    Query.isNotNull("student_id"),
    Query.select(ACCOUNT_FIELDS),
    Query.limit(SEARCH_LIMIT),
  ]);
  const accounts = response.rows.filter(isBiLinked);
  if (accounts.length === 0) {
    return [];
  }
  const holders = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.equal(
        "user_id",
        accounts.map((account) => account.$id)
      ),
      Query.select(["$id", "user_id"]),
      Query.limit(SEARCH_LIMIT),
    ]
  );
  const withTicket = new Set(holders.rows.map((row) => row.user_id));
  return accounts.map((account) => ({
    campusName: campusNameFor(account.campus_id),
    email: account.email ?? "",
    hasTicketHere: withTicket.has(account.$id),
    id: account.$id,
    name: account.name ?? "",
  }));
}

export async function linkParticipantManually(
  participantId: string,
  userId: string
): Promise<ManualLinkResult> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const participant = await requireParticipant(db, participantId);
  const result = await linkParticipant(db, {
    method: "manual",
    participant,
    userId: idSchema.parse(userId),
  });
  if (result.ok) {
    await auditLink(ctx, "big_event.participant.link", participant, {
      method: "manual",
      user_id: userId,
    });
    revalidateBigEvent(participant.big_event_id);
  }
  return result;
}

export async function unlinkParticipantAction(
  participantId: string
): Promise<void> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const participant = await requireParticipant(db, participantId);
  if (!participant.user_id) {
    return;
  }
  await unlinkParticipant(db, participant.$id);
  await auditLink(ctx, "big_event.participant.unlink", participant, {
    user_id: participant.user_id,
  });
  revalidateBigEvent(participant.big_event_id);
}

export async function acceptSuggestion(
  participantId: string
): Promise<ManualLinkResult> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const participant = await requireParticipant(db, participantId);
  const userId = participant.suggested_user_id;
  if (!userId) {
    return { ok: false, reason: "no_suggestion" };
  }
  const result = await linkParticipant(db, {
    method: "manual",
    participant,
    userId,
  });
  if (result.ok) {
    await auditLink(ctx, "big_event.participant.link", participant, {
      method: "manual",
      suggestion: participant.suggested_reason,
      user_id: userId,
    });
    revalidateBigEvent(participant.big_event_id);
  }
  return result;
}

/** "Not them": the account is remembered so it isn't suggested again. */
export async function dismissSuggestion(participantId: string): Promise<void> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const participant = await requireParticipant(db, participantId);
  if (!participant.suggested_user_id) {
    return;
  }
  await db.updateRow(DATABASE_ID, PARTICIPANTS, participant.$id, {
    dismissed_user_id: participant.suggested_user_id,
    suggested_reason: null,
    suggested_user_id: null,
  });
  await auditLink(
    ctx,
    "big_event.participant.suggestion_dismiss",
    participant,
    {
      user_id: participant.suggested_user_id,
    }
  );
  revalidateBigEvent(participant.big_event_id);
}

/** The one usable account among `accounts`, else null (none or several). */
function onlyCandidate(
  accounts: Account[],
  participant: BigEventParticipantRow,
  taken: Set<string>
): string | null {
  const ids = new Set(
    accounts
      .filter(
        (account) =>
          isBiLinked(account) &&
          account.$id !== participant.dismissed_user_id &&
          !taken.has(account.$id)
      )
      .map((account) => account.$id)
  );
  return ids.size === 1 ? ([...ids][0] ?? null) : null;
}

async function lookupAccounts(
  db: AdminDb,
  queries: string[]
): Promise<Account[]> {
  const response = await db.listRows<Account>(DATABASE_ID, USER_TABLE, [
    ...queries,
    Query.isNotNull("student_id"),
    Query.select(ACCOUNT_FIELDS),
    Query.limit(SUGGESTION_LOOKUP_LIMIT),
  ]);
  return response.rows;
}

/** What every lookup in one `findSuggestions` run shares. */
interface SuggestionContext {
  /** Phones on more than one participant of the big event (ruling R29). */
  sharedPhones: Set<string>;
  /** Accounts already holding a ticket in the big event. */
  taken: Set<string>;
}

/** Normalized phones that more than one participant of the big event holds. */
async function phonesOnSeveralTickets(
  db: AdminDb,
  bigEventId: string,
  candidates: BigEventParticipantRow[]
): Promise<Set<string>> {
  const phones = candidates.flatMap((row) => normalizePhone(row.phone) ?? []);
  const holders = await listRowsByIds<BigEventParticipantRow>(
    db,
    PARTICIPANTS,
    "phone",
    phones,
    [Query.equal("big_event_id", [bigEventId]), Query.select(["$id", "phone"])]
  );
  const tickets = new Map<string, number>();
  for (const row of holders) {
    const phone = normalizePhone(row.phone);
    if (phone) {
      tickets.set(phone, (tickets.get(phone) ?? 0) + 1);
    }
  }
  return new Set(
    [...tickets].flatMap(([phone, count]) => (count > 1 ? [phone] : []))
  );
}

/**
 * A possible match: the one BI-linked account with the same phone (unless
 * that phone is on several tickets), else the one BI-linked account with the
 * same name on the same campus. Never a dismissed account or one that
 * already holds a ticket in the big event.
 */
async function suggestionFor(
  db: AdminDb,
  participant: BigEventParticipantRow,
  { sharedPhones, taken }: SuggestionContext
): Promise<{ reason: SuggestionReason; userId: string } | null> {
  const phone = normalizePhone(participant.phone);
  if (phone && !sharedPhones.has(phone)) {
    const byPhone = onlyCandidate(
      await lookupAccounts(db, [Query.equal("phone", phoneVariants(phone))]),
      participant,
      taken
    );
    if (byPhone) {
      return { reason: "phone", userId: byPhone };
    }
  }
  const name = participantName(participant).trim();
  if (name.length < MIN_QUERY_LENGTH) {
    return null;
  }
  const byName = onlyCandidate(
    await lookupAccounts(db, [
      Query.contains("name", name),
      ...(participant.campus_id
        ? [Query.equal("campus_id", [participant.campus_id])]
        : []),
    ]),
    participant,
    taken
  );
  return byName ? { reason: "name", userId: byName } : null;
}

async function unlinkedWithoutSuggestion(
  db: AdminDb,
  bigEventId: string,
  access: GrantedAccess,
  participantIds: string[] | undefined
): Promise<BigEventParticipantRow[]> {
  const scope = [
    Query.equal("big_event_id", [bigEventId]),
    ...participantCampusFilter(access),
    Query.isNull("user_id"),
    Query.isNull("suggested_user_id"),
  ];
  return participantIds
    ? await listRowsByIds<BigEventParticipantRow>(
        db,
        PARTICIPANTS,
        "$id",
        participantIds,
        scope
      )
    : await listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, scope);
}

/**
 * Looks for a possible account for every unlinked participant without one
 * (or only `participantIds`). Suggestions are shown to organizers, never
 * linked automatically: a profile phone is typed by the student, unverified.
 */
export async function findSuggestions(
  bigEventId: string,
  participantIds?: string[]
): Promise<{ suggested: number }> {
  const ctx = await requireAuth();
  const { access } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const candidates = await unlinkedWithoutSuggestion(
    db,
    bigEventId,
    access,
    participantIds ? idsSchema.parse(participantIds) : undefined
  );
  if (candidates.length === 0) {
    return { suggested: 0 };
  }
  const linked = await listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, [
    Query.equal("big_event_id", [bigEventId]),
    Query.isNotNull("user_id"),
    Query.select(["$id", "user_id"]),
  ]);
  const context: SuggestionContext = {
    sharedPhones: await phonesOnSeveralTickets(db, bigEventId, candidates),
    taken: new Set(linked.flatMap((row) => row.user_id ?? [])),
  };

  const results = await mapWithConcurrency(
    candidates,
    SUGGESTION_CONCURRENCY,
    async (participant) => {
      try {
        const suggestion = await suggestionFor(db, participant, context);
        if (!suggestion) {
          return false;
        }
        await db.updateRow(DATABASE_ID, PARTICIPANTS, participant.$id, {
          suggested_reason: suggestion.reason,
          suggested_user_id: suggestion.userId,
        });
        return true;
      } catch (error) {
        console.error(
          "[big-events] Couldn't look for a possible match:",
          error
        );
        return false;
      }
    }
  );
  const suggested = results.filter(Boolean).length;
  if (suggested > 0) {
    await logAuditEvent(ctx, "big_event.participant.suggest", {
      payload: { suggested },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  return { suggested };
}
