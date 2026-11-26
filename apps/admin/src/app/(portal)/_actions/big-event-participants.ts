"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import {
  type EnqueueConnectResult,
  enqueueConnectEmails,
} from "@repo/shared/big-events/delivery-queue";
import { CLEARED_CONNECT_LINK } from "@repo/shared/big-events/linking";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import {
  canSeeParticipant,
  participantCampusFilter,
} from "@/lib/big-events/access";
import {
  type AdminDb,
  assertComplete,
  type GrantedAccess,
  markNotices,
  newWriteLog,
  requireBigEvent,
  revalidateBigEvent,
  writePhase,
} from "@/lib/big-events/action-helpers";
import { seatsOffCampus } from "@/lib/big-events/buses/campus-change";
import { normalizeEmail } from "@/lib/big-events/import/normalize";
import { kickDeliveries } from "@/lib/big-events/kick-deliveries";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import {
  type ParticipantFormValues,
  participantColumns,
  participantFormSchema,
} from "@/lib/big-events/participant-form";
import {
  CONNECT_SEND_MODES,
  type ConnectSendMode,
  filterParticipants,
  needsNewConnectLink,
  type ParticipantFilters,
  type ParticipantList,
  type ParticipantListItem,
  type ParticipantSuggestion,
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

const DATABASE_ID = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const USER_TABLE = "user";
const MEMBERSHIP_CONCURRENCY = 4;
const DELETE_CONCURRENCY = 8;

const participantIdsSchema = z.array(z.string().min(1).max(36));
const sendModeSchema = z.enum(CONNECT_SEND_MODES);
/** The list's filters, as the toolbar holds them. They only ever narrow. */
const filtersSchema = z.object({
  campus: z.string().max(36),
  needsNewLink: z.boolean().default(false),
  noBus: z.boolean().default(false),
  noRoom: z.boolean(),
  pile: z.enum(["all", ...REACH_PILES]),
  search: z.string().max(200),
});
const csvHeadersSchema = z.object({
  campus: z.string().max(100),
  email: z.string().max(100),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  phone: z.string().max(100),
  room: z.string().max(100),
});

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

/** Each participant's bus names: the way out, and the way home when it differs. */
async function loadBusNames(
  db: AdminDb,
  bigEventId: string
): Promise<Map<string, { home: string | null; out: string | null }>> {
  const buses = await listAllRows<BigEventGroupRow>(
    db,
    BIG_EVENT_TABLES.groups,
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.equal("kind", ["bus"]),
      Query.select(["$id", "name"]),
    ]
  );
  const byParticipant = new Map<
    string,
    { home: string | null; out: string | null }
  >();
  if (buses.length === 0) {
    return byParticipant;
  }
  const names = new Map(buses.map((bus) => [bus.$id, bus.name]));
  const members = await listRowsByIds<BigEventGroupMemberRow>(
    db,
    BIG_EVENT_TABLES.groupMembers,
    "group_id",
    [...names.keys()],
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.select(["$id", "group_id", "leg", "participant_id"]),
    ]
  );
  for (const member of members) {
    const name = names.get(member.group_id);
    if (name === undefined || (member.leg !== "out" && member.leg !== "home")) {
      continue;
    }
    const seat = byParticipant.get(member.participant_id) ?? {
      home: null,
      out: null,
    };
    seat[member.leg] = name;
    byParticipant.set(member.participant_id, seat);
  }
  return byParticipant;
}

