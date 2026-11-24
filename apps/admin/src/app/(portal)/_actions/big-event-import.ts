"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
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
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
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

/** What saving an import did, in counts. */
export interface ImportResult {
  created: number;
  /** Connected to their BI account by ticket email. */
  linked: number;
  moved: number;
  newGroups: number;
  outsideYourCampus: number;
  placed: number;
  skipped: number;
  /** Got a "possible match" to confirm. */
  suggested: number;
  unchanged: number;
  updated: number;
}

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
  const { access } = await requireBigEvent(bigEventId);
  const checkedMapping = mappingSchema.parse(mapping);
  const checkedOptions = optionsSchema.parse(options);
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

async function writeParticipants(
  db: AdminDb,
  bigEventId: string,
  plan: ImportPlan,
  existing: BigEventParticipantRow[],
  importId: string,
  targets: TargetIds
): Promise<{
  created: BigEventParticipantRow[];
  seen: BigEventParticipantRow[];
}> {
  const created = await mapWithConcurrency(
    plan.create,
    WRITE_CONCURRENCY,
    async (person) => {
      // Appwrite returns every column, unset ones as null.
      const row = (await db.createRow(
        DATABASE_ID,
        PARTICIPANTS,
        ID.unique(),
        newParticipantColumns(bigEventId, person, importId)
      )) as unknown as BigEventParticipantRow;
      targets.add(person, row.$id);
      return row;
    }
  );
  const byId = new Map(existing.map((row) => [row.$id, row]));
  const updated = await mapWithConcurrency(
    plan.update,
    WRITE_CONCURRENCY,
    async ({ changes, participantId }) => {
      const columns = { ...changes, last_import_id: importId };
      await db.updateRow(DATABASE_ID, PARTICIPANTS, participantId, columns);
      return {
        ...byId.get(participantId),
        ...columns,
      } as BigEventParticipantRow;
    }
  );
  return { created, seen: [...created, ...updated] };
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

/** Creates the new groups; returns every group id by plan key, with its kind. */
async function writeGroups(
  db: AdminDb,
  bigEventId: string,
  prepared: PreparedImport,
  targets: TargetIds
): Promise<Map<string, { id: string; kind: GroupKind }>> {
  const byKey = new Map<string, { id: string; kind: GroupKind }>();
  for (const [key, group] of groupsByKey(prepared.groups)) {
    byKey.set(key, { id: group.$id, kind: group.kind });
  }
  const created = await mapWithConcurrency(
    prepared.plan.newGroups,
    WRITE_CONCURRENCY,
    async (group) => {
      const row = await db.createRow(
        DATABASE_ID,
        GROUPS,
        ID.unique(),
        newGroupColumns(bigEventId, group, targets)
      );
      return [group.key, { id: row.$id, kind: group.kind }] as const;
    }
  );
  for (const [key, group] of created) {
    byKey.set(key, group);
  }
  return byKey;
}

/** Ruling R8 moves first, then one membership per placement (both legs for a bus). */
async function writeMemberships(
  db: AdminDb,
  bigEventId: string,
  prepared: PreparedImport,
  groupIds: Map<string, { id: string; kind: GroupKind }>,
  targets: TargetIds
): Promise<number> {
  const replaced = replacedMemberships(
    prepared.plan,
    prepared.groups,
    prepared.members
  );
  await mapWithConcurrency(replaced, WRITE_CONCURRENCY, (membership) =>
    db.deleteRow(DATABASE_ID, MEMBERS, membership.$id)
  );
  const assignedAt = new Date().toISOString();
  const rows = prepared.plan.placements.flatMap((placement) => {
    const participantId = targets.of(placement.person);
    const group = groupIds.get(placement.groupKey);
    if (!(participantId && group)) {
      return [];
    }
    const legs: (GroupLeg | null)[] = group.kind === "bus" ? BUS_LEGS : [null];
    return legs.map((leg) => ({
      assigned_at: assignedAt,
      big_event_id: bigEventId,
      group_id: group.id,
      leg,
      participant_id: participantId,
      pinned: false,
    }));
  });
  await mapWithConcurrency(rows, WRITE_CONCURRENCY, (row) =>
    db.createRow(DATABASE_ID, MEMBERS, ID.unique(), row)
  );
  return new Set(replaced.map((membership) => membership.participant_id)).size;
}

/**
 * Links people whose ticket email is a BI-linked account's email. Email alone
 * never identifies a person: an address on several tickets links none.
 */
async function linkByEmail(
  db: AdminDb,
  seen: BigEventParticipantRow[],
  everyone: BigEventParticipantRow[]
): Promise<Set<string>> {
  const holders = new Map<string, number>();
  for (const row of everyone) {
    if (row.ticket_email) {
      holders.set(row.ticket_email, (holders.get(row.ticket_email) ?? 0) + 1);
    }
  }
  const candidates = seen.filter(
    (row) =>
      !row.user_id && row.ticket_email && holders.get(row.ticket_email) === 1
  );
  const accounts = await findBiLinkedAccountsByEmail(
    db,
    candidates.flatMap((row) => row.ticket_email ?? [])
  );
  const linked = new Set<string>();
  // One at a time: each link checks the account holds no other ticket here.
  for (const row of candidates) {
    const userId = row.ticket_email
      ? accounts.get(row.ticket_email)
      : undefined;
    if (userId) {
      const result = await linkParticipant(db, {
        method: "email",
        participant: row,
        userId,
      });
      if (result.ok) {
        linked.add(row.$id);
      }
    }
  }
  return linked;
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

/**
 * Step 3, "Save": plans again from the file (a plan from the browser is never
 * trusted), writes people, groups and places, then links by email and looks
 * for possible matches.
 */
export async function applyImport(
  bigEventId: string,
  form: FormData,
  mapping: ImportMapping,
  options: ImportOptions
): Promise<ImportResult> {
  const ctx = await requireAuth();
  const { db, prepared } = await loadImport(bigEventId, form, mapping, options);
  const { plan } = prepared;
  const importId = ID.unique();
  const targets = new TargetIds();

  const { created, seen } = await writeParticipants(
    db,
    bigEventId,
    plan,
    prepared.existing,
    importId,
    targets
  );
  const groupIds = await writeGroups(db, bigEventId, prepared, targets);
  const moved = await writeMemberships(
    db,
    bigEventId,
    prepared,
    groupIds,
    targets
  );
  const seenIds = new Set(seen.map((row) => row.$id));
  const linked = await linkByEmail(db, seen, [
    ...seen,
    ...prepared.existing.filter((row) => !seenIds.has(row.$id)),
  ]);
  const suggested = await suggestForNew(bigEventId, created, linked);

  const summary = summarizePlan(plan, prepared);
  const result: ImportResult = {
    created: summary.created,
    linked: linked.size,
    moved,
    newGroups: summary.newGroups,
    outsideYourCampus: summary.outsideYourCampus,
    placed: summary.placed,
    skipped: summary.skipped,
    suggested,
    unchanged: summary.unchanged,
    updated: summary.updated,
  };
  // Counts only: no names, emails or phones in the audit log.
  await logAuditEvent(ctx, "big_event.import", {
    payload: { import_id: importId, ...result },
    resourceId: bigEventId,
    resourceType: "big_event",
  });
  revalidatePath("/big-events");
  revalidatePath(`/big-events/${bigEventId}`, "layout");
  return result;
}
