import type { GroupKind } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { normalizeEmail, normalizeName, normalizePhone } from "./normalize";
import type {
  ImportOptions,
  ImportPlan,
  NewGroup,
  ParsedPerson,
  PlacementRule,
} from "./plan-import";

/** One person from the file, with the participant they already are (if any). */
export interface PlanSubject {
  /** The participant's campus after this import. */
  campusId: string | null;
  participant: BigEventParticipantRow | null;
  person: ParsedPerson;
}

interface BoardGroup {
  campuses: Set<string | null>;
  capacity: number | null;
  /** Existing members plus placements in this plan. */
  count: number;
  created: NewGroup | null;
  key: string;
  kind: GroupKind;
  name: string;
  row: BigEventGroupRow | null;
}

interface Board {
  groups: Map<string, BoardGroup>;
  /** Participant id → keys of the groups they are already in. */
  memberOf: Map<string, Set<string>>;
  placements: ImportPlan["placements"];
  /** The room each subject is in, from the list or from this plan. */
  roomOf: Map<PlanSubject, string>;
}

/** Rooms looked up by order number or by buyer contact. */
type RoomIndex = Map<string, Set<string>>;

/** An existing group's key in a plan: its source key, else its id. */
export function existingGroupKey(group: BigEventGroupRow): string {
  return group.source_key ?? `id:${group.$id}`;
}

function bookingKey(ref: string): string {
  return `booking:${ref}`;
}

/** Kind-qualified so a bus "1" and a room "1" never share a key. */
function columnKey(kind: GroupKind, value: string): string {
  return `col:${kind}:${normalizeName(value)}`;
}

function fullName(person: ParsedPerson): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function addTo(index: RoomIndex, key: string, roomKey: string): void {
  const rooms = index.get(key) ?? new Set<string>();
  rooms.add(roomKey);
  index.set(key, rooms);
}

/** The one room a lookup points at; nothing when it points at none or several. */
function onlyRoom(rooms: Set<string> | undefined): string | null {
  return rooms?.size === 1 ? ([...rooms][0] ?? null) : null;
}

function buildBoard(
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): Board {
  const board: Board = {
    groups: new Map(),
    memberOf: new Map(),
    roomOf: new Map(),
    placements: [],
  };
  const keyById = new Map<string, string>();
  for (const row of groups) {
    const key = existingGroupKey(row);
    keyById.set(row.$id, key);
    if (!board.groups.has(key)) {
      board.groups.set(key, {
        key,
        kind: row.kind,
        name: row.name,
        capacity: row.capacity,
        count: 0,
        row,
        created: null,
        campuses: new Set(),
      });
    }
  }
  for (const membership of members) {
    const key = keyById.get(membership.group_id);
    const keys = board.memberOf.get(membership.participant_id) ?? new Set();
    // A bus member has a row per leg; count each person once.
    if (key && !keys.has(key)) {
      keys.add(key);
      board.memberOf.set(membership.participant_id, keys);
      const target = board.groups.get(key);
      if (target) {
        target.count += 1;
      }
    }
  }
  return board;
}

function markExistingRooms(board: Board, subjects: PlanSubject[]): void {
  for (const subject of subjects) {
    const keys = subject.participant
      ? board.memberOf.get(subject.participant.$id)
      : undefined;
    const room = [...(keys ?? [])].find(
      (key) => board.groups.get(key)?.kind === "room"
    );
    if (room) {
      board.roomOf.set(subject, room);
    }
  }
}

function createGroup(board: Board, group: NewGroup): string {
  board.groups.set(group.key, {
    key: group.key,
    kind: group.kind,
    name: group.name,
    capacity: group.capacity,
    count: 0,
    row: null,
    created: group,
    campuses: new Set(),
  });
  return group.key;
}

/** Places a subject; someone already in that group is not placed again. */
function place(
  board: Board,
  subject: PlanSubject,
  key: string,
  rule: PlacementRule
): void {
  const target = board.groups.get(key);
  if (!target) {
    return;
  }
  if (target.kind === "room") {
    board.roomOf.set(subject, key);
  }
  target.campuses.add(subject.campusId);
  const participantId = subject.participant?.$id;
  if (participantId && board.memberOf.get(participantId)?.has(key)) {
    return;
  }
  board.placements.push({
    person: participantId ? { participantId } : subject.person,
    groupKey: key,
    rule,
  });
  target.count += 1;
}

