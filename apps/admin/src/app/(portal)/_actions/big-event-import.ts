"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  CLEARED_CONNECT_LINK,
  findBiLinkedAccountsByEmail,
  linkParticipant,
} from "@repo/shared/big-events/linking";
import {
  BIG_EVENT_TABLES,
  GROUP_KINDS,
  type GroupKind,
  type GroupLeg,
} from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { mapAllSettledWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import {
  type BigEventAccess,
  canSeeParticipant,
  participantCampusFilter,
} from "@/lib/big-events/access";
import { suggestColumnsWithAi } from "@/lib/big-events/import/ai-mapping.server";
import { IMPORT_FIELDS } from "@/lib/big-events/import/field-aliases";
import { findHeaderRow } from "@/lib/big-events/import/header-row";
import {
  columnsForAi,
  detectColumns,
  type ImportColumns,
  withAiSuggestions,
} from "@/lib/big-events/import/import-columns";
import type { ImportResult } from "@/lib/big-events/import/import-result";
import { parseImportFile } from "@/lib/big-events/import/parse-file.server";
import {
  type ImportMapping,
  type ImportOptions,
  type ImportPlan,
  type NewGroup,
  type ParsedPerson,
  type PlacementTarget,
  parsePeople,
  planImport,
} from "@/lib/big-events/import/plan-import";
import {
  groupsByKey,
  type ImportPreview,
  isExistingTarget,
  type MissingLeg,
  missingBusLegs,
  type PlanContext,
  replacedMemberships,
  summarizePlan,
} from "@/lib/big-events/import/plan-summary";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import { PARTICIPANT_CAMPUS_IDS } from "@/lib/big-events/participant-form";
import { logAuditEvent } from "./audit-log";
import { findSuggestions } from "./big-event-linking";
import { getBigEvent } from "./big-events";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type GrantedAccess = Exclude<BigEventAccess, null>;

const DATABASE_ID = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const GROUPS = BIG_EVENT_TABLES.groups;
const MEMBERS = BIG_EVENT_TABLES.groupMembers;
/** The admin's server action body limit. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;
const WRITE_CONCURRENCY = 8;
const SUGGESTION_CAP = 200;
const BUS_LEGS: GroupLeg[] = ["out", "home"];

const mappingSchema = z.object({
  columns: z.array(z.enum(IMPORT_FIELDS)).max(MAX_COLUMNS),
});
const optionsSchema = z.object({
  defaultCampusId: z.enum(PARTICIPANT_CAMPUS_IDS).nullable(),
  groupKind: z.enum(GROUP_KINDS).nullable(),
  roomBookings: z.boolean(),
});

/** Spreadsheet text can be longer than a column allows; cut rather than fail. */
const COLUMN_LIMITS = {
  first_name: 100,
  group_name: 200,
  last_name: 100,
  phone: 32,
  source_key: 200,
  ticket_category: 200,
  ticket_email: 320,
  ticket_ref: 64,
} as const;

function cut(value: string | null, limit: number): string | null {
  return value === null ? null : value.slice(0, limit);
}

async function requireBigEvent(bigEventId: string) {
  const found = await getBigEvent(bigEventId);
  if (!found) {
    throw new Error("This big event doesn't exist or you can't see it");
  }
  return found;
}

function fileName(file: Blob): string {
  return "name" in file && typeof file.name === "string"
    ? file.name.toLowerCase()
    : "";
}

/** The uploaded file (`file`) or the pasted rows (`paste`), as rows of text. */
async function readRows(form: FormData): Promise<string[][]> {
  const file = form.get("file");
  const paste = form.get("paste");
  let rows: string[][];
  if (file instanceof Blob) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("The file is too big");
    }
    const name = fileName(file);
    if (name.endsWith(".xlsx")) {
      rows = await parseImportFile({
        data: await file.arrayBuffer(),
        kind: "xlsx",
      });
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      rows = await parseImportFile({ kind: "csv", text: await file.text() });
    } else {
      throw new Error("Only .xlsx and .csv files can be read");
    }
  } else if (typeof paste === "string" && paste.trim() !== "") {
    if (paste.length > MAX_FILE_BYTES) {
      throw new Error("Too many rows were pasted");
    }
    rows = await parseImportFile({ kind: "paste", text: paste });
  } else {
    throw new Error("Choose a file or paste rows");
  }
  if (rows.length > MAX_ROWS) {
    throw new Error("The file has too many rows");
  }
  return rows;
}

interface PreparedImport extends PlanContext {
  plan: ImportPlan;
}

/**
 * Plans the import against what the caller may see: their campus's
 * participants and groups. Rows for other campuses are left out and counted.
 */
