"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import {
  type BigEventAccess,
  canSeeParticipant,
  participantCampusFilter,
} from "@/lib/big-events/access";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import {
  type ParticipantFormValues,
  participantColumns,
  participantFormSchema,
} from "@/lib/big-events/participant-form";
import {
  type ParticipantList,
  type ParticipantListItem,
  type ParticipantSuggestion,
  type PileFilter,
  sortParticipants,
  toParticipantListItem,
} from "@/lib/big-events/participant-list";
import {
  type ParticipantCsvHeaders,
  participantsToCsv,
} from "@/lib/big-events/participants-csv";
import { REACH_PILES, type ReachPile, reachPile } from "@/lib/big-events/reach";
import { getPushReach } from "@/lib/big-events/reach.server";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";
import { logAuditEvent } from "./audit-log";
import { getBigEvent } from "./big-events";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type GrantedAccess = Exclude<BigEventAccess, null>;

const DATABASE_ID = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const USER_TABLE = "user";
const MEMBERSHIP_CONCURRENCY = 4;
const DELETE_CONCURRENCY = 8;

const participantIdsSchema = z.array(z.string().min(1).max(36));
const pileSchema = z.enum(["all", ...REACH_PILES]);
const csvHeadersSchema = z.object({
  campus: z.string().max(100),
  email: z.string().max(100),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  phone: z.string().max(100),
  room: z.string().max(100),
});

async function requireBigEvent(bigEventId: string) {
  const found = await getBigEvent(bigEventId);
  if (!found) {
    throw new Error("This big event doesn't exist or you can't see it");
  }
  return found;
}

function visibleParticipants(
  bigEventId: string,
  access: GrantedAccess
): string[] {
  return [
    Query.equal("big_event_id", [bigEventId]),
    ...participantCampusFilter(access),
  ];
}

async function findParticipant(
  db: AdminDb,
  id: string
): Promise<BigEventParticipantRow | null> {
  const response = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [Query.equal("$id", [id]), Query.limit(1)]
  );
  return response.rows[0] ?? null;
}

/** Each participant's room name (rooms are named after the buyer). */
async function loadRoomNames(
  db: AdminDb,
  bigEventId: string
): Promise<{ byParticipant: Map<string, string>; hasRooms: boolean }> {
  const rooms = await listAllRows<BigEventGroupRow>(
    db,
    BIG_EVENT_TABLES.groups,
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.equal("kind", ["room"]),
      Query.select(["$id", "name"]),
    ]
  );
  const byParticipant = new Map<string, string>();
  if (rooms.length === 0) {
    return { byParticipant, hasRooms: false };
  }
  const names = new Map(rooms.map((room) => [room.$id, room.name]));
  const members = await listRowsByIds<BigEventGroupMemberRow>(
    db,
    BIG_EVENT_TABLES.groupMembers,
    "group_id",
    [...names.keys()],
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.select(["$id", "group_id", "participant_id"]),
    ]
  );
  for (const member of members) {
    const name = names.get(member.group_id);
    if (name !== undefined && !byParticipant.has(member.participant_id)) {
      byParticipant.set(member.participant_id, name);
    }
  }
  return { byParticipant, hasRooms: true };
}

async function loadParticipantList(
  db: AdminDb,
  bigEventId: string,
  access: GrantedAccess
): Promise<ParticipantList> {
  const participants = await listAllRows<BigEventParticipantRow>(
    db,
    PARTICIPANTS,
    visibleParticipants(bigEventId, access)
  );
  const linkedIds = participants.flatMap((row) =>
    row.user_id ? [row.user_id] : []
  );
  const suggestedIds = participants.flatMap((row) =>
    !row.user_id && row.suggested_user_id ? [row.suggested_user_id] : []
  );
  const [rooms, accounts, push] = await Promise.all([
    loadRoomNames(db, bigEventId),
    listRowsByIds<Users>(
      db,
      USER_TABLE,
      "$id",
      [...linkedIds, ...suggestedIds],
      [Query.select(["$id", "name", "email"])]
    ),
    getPushReach(linkedIds),
  ]);
  const accountById = new Map(
    accounts.map((account) => [account.$id, account])
  );
  const counts: Record<ReachPile, number> = {
    app_no_push: 0,
    email: 0,
    push: 0,
  };
  let noCampus = 0;
  const rows = sortParticipants(participants).map(
    (row): ParticipantListItem => {
      const pile = reachPile(row, push);
      counts[pile] += 1;
      if (row.campus_id === null) {
        noCampus += 1;
      }
      const account = row.user_id ? accountById.get(row.user_id) : undefined;
      return toParticipantListItem(row, {
        accountEmail: account?.email ?? null,
        accountName: account?.name ?? null,
        pile,
        roomName: rooms.byParticipant.get(row.$id) ?? null,
        suggestion: suggestionFor(row, accountById),
      });
    }
  );
  return { counts, hasRooms: rooms.hasRooms, noCampus, rows };
}