// ---------------------------------------------------------------------------
// Spec rule 1: a column holding a Payment 1 order number or a group name

function findColumnGroup(
  board: Board,
  kind: GroupKind,
  value: string
): string | null {
  const booking = board.groups.get(bookingKey(value));
  if (kind === "room" && booking?.kind === "room") {
    return booking.key;
  }
  const column = board.groups.get(columnKey(kind, value));
  if (column) {
    return column.key;
  }
  const wanted = normalizeName(value);
  const named = [...board.groups.values()].filter(
    (group) =>
      group.row !== null &&
      group.kind === kind &&
      normalizeName(group.name) === wanted
  );
  return named.length === 1 ? (named[0]?.key ?? null) : null;
}

function placeByColumn(
  board: Board,
  subjects: PlanSubject[],
  kind: GroupKind
): void {
  for (const subject of subjects) {
    const value = subject.person.groupValue;
    if (value === null) {
      continue;
    }
    const key =
      findColumnGroup(board, kind, value) ??
      createGroup(board, {
        key: columnKey(kind, value),
        kind,
        name: value,
        campusId: null,
        capacity: null,
        bookingRowNumber: null,
      });
    place(board, subject, key, "group_column");
  }
}

// ---------------------------------------------------------------------------
// "Each row is a room booking" (Payment 1)

/** A room this participant already booked (re-import of a file without references). */
function roomBookedBy(board: Board, subject: PlanSubject): string | null {
  const participantId = subject.participant?.$id;
  if (!participantId) {
    return null;
  }
  for (const group of board.groups.values()) {
    if (
      group.kind === "room" &&
      group.row?.booking_participant_id === participantId
    ) {
      return group.key;
    }
  }
  return null;
}

/** Row numbers shift between files: never take a row key someone else's room holds. */
function freeRowKey(board: Board, rowNumber: number): string {
  const base = bookingKey(`row${rowNumber}`);
  let key = base;
  let suffix = 2;
  while (board.groups.has(key)) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
}

function placeBookings(board: Board, subjects: PlanSubject[]): void {
  for (const subject of subjects) {
    const { person } = subject;
    const key = person.ticketRef
      ? bookingKey(person.ticketRef)
      : (roomBookedBy(board, subject) ?? freeRowKey(board, person.rowNumber));
    if (!board.groups.has(key)) {
      createGroup(board, {
        key,
        kind: "room",
        name: fullName(person),
        campusId: subject.campusId,
        capacity: person.roomSize,
        bookingRowNumber: person.rowNumber,
      });
    }
    place(board, subject, key, "booking");
  }
}

// ---------------------------------------------------------------------------
// Spec rules 2–3: same order number as someone in a room, or the room buyer's contact

function roomsByRef(
  board: Board,
  subjects: PlanSubject[],
  existing: BigEventParticipantRow[]
): RoomIndex {
  const index: RoomIndex = new Map();
  for (const row of existing) {
    for (const key of board.memberOf.get(row.$id) ?? []) {
      if (row.ticket_ref && board.groups.get(key)?.kind === "room") {
        addTo(index, row.ticket_ref, key);
      }
    }
  }
  for (const subject of subjects) {
    const room = board.roomOf.get(subject);
    if (room && subject.person.ticketRef) {
      addTo(index, subject.person.ticketRef, room);
    }
  }
  return index;
}

function roomsByBuyerContact(
  board: Board,
  existing: BigEventParticipantRow[]
): RoomIndex {
  const byId = new Map(existing.map((row) => [row.$id, row]));
  const index: RoomIndex = new Map();
  for (const group of board.groups.values()) {
    const buyerId = group.row?.booking_participant_id;
    const buyer = buyerId ? byId.get(buyerId) : undefined;
    if (group.kind !== "room" || !buyer) {
      continue;
    }
    const email = normalizeEmail(buyer.ticket_email);
    const phone = normalizePhone(buyer.phone);
    if (email) {
      addTo(index, `email:${email}`, group.key);
    }
    if (phone) {
      addTo(index, `phone:${phone}`, group.key);
    }
  }
  return index;
}