async function prepareImport(
  db: AdminDb,
  bigEventId: string,
  access: GrantedAccess,
  rows: string[][],
  mapping: ImportMapping,
  options: ImportOptions
): Promise<PreparedImport> {
  const headerRow = findHeaderRow(rows);
  if (headerRow === -1) {
    throw new Error("The file has no rows");
  }
  const parsed = parsePeople(rows, headerRow, mapping, options);
  const people = parsed.people.filter((person) =>
    canSeeParticipant(access, { campus_id: person.campusId })
  );
  const scope = [
    Query.equal("big_event_id", [bigEventId]),
    ...participantCampusFilter(access),
  ];
  const [existing, groups] = await Promise.all([
    listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, scope),
    listAllRows<BigEventGroupRow>(db, GROUPS, scope),
  ]);
  const members = await listRowsByIds<BigEventGroupMemberRow>(
    db,
    MEMBERS,
    "group_id",
    groups.map((group) => group.$id),
    [Query.equal("big_event_id", [bigEventId])]
  );
  const plan = planImport({
    ...parsed,
    people,
    options,
    existing,
    groups,
    members,
  });
  return {
    existing,
    groupColumn: parsed.groupColumn,
    groups,
    members,
    options,
    outsideYourCampus: parsed.people.length - people.length,
    plan,
  };
}

/** Reads the file, the mapping and the options again: nothing is kept between steps. */
async function loadImport(
  bigEventId: string,
  form: FormData,
  mapping: ImportMapping,
  options: ImportOptions
): Promise<{ db: AdminDb; prepared: PreparedImport }> {
  const { access, event } = await requireBigEvent(bigEventId);
  const checkedMapping = mappingSchema.parse(mapping);
  const checkedOptions = optionsSchema.parse(options);
  // Spec D5: buses exist only when Travel is on (ruling R30).
  if (checkedOptions.groupKind === "bus" && !event.travel_enabled) {
    throw new Error("Buses need Travel turned on for this big event");
  }
  const rows = await readRows(form);
  const { db } = await createAdminClient();
  const prepared = await prepareImport(
    db,
    bigEventId,
    access,
    rows,
    checkedMapping,
    checkedOptions
  );
  return { db, prepared };
}

/**
 * Step 1 of the wizard: what each column looks like it holds. Known column
 * names first; the AI only sees the headers and value shapes of the rest.
 */
export async function readImportFile(
  bigEventId: string,
  form: FormData
): Promise<ImportColumns> {
  await requireBigEvent(bigEventId);
  const rows = await readRows(form);
  const detected = detectColumns(rows);
  const forAi = columnsForAi(rows, detected);
  const suggestions = forAi.length > 0 ? await suggestColumnsWithAi(forAi) : {};
  return withAiSuggestions(rows, detected, suggestions);
}

/** Step 3: what saving would do. Writes nothing. */
export async function previewImport(
  bigEventId: string,
  form: FormData,
  mapping: ImportMapping,
  options: ImportOptions
): Promise<ImportPreview> {
  const { prepared } = await loadImport(bigEventId, form, mapping, options);
  return summarizePlan(prepared.plan, prepared);
}

function newParticipantColumns(
  bigEventId: string,
  person: ParsedPerson,
  importId: string
) {
  return {
    big_event_id: bigEventId,
    campus_id: person.campusId,
    first_name: cut(person.firstName, COLUMN_LIMITS.first_name),
    last_import_id: importId,
    last_name: cut(person.lastName, COLUMN_LIMITS.last_name),
    // Already normalized by `parsePeople`.
    phone: cut(person.phone, COLUMN_LIMITS.phone),
    room_size: person.roomSize,
    ticket_category: cut(person.ticketCategory, COLUMN_LIMITS.ticket_category),
    ticket_email: cut(person.email, COLUMN_LIMITS.ticket_email),
    ticket_ref: cut(person.ticketRef, COLUMN_LIMITS.ticket_ref),
  };
}

/** Participant ids for plan targets: new people by their new row. */
class TargetIds {
  readonly #created = new Map<ParsedPerson, string>();

  add(person: ParsedPerson, id: string): void {
    this.#created.set(person, id);
  }

