import type { GroupKind } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import type { ImportField } from "./field-aliases";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseCampus,
  parseRoomSize,
  splitFullName,
} from "./normalize";
import type { RoomBusSeat } from "./plan-buses";
import { type PlanSubject, planRooms } from "./plan-import-rooms";

/** What each header cell holds, one entry per column. */
export interface ImportMapping {
  columns: ImportField[];
}

export interface ImportOptions {
  /** Used when neither a campus column nor the ticket category names a campus. */
  defaultCampusId: string | null;
  /** What the "group" column means; null with a group column means rooms. */
  groupKind: GroupKind | null;
  /** "Each row is a room booking" (Payment 1). Ignored when a group column is mapped. */
  roomBookings: boolean;
}

/** A further room this person booked on another row of a room booking file. */
export interface ExtraBooking {
  campusId: string | null;
  roomSize: number | null;
  rowNumber: number;
  ticketCategory: string | null;
  ticketRef: string | null;
}

export interface ParsedPerson {
  campusId: string | null;
  email: string | null;
  /** Room booking files only: bookings on this person's duplicate rows. */
  extraBookings?: ExtraBooking[];
  firstName: string;
  groupValue: string | null;
  lastName: string | null;
  phone: string | null;
  roomSize: number | null;
  /** 1-based spreadsheet row number, so admins can find the row. */
  rowNumber: number;
  ticketCategory: string | null;
  ticketRef: string | null;
}

export interface SkippedRow {
  reason: "no_name" | "no_contact";
  rowNumber: number;
}

export type PlacementRule =
  | "group_column"
  | "booking"
  | "order_number"
  | "buyer_contact";

/** A new person is referenced by its parsed row, someone already on the list by id. */
export type PlacementTarget = ParsedPerson | { participantId: string };

export interface NewGroup {
  /** Who booked this room (becomes `booking_participant_id`); null for column groups. */
  booker: PlacementTarget | null;
  /** The spreadsheet row of the booking. */
  bookingRowNumber: number | null;
  campusId: string | null;
  capacity: number | null;
  key: string;
  kind: GroupKind;
  name: string;
}

export interface Placement {
  groupKey: string;
  person: PlacementTarget;
  rule: PlacementRule;
}

/** Where the group column puts someone already on the list (ruling R34). */
export interface ColumnTarget {
  groupKey: string;
  participantId: string;
}

/** A reused booking room whose ticket now says another size. */
export interface GroupUpdate {
  capacity: number;
  groupKey: string;
}

export interface ImportPlan {
  /**
   * The group each person already on the list belongs in by the group
   * column, also when they are in it already: their other groups of that
   * kind are removed, and a bus seat gets both legs (ruling R34). Never
   * someone moved by hand (see `keptPinned`).
   */
  columnTargets: ColumnTarget[];
  create: ParsedPerson[];
  duplicatesInFile: number;
  groupUpdates: GroupUpdate[];
  /**
   * Participant ids the group column would move out of a group they were
   * moved into by hand (a pinned place). They stay where they are (R31).
   */
  keptPinned: string[];
  /** Existing participant ids not seen in this file. */
  missingFromFile: string[];
  newGroups: NewGroup[];
  noCampus: number;
  /** Group keys, counted after the plan's moves. */
  overfullRooms: string[];
  placements: Placement[];
  /**
   * Bus legs people in this file ride with their room (spec D5, N2), also
   * when they have the seat already. Empty unless Travel is on and the
   * import is about rooms.
   */
  roomBuses: RoomBusSeat[];
  skipped: SkippedRow[];
  /** Land in "Not in a room yet". */
  unplaced: ParsedPerson[];
  /** Everyone matched to the list; `changes` is empty when nothing differs. */
  update: {
    participantId: string;
    person: ParsedPerson;
    changes: Partial<BigEventParticipantRow>;
  }[];
}

export interface IdentityFields {
  email: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  ticketRef: string | null;
}

const WHITESPACE = /\s+/g;

function fullNameKey(person: { firstName: string; lastName: string | null }) {
  return normalizeName(`${person.firstName} ${person.lastName ?? ""}`);
}