/** The possible match as the tab shows it; nothing once linked or when the account is gone. */
function suggestionFor(
  row: BigEventParticipantRow,
  accounts: Map<string, Users>
): ParticipantSuggestion | null {
  const account =
    !row.user_id && row.suggested_user_id
      ? accounts.get(row.suggested_user_id)
      : undefined;
  if (!(account && row.suggested_reason)) {
    return null;
  }
  return {
    email: account.email,
    name: account.name ?? "",
    reason: row.suggested_reason,
  };
}

function changedColumns(
  before: BigEventParticipantRow,
  after: Record<string, unknown>
): string[] {
  return Object.entries(after)
    .filter(
      ([key, value]) => before[key as keyof BigEventParticipantRow] !== value
    )
    .map(([key]) => key);
}

function revalidateBigEvent(bigEventId: string): void {
  revalidatePath("/big-events");
  revalidatePath(`/big-events/${bigEventId}`, "layout");
}

/** Everyone on the big event the caller may see, with reach pile, room and account. */
export async function listParticipants(
  bigEventId: string
): Promise<ParticipantList> {
  const { access } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  return await loadParticipantList(db, bigEventId, access);
}

export async function addParticipant(
  bigEventId: string,
  values: ParticipantFormValues
): Promise<{ id: string }> {
  const ctx = await requireAuth();
  const data = participantFormSchema.parse(values);
  const { access } = await requireBigEvent(bigEventId);
  if (!canSeeParticipant(access, data)) {
    throw new Error("You can only add people from your own campus");
  }
  const { db } = await createAdminClient();
  const row = await db.createRow(DATABASE_ID, PARTICIPANTS, ID.unique(), {
    big_event_id: bigEventId,
    ...participantColumns(data),
  });
  await logAuditEvent(ctx, "big_event.participant.add", {
    payload: { big_event_id: bigEventId },
    resourceId: row.$id,
    resourceType: "big_event_participant",
  });
  revalidateBigEvent(bigEventId);
  return { id: row.$id };
}

export async function updateParticipant(
  id: string,
  values: ParticipantFormValues
): Promise<void> {
  const ctx = await requireAuth();
  const data = participantFormSchema.parse(values);
  const { db } = await createAdminClient();
  const participant = await findParticipant(db, id);
  if (!participant) {
    throw new Error("This person is no longer on the list");
  }
  const { access } = await requireBigEvent(participant.big_event_id);
  // Both the person as they are and as they would be must be the caller's.
  if (
    !(canSeeParticipant(access, participant) && canSeeParticipant(access, data))
  ) {
    throw new Error("You can only change people from your own campus");
  }
  const columns = participantColumns(data);
  await db.updateRow(DATABASE_ID, PARTICIPANTS, id, columns);
  await logAuditEvent(ctx, "big_event.participant.update", {
    payload: {
      big_event_id: participant.big_event_id,
      changed: changedColumns(participant, columns),
    },
    resourceId: id,
    resourceType: "big_event_participant",
  });
  revalidateBigEvent(participant.big_event_id);
}