  of(target: PlacementTarget | null): string | null {
    if (target === null) {
      return null;
    }
    return isExistingTarget(target)
      ? target.participantId
      : (this.#created.get(target) ?? null);
  }
}

function newGroupColumns(
  bigEventId: string,
  group: NewGroup,
  targets: TargetIds
) {
  return {
    big_event_id: bigEventId,
    booking_participant_id: targets.of(group.booker),
    campus_id: group.campusId,
    capacity: group.capacity,
    kind: group.kind,
    name: cut(group.name, COLUMN_LIMITS.group_name) ?? "",
    source_key: cut(group.key, COLUMN_LIMITS.source_key),
  };
}

/** What one write phase did. Counts only: they go into the audit log. */
interface PhaseCount {
  failed: number;
  written: number;
}

type PhaseName = "created" | "updated" | "groups" | "places" | "removed_places";

/**
 * Runs every write of a phase to the end, even when some fail (ruling R28),
 * so nothing is still writing when the next phase or the caller looks.
 */
async function settleWrites<T, R>(
  items: T[],
  write: (item: T) => Promise<R>
): Promise<{ count: PhaseCount; done: R[] }> {
  const results = await mapAllSettledWithConcurrency(
    items,
    WRITE_CONCURRENCY,
    write
  );
  const done: R[] = [];
  const errors: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      done.push(result.value);
    } else {
      errors.push(result.reason);
    }
  }
  if (errors.length > 0) {
    console.error(
      `[big-events] ${errors.length} import writes failed; the first:`,
      errors[0]
    );
  }
  return { count: { failed: errors.length, written: done.length }, done };
}

/** What the writes did; `complete` only when every phase wrote everything. */
interface WriteOutcome {
  complete: boolean;
  created: BigEventParticipantRow[];
  moved: number;
  newGroups: number;
  phases: Partial<Record<PhaseName, PhaseCount>>;
  placed: number;
  /** Everyone created or updated: who may be linked by email. */
  seen: BigEventParticipantRow[];
  unchanged: number;
  updated: number;
}

function emptyOutcome(): WriteOutcome {
  return {
    complete: false,
    created: [],
    moved: 0,
    newGroups: 0,
    phases: {},
    placed: 0,
    seen: [],
    unchanged: 0,
    updated: 0,
  };
}

function createParticipants(
  db: AdminDb,
  bigEventId: string,
  plan: ImportPlan,
  importId: string,
  targets: TargetIds
) {
  return settleWrites(plan.create, async (person) => {
    // Appwrite returns every column, unset ones as null.
    const row = (await db.createRow(
      DATABASE_ID,
      PARTICIPANTS,
      ID.unique(),
      newParticipantColumns(bigEventId, person, importId)
    )) as unknown as BigEventParticipantRow;
    targets.add(person, row.$id);
    return row;
  });
}

function updateParticipants(
  db: AdminDb,
  prepared: PreparedImport,
  importId: string
) {
  const byId = new Map(prepared.existing.map((row) => [row.$id, row]));
  return settleWrites(
    prepared.plan.update,
    async ({ changes, participantId }) => {
      // A new ticket email kills the old connect link (ruling R36).
      const columns = {
        ...changes,
        ...("ticket_email" in changes ? CLEARED_CONNECT_LINK : {}),
        last_import_id: importId,
      };
      await db.updateRow(DATABASE_ID, PARTICIPANTS, participantId, columns);
      return {
        changed: Object.keys(changes).length > 0,
        row: {
          ...byId.get(participantId),
          ...columns,
        } as BigEventParticipantRow,
      };
    }
  );
}

function createGroups(
  db: AdminDb,
  bigEventId: string,
  prepared: PreparedImport,
  targets: TargetIds
) {
  return settleWrites(prepared.plan.newGroups, async (group) => {
    const row = await db.createRow(
      DATABASE_ID,
      GROUPS,
      ID.unique(),
      newGroupColumns(bigEventId, group, targets)
    );
    return [group.key, { id: row.$id, kind: group.kind }] as const;
  });
}

type GroupIds = Map<string, { id: string; kind: GroupKind }>;

/** Every group id by plan key, existing or just created, with its kind. */
function groupIdsByKey(
  groups: BigEventGroupRow[],
  created: (readonly [string, { id: string; kind: GroupKind }])[]
): GroupIds {
  const byKey: GroupIds = new Map();
  for (const [key, group] of groupsByKey(groups)) {
    byKey.set(key, { id: group.$id, kind: group.kind });
  }
  for (const [key, group] of created) {
    byKey.set(key, group);
  }
  return byKey;
}

/**
 * One membership per placement (a bus seat both ways), plus the missing leg
 * of a bus seat someone already half has (ruling R34).
 */