function bothEqual(a: string | null, b: string | null): boolean {
  return a !== null && a === b;
}

function cleanRef(ref: string | null): string | null {
  return ref?.trim() || null;
}

/**
 * Same normalized full name AND (same email OR same phone OR same ticket
 * reference). Email alone never identifies a person: a buyer's email may be
 * on several travellers' rows.
 */
export function sameIdentity(a: IdentityFields, b: IdentityFields): boolean {
  const name = fullNameKey(a);
  if (name === "" || name !== fullNameKey(b)) {
    return false;
  }
  return (
    bothEqual(normalizeEmail(a.email), normalizeEmail(b.email)) ||
    bothEqual(normalizePhone(a.phone), normalizePhone(b.phone)) ||
    bothEqual(cleanRef(a.ticketRef), cleanRef(b.ticketRef))
  );
}

// ---------------------------------------------------------------------------
// Reading rows

type Cells = Partial<Record<Exclude<ImportField, "ignore">, string>>;

/** First non-empty cell per field (a file may map two columns to one field). */
function readCells(row: string[], columns: ImportField[]): Cells {
  const cells: Cells = {};
  for (const [index, field] of columns.entries()) {
    const value = row[index]?.replace(WHITESPACE, " ").trim() ?? "";
    if (field !== "ignore" && value !== "" && cells[field] === undefined) {
      cells[field] = value;
    }
  }
  return cells;
}

function readName(cells: Cells): { first: string; last: string | null } {
  if (cells.first_name) {
    return { first: cells.first_name, last: cells.last_name ?? null };
  }
  return cells.full_name
    ? splitFullName(cells.full_name)
    : { first: "", last: null };
}

function readPerson(
  row: string[],
  rowNumber: number,
  columns: ImportField[],
  options: ImportOptions
): ParsedPerson | SkippedRow {
  const cells = readCells(row, columns);
  const name = readName(cells);
  if (!name.first) {
    return { rowNumber, reason: "no_name" };
  }
  const email = normalizeEmail(cells.email);
  const phone = normalizePhone(cells.phone);
  if (!(email || phone)) {
    return { rowNumber, reason: "no_contact" };
  }
  const ticketCategory = cells.ticket_category ?? null;
  return {
    rowNumber,
    firstName: name.first,
    lastName: name.last,
    email,
    phone,
    campusId:
      parseCampus(cells.campus) ??
      parseCampus(ticketCategory) ??
      options.defaultCampusId,
    ticketRef: cells.ticket_ref ?? null,
    ticketCategory,
    roomSize: parseRoomSize(ticketCategory),
    groupValue: cells.group ?? null,
  };
}

const PERSON_FIELDS = [
  "email",
  "phone",
  "campusId",
  "groupValue",
] as const satisfies readonly (keyof ParsedPerson)[];
const BOOKING_FIELDS = [
  "ticketRef",
  "ticketCategory",
  "roomSize",
] as const satisfies readonly (keyof ParsedPerson)[];

/** A duplicate row fills what the first row left empty; the name never changes. */
function fillEmptyFields(
  target: ParsedPerson,
  source: ParsedPerson,
  fields: readonly (
    | (typeof PERSON_FIELDS)[number]
    | (typeof BOOKING_FIELDS)[number]
  )[]
): void {
  for (const field of fields) {
    if (target[field] === null && source[field] !== null) {
      Object.assign(target, { [field]: source[field] });
    }
  }
}

/**
 * A booking is its ticket reference and room type (one order can hold several
 * room types), or its row when it has no reference.
 */
function bookingId(booking: {
  rowNumber: number;
  ticketCategory: string | null;
  ticketRef: string | null;
}): string {
  return booking.ticketRef
    ? `${booking.ticketRef}|${normalizeName(booking.ticketCategory ?? "")}`
    : `row:${booking.rowNumber}`;
}

/**
 * Collapses a duplicate row into the first. In a room booking file a row with
 * another booking keeps that booking as an extra room for the same person
 * instead of filling the first row's booking fields.
 */