function buyerRoom(buyers: RoomIndex, person: ParsedPerson): string | null {
  const rooms = new Set([
    ...(person.email ? (buyers.get(`email:${person.email}`) ?? []) : []),
    ...(person.phone ? (buyers.get(`phone:${person.phone}`) ?? []) : []),
  ]);
  return onlyRoom(rooms);
}

/**
 * Places everyone not yet in a room: order number first, then the buyer's
 * contact, then the order number again (a buyer-contact placement can make a
 * room known for an order). Ambiguous lookups place nobody.
 */
function placeIntoExistingRooms(
  board: Board,
  subjects: PlanSubject[],
  existing: BigEventParticipantRow[]
): ParsedPerson[] {
  const byRef = roomsByRef(board, subjects, existing);
  const buyers = roomsByBuyerContact(board, existing);
  const byOrderNumber = (subject: PlanSubject) =>
    subject.person.ticketRef
      ? onlyRoom(byRef.get(subject.person.ticketRef))
      : null;
  const byBuyerContact = (subject: PlanSubject) =>
    buyerRoom(buyers, subject.person);

  const passes: [(subject: PlanSubject) => string | null, PlacementRule][] = [
    [byOrderNumber, "order_number"],
    [byBuyerContact, "buyer_contact"],
    [byOrderNumber, "order_number"],
  ];
  let waiting = subjects.filter((subject) => !board.roomOf.has(subject));
  for (const [findRoom, rule] of passes) {
    waiting = waiting.filter((subject) => {
      const room = findRoom(subject);
      if (!room) {
        return true;
      }
      place(board, subject, room, rule);
      if (subject.person.ticketRef) {
        addTo(byRef, subject.person.ticketRef, room);
      }
      return false;
    });
  }
  return waiting.map((subject) => subject.person);
}

// ---------------------------------------------------------------------------

/** A group made from a column gets its members' campus when they all share one. */
function newGroups(board: Board): NewGroup[] {
  const created: NewGroup[] = [];
  for (const group of board.groups.values()) {
    if (group.created) {
      const fromColumn = group.created.bookingRowNumber === null;
      const [onlyCampus] = group.campuses;
      created.push(
        fromColumn
          ? {
              ...group.created,
              campusId: group.campuses.size === 1 ? (onlyCampus ?? null) : null,
            }
          : group.created
      );
    }
  }
  return created;
}

function overfullRooms(board: Board): string[] {
  return [...board.groups.values()]
    .filter(
      (group) =>
        group.kind === "room" &&
        group.capacity !== null &&
        group.count > group.capacity
    )
    .map((group) => group.key);
}

/**
 * Groups and placements for an import. A mapped group column decides (spec
 * rule 1); without one, "each row is a room booking" makes a room per row.
 * When the import is about rooms, everyone still without a room is tried
 * against existing rooms (spec rules 2–3), else listed as unplaced.
 */
export function planRooms(input: {
  subjects: PlanSubject[];
  options: ImportOptions;
  existing: BigEventParticipantRow[];
  groups: BigEventGroupRow[];
  members: BigEventGroupMemberRow[];
}): Pick<
  ImportPlan,
  "newGroups" | "placements" | "unplaced" | "overfullRooms"
> {
  const { subjects, options } = input;
  const board = buildBoard(input.groups, input.members);
  markExistingRooms(board, subjects);

  // Ruling R2: parsePeople fills groupValue only when a group column is mapped.
  const hasGroupColumn = subjects.some(
    (subject) => subject.person.groupValue !== null
  );
  const kind = options.groupKind ?? "room";
  if (hasGroupColumn) {
    placeByColumn(board, subjects, kind);
  } else if (options.roomBookings) {
    placeBookings(board, subjects);
  }
  const aboutRooms = !hasGroupColumn || kind === "room";
  const unplaced = aboutRooms
    ? placeIntoExistingRooms(board, subjects, input.existing)
    : [];

  return {
    newGroups: newGroups(board),
    placements: board.placements,
    unplaced,
    overfullRooms: overfullRooms(board),
  };
}