function createPlaces(
  db: AdminDb,
  bigEventId: string,
  plan: ImportPlan,
  missingLegs: MissingLeg[],
  groupIds: GroupIds,
  targets: TargetIds
) {
  const assignedAt = new Date().toISOString();
  const placementRows = plan.placements.flatMap((placement, index) => {
    const participantId = targets.of(placement.person);
    const group = groupIds.get(placement.groupKey);
    if (!(participantId && group)) {
      return [];
    }
    const legs: (GroupLeg | null)[] = group.kind === "bus" ? BUS_LEGS : [null];
    return legs.map((leg) => ({
      index,
      row: {
        assigned_at: assignedAt,
        big_event_id: bigEventId,
        group_id: group.id,
        leg,
        participant_id: participantId,
        pinned: false,
      },
    }));
  });
  const legRows = missingLegs.flatMap(({ groupKey, leg, participantId }) => {
    const group = groupIds.get(groupKey);
    return group
      ? [
          {
            index: null,
            row: {
              assigned_at: assignedAt,
              big_event_id: bigEventId,
              group_id: group.id,
              leg,
              participant_id: participantId,
              pinned: false,
            },
          },
        ]
      : [];
  });
  return settleWrites(
    [...placementRows, ...legRows],
    async ({ index, row }) => {
      await db.createRow(DATABASE_ID, MEMBERS, ID.unique(), row);
      return index;
    }
  );
}

/**
 * Writes the plan phase by phase and stops before the next phase when any
 * write failed (ruling R28). Old places of moved people (R8) are removed
 * last, only once every new place is written.
 */
async function writePlan(
  db: AdminDb,
  bigEventId: string,
  prepared: PreparedImport,
  importId: string
): Promise<WriteOutcome> {
  const { plan } = prepared;
  const outcome = emptyOutcome();
  const targets = new TargetIds();
  const finished = (phase: PhaseName, count: PhaseCount): boolean => {
    outcome.phases[phase] = count;
    return count.failed === 0;
  };

  const created = await createParticipants(
    db,
    bigEventId,
    plan,
    importId,
    targets
  );
  outcome.created = created.done;
  outcome.seen.push(...created.done);
  if (!finished("created", created.count)) {
    return outcome;
  }

  const updated = await updateParticipants(db, prepared, importId);
  outcome.seen.push(...updated.done.map((entry) => entry.row));
  outcome.updated = updated.done.filter((entry) => entry.changed).length;
  outcome.unchanged = updated.done.length - outcome.updated;
  if (!finished("updated", updated.count)) {
    return outcome;
  }

  const groups = await createGroups(db, bigEventId, prepared, targets);
  outcome.newGroups = groups.done.length;
  if (!finished("groups", groups.count)) {
    return outcome;
  }

  const groupIds = groupIdsByKey(prepared.groups, groups.done);
  const places = await createPlaces(
    db,
    bigEventId,
    plan,
    missingBusLegs(plan, prepared.groups, prepared.members),
    groupIds,
    targets
  );
  outcome.placed = new Set(places.done.filter((index) => index !== null)).size;
  if (!finished("places", places.count)) {
    return outcome;
  }

  const replaced = replacedMemberships(plan, prepared.groups, prepared.members);
  const removed = await settleWrites(replaced, async (membership) => {
    await db.deleteRow(DATABASE_ID, MEMBERS, membership.$id);
    return membership.participant_id;
  });
  outcome.moved = new Set(removed.done).size;
  if (!finished("removed_places", removed.count)) {
    return outcome;
  }

  outcome.complete = true;
  return outcome;
}

/**
 * Links people whose ticket email is a BI-linked account's email. Email alone
 * never identifies a person: an address on more than one ticket anywhere in
 * the big event links none of them (ruling R29).
 */
async function linkByEmail(
  db: AdminDb,
  bigEventId: string,
  seen: BigEventParticipantRow[]
): Promise<Set<string>> {
  const unlinked = seen.filter((row) => !row.user_id && row.ticket_email);
  const emails = [
    ...new Set(unlinked.flatMap((row) => row.ticket_email ?? [])),
  ];
  const linked = new Set<string>();
  if (emails.length === 0) {
    return linked;
  }
  const holders = await listRowsByIds<BigEventParticipantRow>(
    db,
    PARTICIPANTS,
    "ticket_email",
    emails,
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.select(["$id", "ticket_email"]),
    ]
  );
  const tickets = new Map<string, number>();
  for (const row of holders) {
    if (row.ticket_email) {
      tickets.set(row.ticket_email, (tickets.get(row.ticket_email) ?? 0) + 1);
    }
  }
  const candidates = unlinked.filter(
    (row) => row.ticket_email && tickets.get(row.ticket_email) === 1
  );
  const accounts = await findBiLinkedAccountsByEmail(
    db,
    candidates.flatMap((row) => row.ticket_email ?? [])
  );
  // One at a time: each link checks the account holds no other ticket here.
  for (const row of candidates) {
    const userId = row.ticket_email
      ? accounts.get(row.ticket_email)
      : undefined;
    if (!userId) {
      continue;
    }
    try {
      const result = await linkParticipant(db, {
        method: "email",
        participant: row,
        userId,
      });
      if (result.ok) {
        linked.add(row.$id);
      }
    } catch (error) {
      console.error("[big-events] Couldn't link a ticket by email:", error);
    }
  }
  return linked;
}