function mergeDuplicate(
  first: ParsedPerson,
  duplicate: ParsedPerson,
  roomBookings: boolean
): void {
  const id = bookingId(duplicate);
  const known =
    bookingId(first) === id ||
    (first.extraBookings ?? []).some((booking) => bookingId(booking) === id);
  if (!roomBookings || known) {
    fillEmptyFields(first, duplicate, [...PERSON_FIELDS, ...BOOKING_FIELDS]);
    return;
  }
  fillEmptyFields(first, duplicate, PERSON_FIELDS);
  first.extraBookings = first.extraBookings ?? [];
  first.extraBookings.push({
    campusId: duplicate.campusId,
    roomSize: duplicate.roomSize,
    rowNumber: duplicate.rowNumber,
    ticketCategory: duplicate.ticketCategory,
    ticketRef: duplicate.ticketRef,
  });
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/**
 * Reads the data rows below `headerRow` (0-based) into people. Rows without a
 * first name or without any way to reach the person are skipped; rows for the
 * same person (by `sameIdentity`) collapse into the first one. Fully blank
 * rows are ignored. `groupColumn` says whether a group column is mapped, even
 * when all its cells are empty.
 */
export function parsePeople(
  rows: string[][],
  headerRow: number,
  mapping: ImportMapping,
  options: ImportOptions
): {
  people: ParsedPerson[];
  skipped: SkippedRow[];
  duplicatesInFile: number;
  groupColumn: boolean;
} {
  const people: ParsedPerson[] = [];
  const skipped: SkippedRow[] = [];
  const byName = new Map<string, ParsedPerson[]>();
  let duplicatesInFile = 0;
  // Ruling R2: a mapped group column switches "each row is a room booking" off.
  const groupColumn = mapping.columns.includes("group");
  const roomBookings = options.roomBookings && !groupColumn;

  for (const [offset, row] of rows.slice(headerRow + 1).entries()) {
    if (isBlankRow(row)) {
      continue;
    }
    const result = readPerson(
      row,
      headerRow + offset + 2,
      mapping.columns,
      options
    );
    if ("reason" in result) {
      skipped.push(result);
      continue;
    }
    const key = fullNameKey(result);
    const sameName = byName.get(key) ?? [];
    const first = sameName.find((person) => sameIdentity(person, result));
    if (first) {
      mergeDuplicate(first, result, roomBookings);
      duplicatesInFile += 1;
      continue;
    }
    sameName.push(result);
    byName.set(key, sameName);
    people.push(result);
  }
  return { people, skipped, duplicatesInFile, groupColumn };
}

// ---------------------------------------------------------------------------
// Matching against the list

function participantIdentity(row: BigEventParticipantRow): IdentityFields {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.ticket_email,
    phone: row.phone,
    ticketRef: row.ticket_ref,
  };
}

function indexByName(
  existing: BigEventParticipantRow[]
): Map<string, BigEventParticipantRow[]> {
  const index = new Map<string, BigEventParticipantRow[]>();
  for (const row of existing) {
    const key = fullNameKey({
      firstName: row.first_name,
      lastName: row.last_name,
    });
    const sameName = index.get(key) ?? [];
    sameName.push(row);
    index.set(key, sameName);
  }
  return index;
}

/**
 * Pairs each person with the participant they already are, if any. A second
 * person matching an already-claimed participant is a duplicate.
 */
function matchExisting(
  people: ParsedPerson[],
  existing: BigEventParticipantRow[]
): { pairs: PlanSubject[]; duplicates: number; seen: Set<string> } {
  const byName = indexByName(existing);
  const seen = new Set<string>();
  const pairs: PlanSubject[] = [];
  let duplicates = 0;
  for (const person of people) {
    const matches = (byName.get(fullNameKey(person)) ?? []).filter((row) =>
      sameIdentity(person, participantIdentity(row))
    );
    const free = matches.find((row) => !seen.has(row.$id));
    if (!free && matches.length > 0) {
      duplicates += 1;
      continue;
    }
    if (free) {
      seen.add(free.$id);
    }
    pairs.push({ person, participant: free ?? null, campusId: null });
  }
  return { pairs, duplicates, seen };
}