/** Removes people and their room, bus and group places. All or nothing on access. */
export async function removeParticipants(
  ids: string[]
): Promise<{ removed: number }> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const participants = await listRowsByIds<BigEventParticipantRow>(
    db,
    PARTICIPANTS,
    "$id",
    participantIdsSchema.parse(ids),
    []
  );
  const bigEventIds = [...new Set(participants.map((row) => row.big_event_id))];
  const accessByEvent = new Map<string, GrantedAccess>();
  for (const bigEventId of bigEventIds) {
    const { access } = await requireBigEvent(bigEventId);
    accessByEvent.set(bigEventId, access);
  }
  const allowed = participants.every((row) =>
    canSeeParticipant(accessByEvent.get(row.big_event_id) ?? null, row)
  );
  if (!allowed) {
    throw new Error("You can only remove people from your own campus");
  }

  const memberships = await listRowsByIds<BigEventGroupMemberRow>(
    db,
    BIG_EVENT_TABLES.groupMembers,
    "participant_id",
    participants.map((row) => row.$id),
    [Query.select(["$id"])]
  );
  await mapWithConcurrency(memberships, DELETE_CONCURRENCY, (membership) =>
    db.deleteRow(DATABASE_ID, BIG_EVENT_TABLES.groupMembers, membership.$id)
  );
  await mapWithConcurrency(participants, DELETE_CONCURRENCY, (row) =>
    db.deleteRow(DATABASE_ID, PARTICIPANTS, row.$id)
  );

  for (const bigEventId of bigEventIds) {
    await logAuditEvent(ctx, "big_event.participant.remove", {
      payload: {
        participant_ids: participants
          .filter((row) => row.big_event_id === bigEventId)
          .map((row) => row.$id),
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  return { removed: participants.length };
}

/**
 * Re-reads the membership of every connected participant the caller can see.
 * A lookup that fails (Finago down, no student number) leaves the old value.
 */
export async function checkMemberships(
  bigEventId: string
): Promise<{ checked: number; invalid: number }> {
  const ctx = await requireAuth();
  const { access } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const linked = await listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, [
    ...visibleParticipants(bigEventId, access),
    Query.isNotNull("user_id"),
    Query.select(["$id", "user_id"]),
  ]);
  const accounts = await listRowsByIds<Users>(
    db,
    USER_TABLE,
    "$id",
    linked.flatMap((row) => (row.user_id ? [row.user_id] : [])),
    [Query.select(["$id", "student_id"])]
  );
  const studentNumbers = new Map(
    accounts.map((account) => [
      account.$id,
      sanitizeStudentNumber(account.student_id),
    ])
  );
  const checkedAt = new Date().toISOString();

  const results = await mapWithConcurrency(
    linked,
    MEMBERSHIP_CONCURRENCY,
    async (row): Promise<boolean | null> => {
      const studentNumber = row.user_id
        ? studentNumbers.get(row.user_id)
        : null;
      if (!studentNumber) {
        return null;
      }
      let valid: boolean;
      try {
        valid = (await getScanMembershipStatus(studentNumber)).isMember;
      } catch {
        return null;
      }
      try {
        await db.updateRow(DATABASE_ID, PARTICIPANTS, row.$id, {
          membership_checked_at: checkedAt,
          membership_valid: valid,
        });
      } catch (error) {
        console.error("[big-events] Couldn't save a membership check:", error);
        return null;
      }
      return valid;
    }
  );

  const checked = results.filter((result) => result !== null).length;
  const invalid = results.filter((result) => result === false).length;
  await logAuditEvent(ctx, "big_event.participant.membership_check", {
    payload: { checked, invalid },
    resourceId: bigEventId,
    resourceType: "big_event",
  });
  revalidateBigEvent(bigEventId);
  return { checked, invalid };
}

/** One pile (or everyone) as CSV: first name, last name, email, phone, campus, room. */
export async function exportParticipantsCsv(
  bigEventId: string,
  pile: PileFilter,
  headers: ParticipantCsvHeaders
): Promise<string> {
  const chosenPile = pileSchema.parse(pile);
  const columnTitles = csvHeadersSchema.parse(headers);
  const { access } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const { rows } = await loadParticipantList(db, bigEventId, access);
  const chosen =
    chosenPile === "all" ? rows : rows.filter((row) => row.pile === chosenPile);
  return participantsToCsv(chosen, columnTitles);
}