async function loadParticipantList(
  db: AdminDb,
  bigEventId: string,
  access: GrantedAccess,
  travelEnabled: boolean
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
  const [rooms, buses, accounts, push] = await Promise.all([
    loadRoomNames(db, bigEventId),
    travelEnabled
      ? loadBusNames(db, bigEventId)
      : Promise.resolve(
          new Map<string, { home: string | null; out: string | null }>()
        ),
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
      const seat = buses.get(row.$id);
      return toParticipantListItem(row, {
        accountEmail: account?.email ?? null,
        accountName: account?.name ?? null,
        busName: seat?.out ?? null,
        homeBusName: seat?.home && seat.home !== seat.out ? seat.home : null,
        needsNewLink: needsNewConnectLink(row),
        pile,
        roomName: rooms.byParticipant.get(row.$id) ?? null,
        suggestion: suggestionFor(row, accountById),
      });
    }
  );
  return {
    counts,
    hasBuses: travelEnabled,
    hasRooms: rooms.hasRooms,
    noCampus,
    rows,
  };
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

/** The person's seats on buses of another campus than `campusId` (M12). */
async function seatsOffNewCampus(
  db: AdminDb,
  participant: BigEventParticipantRow,
  campusId: string | null
): Promise<string[]> {
  const inEvent = Query.equal("big_event_id", [participant.big_event_id]);
  const [buses, seats] = await Promise.all([
    listAllRows<BigEventGroupRow>(db, BIG_EVENT_TABLES.groups, [
      inEvent,
      Query.equal("kind", ["bus"]),
      Query.select(["$id", "campus_id"]),
    ]),
    listAllRows<BigEventGroupMemberRow>(db, BIG_EVENT_TABLES.groupMembers, [
      inEvent,
      Query.equal("participant_id", [participant.$id]),
      Query.select(["$id", "group_id", "leg"]),
    ]),
  ]);
  return seatsOffCampus(
    seats,
    new Map(buses.map((bus) => [bus.$id, bus.campus_id])),
    campusId
  );
}

/**
 * M12: someone moved to another campus leaves the other campuses' buses
 * (nobody rides another campus's bus, Stage 2 ruling R19). After the bus
 * lists are published they are owed a bus notice, marked first (ruling
 * R11). Runs before the campus itself changes, so a retry after a failure
 * still sees the change and finishes it. Audited with counts only.
 */
async function leaveOtherCampusBuses(
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  db: AdminDb,
  event: BigEventRow,
  participantId: string,
  seatIds: string[]
): Promise<void> {
  const published = Boolean(event.bus_lists_published_at);
  const log = newWriteLog();
  try {
    const noticed =
      !published ||
      (await markNotices(db, log, [participantId], new Date().toISOString()));
    const removed =
      noticed &&
      (await writePhase(
        log,
        "seats",
        seatIds,
        (seatId) =>
          db.deleteRow(DATABASE_ID, BIG_EVENT_TABLES.groupMembers, seatId),
        "campus change"
      ));
    log.complete = Boolean(removed);
  } finally {
    await logAuditEvent(ctx, "big_event.bus.campus_change", {
      payload: {
        complete: log.complete,
        notice: published,
        participant_id: participantId,
        phases: log.phases,
      },
      resourceId: event.$id,
      resourceType: "big_event",
    });
  }
  assertComplete(log);
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

/** Everyone on the big event the caller may see, with reach pile, room and account. */
export async function listParticipants(
  bigEventId: string
): Promise<ParticipantList> {
  const { access, event } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  return await loadParticipantList(
    db,
    bigEventId,
    access,
    Boolean(event.travel_enabled)
  );
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
  const { access, event } = await requireBigEvent(participant.big_event_id);
  // Both the person as they are and as they would be must be the caller's.
  if (
    !(canSeeParticipant(access, participant) && canSeeParticipant(access, data))
  ) {
    throw new Error("You can only change people from your own campus");
  }
  const columns = participantColumns(data);
  if (columns.campus_id !== participant.campus_id) {
    const seats = await seatsOffNewCampus(db, participant, columns.campus_id);
    if (seats.length > 0) {
      await leaveOtherCampusBuses(ctx, db, event, id, seats);
    }
  }
  // A new address kills the old connect link (ruling R36): a pending email to
  // the old address is skipped, and the next send makes a new link.
  const emailChanged =
    normalizeEmail(participant.ticket_email) !== columns.ticket_email;
  await db.updateRow(DATABASE_ID, PARTICIPANTS, id, {
    ...columns,
    ...(emailChanged ? CLEARED_CONNECT_LINK : {}),
  });
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

/**
 * The people the list shows with these filters, as CSV: first name, last
 * name, email, phone, campus, room. Only ever the people the caller may see.
 */
export async function exportParticipantsCsv(
  bigEventId: string,
  filters: ParticipantFilters,
  headers: ParticipantCsvHeaders
): Promise<string> {
  const shown = filtersSchema.parse(filters);
  const columnTitles = csvHeadersSchema.parse(headers);
  const { access, event } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const { rows } = await loadParticipantList(
    db,
    bigEventId,
    access,
    Boolean(event.travel_enabled)
  );
  return participantsToCsv(filterParticipants(rows, shown), columnTitles);
}

/**
 * Queues the connect email for unlinked people with a ticket email, then asks
 * the api to start sending. With ids, each must be on this big event and
 * visible. Without, it is the people the caller can see who were never sent
 * one (`new`, ruling R37), or all of them, emailed before or not (`all`).
 */
export async function sendConnectEmails(
  bigEventId: string,
  participantIds?: string[],
  mode: ConnectSendMode = "new"
): Promise<EnqueueConnectResult> {
  const ctx = await requireAuth();
  const ids = participantIds && participantIdsSchema.parse(participantIds);
  const sendMode = sendModeSchema.parse(mode);
  const { access, event } = await requireBigEvent(bigEventId);
  if (event.status !== "published") {
    throw new Error(
      "Publish the big event before sending connect emails / Publiser det store arrangementet før du sender koblings-e-post"
    );
  }
  const { db } = await createAdminClient();
  let participants: BigEventParticipantRow[];
  if (ids) {
    participants = await listRowsByIds<BigEventParticipantRow>(
      db,
      PARTICIPANTS,
      "$id",
      ids,
      [Query.equal("big_event_id", [bigEventId])]
    );
    const found = new Set(participants.map((row) => row.$id));
    const allowed =
      ids.every((id) => found.has(id)) &&
      participants.every((row) => canSeeParticipant(access, row));
    if (!allowed) {
      throw new Error("You can only email people from your own campus");
    }
  } else {
    participants = await listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, [
      ...visibleParticipants(bigEventId, access),
      Query.isNull("user_id"),
      Query.isNotNull("ticket_email"),
      ...(sendMode === "new" ? [Query.isNull("connect_sent_at")] : []),
    ]);
  }
  const result = await enqueueConnectEmails(db, {
    bigEventId,
    kind: "connect",
    participants,
  });
  await logAuditEvent(ctx, "big_event.connect_emails.send", {
    payload: {
      addresses: result.addresses,
      mode: ids ? null : sendMode,
      queued: result.queued,
      requested: ids?.length ?? null,
      waiting: result.waiting,
    },
    resourceId: bigEventId,
    resourceType: "big_event",
  });
  kickDeliveries();
  revalidateBigEvent(bigEventId);
  return result;
}