type ChangeKey =
  | "first_name"
  | "last_name"
  | "ticket_email"
  | "phone"
  | "campus_id"
  | "ticket_ref"
  | "ticket_category"
  | "room_size";

function setIfChanged<K extends ChangeKey>(
  changes: Partial<BigEventParticipantRow>,
  key: K,
  next: BigEventParticipantRow[K] | null,
  current: BigEventParticipantRow[K] | null
): void {
  if (next !== null && next !== current) {
    changes[key] = next;
  }
}

/**
 * Names change only for casing or spacing of the same first/last split: a
 * full-name column's split is a guess and must not overwrite separate columns.
 */
function nameChanges(
  changes: Partial<BigEventParticipantRow>,
  person: ParsedPerson,
  row: BigEventParticipantRow
): void {
  const sameSplit =
    normalizeName(person.firstName) === normalizeName(row.first_name) &&
    normalizeName(person.lastName ?? "") === normalizeName(row.last_name ?? "");
  if (sameSplit) {
    setIfChanged(changes, "first_name", person.firstName, row.first_name);
    setIfChanged(changes, "last_name", person.lastName, row.last_name);
  }
}

/**
 * Only the fields the row has and that differ. Never touches the account
 * link (`user_id`, `linked_at`, `link_method`). The organizer's default campus
 * fills an empty campus but never replaces a known one.
 */
function changesFor(
  person: ParsedPerson,
  row: BigEventParticipantRow,
  options: ImportOptions
): Partial<BigEventParticipantRow> {
  const changes: Partial<BigEventParticipantRow> = {};
  nameChanges(changes, person, row);
  setIfChanged(
    changes,
    "ticket_email",
    person.email,
    normalizeEmail(row.ticket_email)
  );
  setIfChanged(changes, "phone", person.phone, normalizePhone(row.phone));
  const campusIsDefault =
    row.campus_id !== null && person.campusId === options.defaultCampusId;
  if (!campusIsDefault) {
    setIfChanged(changes, "campus_id", person.campusId, row.campus_id);
  }
  setIfChanged(changes, "ticket_ref", person.ticketRef, row.ticket_ref);
  setIfChanged(
    changes,
    "ticket_category",
    person.ticketCategory,
    row.ticket_category
  );
  setIfChanged(changes, "room_size", person.roomSize, row.room_size);
  return changes;
}

/**
 * Decides who is new, who is updated, which rooms exist and who goes where.
 * Pure: the caller loads the big event's participants, groups and members.
 */
export function planImport(input: {
  people: ParsedPerson[];
  skipped: SkippedRow[];
  duplicatesInFile: number;
  /** From `parsePeople`: a group column is mapped. */
  groupColumn: boolean;
  options: ImportOptions;
  existing: BigEventParticipantRow[];
  groups: BigEventGroupRow[];
  members: BigEventGroupMemberRow[];
  /** Buses exist only with Travel on (spec D5): rooms' buses count only then. */
  travelEnabled: boolean;
}): ImportPlan {
  const { options, existing } = input;
  const { pairs, duplicates, seen } = matchExisting(input.people, existing);

  const create: ImportPlan["create"] = [];
  const update: ImportPlan["update"] = [];
  for (const pair of pairs) {
    if (pair.participant) {
      const changes = changesFor(pair.person, pair.participant, options);
      update.push({
        participantId: pair.participant.$id,
        person: pair.person,
        changes,
      });
      pair.campusId =
        changes.campus_id ?? pair.participant.campus_id ?? pair.person.campusId;
    } else {
      create.push(pair.person);
      pair.campusId = pair.person.campusId;
    }
  }

  const rooms = planRooms({
    subjects: pairs,
    groupColumn: input.groupColumn,
    options,
    existing,
    groups: input.groups,
    members: input.members,
    travelEnabled: input.travelEnabled,
  });

  return {
    create,
    update,
    duplicatesInFile: input.duplicatesInFile + duplicates,
    skipped: input.skipped,
    missingFromFile: existing
      .filter((row) => !seen.has(row.$id))
      .map((row) => row.$id),
    ...rooms,
    noCampus: pairs.filter((pair) => pair.campusId === null).length,
  };
}