/** Email linking never fails the import; whoever isn't linked gets a connect email later. */
async function linkNewTickets(
  db: AdminDb,
  bigEventId: string,
  seen: BigEventParticipantRow[]
): Promise<Set<string>> {
  try {
    return await linkByEmail(db, bigEventId, seen);
  } catch (error) {
    console.error("[big-events] Couldn't link tickets by email:", error);
    return new Set();
  }
}

/** Possible matches for new people still unlinked; a failure here never fails the import. */
async function suggestForNew(
  bigEventId: string,
  created: BigEventParticipantRow[],
  linked: Set<string>
): Promise<number> {
  const ids = created
    .filter((row) => !linked.has(row.$id))
    .slice(0, SUGGESTION_CAP)
    .map((row) => row.$id);
  if (ids.length === 0) {
    return 0;
  }
  try {
    return (await findSuggestions(bigEventId, ids)).suggested;
  } catch (error) {
    console.error("[big-events] Couldn't look for possible matches:", error);
    return 0;
  }
}

function toResult(
  outcome: WriteOutcome,
  prepared: PreparedImport,
  linked: number,
  suggested: number
): ImportResult {
  const phases = Object.values(outcome.phases);
  return {
    complete: outcome.complete,
    created: outcome.created.length,
    failed: phases.reduce((sum, phase) => sum + phase.failed, 0),
    linked,
    moved: outcome.moved,
    newGroups: outcome.newGroups,
    outsideYourCampus: prepared.outsideYourCampus,
    placed: outcome.placed,
    skipped: prepared.plan.skipped.length,
    suggested,
    unchanged: outcome.unchanged,
    updated: outcome.updated,
    written: phases.reduce((sum, phase) => sum + phase.written, 0),
  };
}

/** A save refused before any write: nothing was changed. */
const NOTHING_WRITTEN: ImportResult = {
  complete: false,
  created: 0,
  failed: 0,
  linked: 0,
  moved: 0,
  newGroups: 0,
  outsideYourCampus: 0,
  placed: 0,
  skipped: 0,
  suggested: 0,
  unchanged: 0,
  updated: 0,
  written: 0,
};

/**
 * Step 3, "Save": plans again from the file (a plan from the browser is never
 * trusted), writes people, groups and places phase by phase, then links by
 * email and looks for possible matches. Every attempt is audited, with
 * counts only, even when a write failed.
 */
export async function applyImport(
  bigEventId: string,
  form: FormData,
  mapping: ImportMapping,
  options: ImportOptions
): Promise<ImportResult> {
  const ctx = await requireAuth();
  let loaded: Awaited<ReturnType<typeof loadImport>>;
  try {
    loaded = await loadImport(bigEventId, form, mapping, options);
  } catch (error) {
    // Redirects and other Next.js signals pass through.
    unstable_rethrow(error);
    // Refused before any write (no access, Travel off, unreadable file):
    // the wizard can say nothing was changed.
    console.error("[big-events] An import was refused:", error);
    await logAuditEvent(ctx, "big_event.import", {
      payload: { complete: false, refused: true },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    return NOTHING_WRITTEN;
  }
  const { db, prepared } = loaded;
  const importId = ID.unique();
  let outcome = emptyOutcome();
  let linked = new Set<string>();
  let suggested = 0;
  try {
    outcome = await writePlan(db, bigEventId, prepared, importId);
    if (outcome.complete) {
      linked = await linkNewTickets(db, bigEventId, outcome.seen);
      suggested = await suggestForNew(bigEventId, outcome.created, linked);
    }
  } finally {
    const { phases, complete } = outcome;
    // Counts only: no names, emails or phones in the audit log.
    await logAuditEvent(ctx, "big_event.import", {
      payload: {
        complete,
        import_id: importId,
        linked: linked.size,
        outside_your_campus: prepared.outsideYourCampus,
        phases,
        skipped: prepared.plan.skipped.length,
        suggested,
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidatePath("/big-events");
    revalidatePath(`/big-events/${bigEventId}`, "layout");
  }
  return toResult(outcome, prepared, linked.size, suggested);
}
