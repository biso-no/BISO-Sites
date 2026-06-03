"use server";

import { ID, Permission, Query, Role } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import {
  type Announcements,
  AnnouncementsAudienceType,
  AnnouncementsStatus,
  type EventAttendees,
  type EventSegments,
  type Events,
  type SegmentMembers,
  type Users,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { assertWriteAccess, hasRowAccess } from "@/lib/utils/authorization";
import { sendAnnouncement } from "./announcements";
import { logAuditEvent } from "./audit-log";
import {
  type MessageSegmentValues,
  messageSegmentSchema,
  type SegmentFormValues,
  segmentSchema,
} from "./schemas";

const EMAIL_PATTERN = /@/;
const CSV_LINE_SPLIT = /\r?\n/;
const ATTENDEE_PAGE_SIZE = 200;

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

type SessionDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

/**
 * Load an event and assert the caller can see it (campus/department scope).
 * Returns null when missing or out of scope so callers fail closed.
 */
async function loadScopedEvent(
  db: SessionDb,
  ctx: UserAuthContext,
  eventId: string
): Promise<Events | null> {
  const response = await db.listRows<Events>("app", "events", [
    Query.equal("$id", eventId),
    Query.limit(1),
  ]);
  const event = response.rows[0];
  if (!(event && hasRowAccess(ctx, event.campus_id, event.department_id))) {
    return null;
  }
  return event;
}

async function loadSegment(
  db: SessionDb,
  segmentId: string
): Promise<EventSegments | null> {
  const response = await db.listRows<EventSegments>("app", "event_segments", [
    Query.equal("$id", segmentId),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

function serializeMetadata(
  metadata: SegmentFormValues["metadata"]
): string | null {
  if (!metadata) {
    return null;
  }
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );
  if (entries.length === 0) {
    return null;
  }
  return JSON.stringify(Object.fromEntries(entries));
}

function buildSegmentColumns(
  values: SegmentFormValues
): Record<string, unknown> {
  return {
    event_id: values.event_id,
    kind: values.kind || null,
    name: values.name,
    campus_id: values.campus_id || null,
    capacity: values.capacity,
    metadata: serializeMetadata(values.metadata),
    topic_id: values.topic_id || null,
  };
}

async function countSegmentMembers(
  db: SessionDb,
  segmentId: string
): Promise<number> {
  const response = await db.listRows<SegmentMembers>("app", "segment_members", [
    Query.equal("segment_id", segmentId),
    Query.limit(1),
  ]);
  return response.total;
}

export type SegmentWithCount = EventSegments & { member_count: number };

export async function listSegments(
  eventId: string
): Promise<SegmentWithCount[]> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const event = await loadScopedEvent(db, ctx, eventId);
  if (!event) {
    return [];
  }

  const response = await db.listRows<EventSegments>("app", "event_segments", [
    Query.equal("event_id", eventId),
    Query.orderAsc("name"),
    Query.limit(200),
  ]);

  // segment_members rows are readable only by their assigned user (row
  // security), so counts must come from the service-key client or every
  // segment shows 0 members to admins.
  const { db: adminDb } = await createAdminClient();
  return await Promise.all(
    response.rows.map(async (segment) => ({
      ...segment,
      member_count: await countSegmentMembers(adminDb, segment.$id),
    }))
  );
}

export async function createSegment(values: SegmentFormValues) {
  const ctx = await requireAuth();
  const validated = segmentSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const { db } = await createSessionClient();
    const event = await loadScopedEvent(db, ctx, validated.data.event_id);
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const segment = await db.createRow(
      "app",
      "event_segments",
      ID.unique(),
      buildSegmentColumns({
        ...validated.data,
        campus_id: validated.data.campus_id ?? event.campus_id,
      })
    );

    await logAuditEvent(ctx, "event_segment.create", {
      resourceId: segment.$id,
      resourceType: "event_segment",
      payload: { event_id: validated.data.event_id, kind: validated.data.kind },
    });

    revalidatePath(`/events/${validated.data.event_id}/segments`);
    return { data: segment.$id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create segment",
    };
  }
}

export async function updateSegment(id: string, values: SegmentFormValues) {
  const ctx = await requireAuth();
  const validated = segmentSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const { db } = await createSessionClient();
    const segment = await loadSegment(db, id);
    if (!segment) {
      return { error: "Segment not found" };
    }
    const event = await loadScopedEvent(db, ctx, segment.event_id ?? "");
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    // event_segments has rowSecurity disabled and no collection-level update
    // permission, so writes go through the service-key client (authorization is
    // enforced above via assertWriteAccess).
    const { db: adminDb } = await createAdminClient();
    await adminDb.updateRow(
      "app",
      "event_segments",
      id,
      buildSegmentColumns({
        ...validated.data,
        event_id: segment.event_id ?? validated.data.event_id,
        campus_id: validated.data.campus_id ?? event.campus_id,
      })
    );

    await logAuditEvent(ctx, "event_segment.update", {
      resourceId: id,
      resourceType: "event_segment",
    });

    revalidatePath(`/events/${segment.event_id}/segments`);
    return { data: id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update segment",
    };
  }
}

export async function deleteSegment(id: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();
    const segment = await loadSegment(db, id);
    if (!segment) {
      return { error: "Segment not found" };
    }
    const event = await loadScopedEvent(db, ctx, segment.event_id ?? "");
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    // Member rows carry per-user permissions and event_segments has no
    // collection-level delete permission, so deletes use the service-key client
    // (authorization is enforced above via assertWriteAccess).
    const { db: adminDb } = await createAdminClient();

    // Remove member rows first so we don't leave orphans.
    const members = await db.listRows<SegmentMembers>(
      "app",
      "segment_members",
      [Query.equal("segment_id", id), Query.limit(1000)]
    );
    await Promise.all(
      members.rows.map((member) =>
        adminDb.deleteRow("app", "segment_members", member.$id)
      )
    );
    await adminDb.deleteRow("app", "event_segments", id);

    await logAuditEvent(ctx, "event_segment.delete", {
      resourceId: id,
      resourceType: "event_segment",
    });

    revalidatePath(`/events/${segment.event_id}/segments`);
    return { data: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete segment",
    };
  }
}

// ---------------------------------------------------------------------------
// Attendees: CSV import + matching
// ---------------------------------------------------------------------------

interface ParsedAttendee {
  email: string | null;
  name: string | null;
  order_ref: string | null;
  phone: string | null;
  ticket_type: string | null;
}

/** Split a single CSV line, honoring double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

const HEADER_ALIASES: Record<string, keyof ParsedAttendee> = {
  email: "email",
  "e-mail": "email",
  "email address": "email",
  name: "name",
  "full name": "name",
  attendee: "name",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  ticket_type: "ticket_type",
  "ticket type": "ticket_type",
  ticket: "ticket_type",
  type: "ticket_type",
  order_ref: "order_ref",
  "order ref": "order_ref",
  "order reference": "order_ref",
  order: "order_ref",
  "order id": "order_ref",
  reference: "order_ref",
};

function buildColumnMap(
  headerCells: string[]
): Map<number, keyof ParsedAttendee> {
  const map = new Map<number, keyof ParsedAttendee>();
  headerCells.forEach((raw, index) => {
    const key = HEADER_ALIASES[raw.toLowerCase()];
    if (key) {
      map.set(index, key);
    }
  });
  return map;
}

function parseCsv(csvText: string): ParsedAttendee[] {
  const lines = csvText
    .split(CSV_LINE_SPLIT)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return [];
  }

  const columnMap = buildColumnMap(splitCsvLine(lines[0]));
  if (columnMap.size === 0) {
    return [];
  }

  const rows: ParsedAttendee[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const record: ParsedAttendee = {
      email: null,
      name: null,
      phone: null,
      ticket_type: null,
      order_ref: null,
    };
    for (const [index, field] of columnMap) {
      const value = cells[index]?.trim();
      record[field] = value ? value : null;
    }
    // Synthesize a stable order_ref from the email when none is supplied so the
    // unique (event_id, order_ref) index can dedupe re-imports.
    if (!record.order_ref && record.email) {
      record.order_ref = `email:${record.email.toLowerCase()}`;
    }
    if (record.email || record.order_ref) {
      rows.push(record);
    }
  }
  return rows;
}

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

async function matchAttendeeUser(
  admin: AdminClient,
  email: string | null
): Promise<{ userId: string | null; campusId: string | null }> {
  if (!(email && EMAIL_PATTERN.test(email))) {
    return { userId: null, campusId: null };
  }
  try {
    // `users.list(search)` is a fuzzy search — verify exact email equality so a
    // partial/typo'd address can't match (and assign PII to) the wrong account.
    const found = await admin.users.list([Query.limit(5)], email);
    const user = found.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      return { userId: null, campusId: null };
    }
    let campusId: string | null = null;
    try {
      const profile = await admin.db.getRow<Users>("app", "user", user.$id);
      campusId = profile.campus_id ?? null;
    } catch {
      // No profile row yet — leave campus null.
    }
    return { userId: user.$id, campusId };
  } catch {
    return { userId: null, campusId: null };
  }
}

export interface ImportSummary {
  imported: number;
  matched: number;
  skipped: number;
}

export async function importAttendeesCsv(
  eventId: string,
  csvText: string,
  _opts?: Record<string, never>
): Promise<{ data?: ImportSummary; error?: string }> {
  const ctx = await requireAuth();

  try {
    const { db: sessionDb } = await createSessionClient();
    const event = await loadScopedEvent(sessionDb, ctx, eventId);
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      return { error: "No attendee rows found. Check the CSV header row." };
    }

    const admin = await createAdminClient();
    const summary: ImportSummary = { imported: 0, matched: 0, skipped: 0 };

    for (const row of parsed) {
      if (!row.order_ref) {
        summary.skipped += 1;
        continue;
      }

      const match = await matchAttendeeUser(admin, row.email);
      if (match.userId) {
        summary.matched += 1;
      }

      const data = {
        event_id: eventId,
        email: row.email,
        name: row.name,
        phone: row.phone,
        ticket_type: row.ticket_type,
        order_ref: row.order_ref,
        source: "csv",
        matched_user_id: match.userId,
        campus_id: match.campusId ?? event.campus_id ?? null,
      };

      const existing = await admin.db.listRows<EventAttendees>(
        "app",
        "event_attendees",
        [
          Query.equal("event_id", eventId),
          Query.equal("order_ref", row.order_ref),
          Query.limit(1),
        ]
      );

      if (existing.rows[0]) {
        await admin.db.updateRow(
          "app",
          "event_attendees",
          existing.rows[0].$id,
          data
        );
      } else {
        await admin.db.createRow("app", "event_attendees", ID.unique(), data);
      }
      summary.imported += 1;
    }

    await logAuditEvent(ctx, "event_attendee.import", {
      resourceId: eventId,
      resourceType: "event",
      payload: { ...summary },
    });

    revalidatePath(`/events/${eventId}/segments`);
    return { data: summary };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to import attendees",
    };
  }
}

export async function listAttendees(
  eventId: string
): Promise<EventAttendees[]> {
  const ctx = await requireAuth();
  const { db: sessionDb } = await createSessionClient();

  const event = await loadScopedEvent(sessionDb, ctx, eventId);
  if (!event) {
    return [];
  }

  const { db } = await createAdminClient();
  const rows: EventAttendees[] = [];
  let cursor: string | null = null;

  for (;;) {
    const queries: string[] = [
      Query.equal("event_id", eventId),
      Query.orderAsc("name"),
      Query.limit(ATTENDEE_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await db.listRows<EventAttendees>(
      "app",
      "event_attendees",
      queries
    );
    rows.push(...page.rows);
    if (page.rows.length < ATTENDEE_PAGE_SIZE) {
      break;
    }
    cursor = page.rows.at(-1)?.$id ?? null;
    if (!cursor) {
      break;
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Membership assignment
// ---------------------------------------------------------------------------

function memberPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export interface AssignResult {
  assigned: number;
  rejected: number;
  skipped: number;
}

export async function assignToSegment(
  segmentId: string,
  userIds: string[]
): Promise<{ data?: AssignResult; error?: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();
    const segment = await loadSegment(db, segmentId);
    if (!segment) {
      return { error: "Segment not found" };
    }
    const event = await loadScopedEvent(db, ctx, segment.event_id ?? "");
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    // segment_members rows are readable only by their assigned user (row
    // security), so an admin must read/write them with the service-key client —
    // otherwise existing members are invisible and capacity/dedup break.
    const { db: adminDb } = await createAdminClient();
    const existing = await adminDb.listRows<SegmentMembers>(
      "app",
      "segment_members",
      [Query.equal("segment_id", segmentId), Query.limit(1000)]
    );
    const alreadyAssigned = new Set(
      existing.rows.map((member) => member.user_id)
    );
    const currentCount = existing.rows.length;
    const capacity = segment.capacity ?? 0;

    const result: AssignResult = { assigned: 0, skipped: 0, rejected: 0 };
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    for (const userId of uniqueIds) {
      if (alreadyAssigned.has(userId)) {
        result.skipped += 1;
        continue;
      }
      // capacity 0 means "unlimited"; otherwise trim once full.
      if (capacity > 0 && currentCount + result.assigned >= capacity) {
        result.rejected += 1;
        continue;
      }
      try {
        await adminDb.createRow(
          "app",
          "segment_members",
          ID.unique(),
          {
            segment_id: segmentId,
            event_id: segment.event_id,
            user_id: userId,
            assigned_at: new Date().toISOString(),
          },
          memberPermissions(userId)
        );
        result.assigned += 1;
      } catch {
        // Likely a unique (segment_id, user_id) violation from a concurrent
        // assign — treat as already-a-member and keep processing the batch.
        result.skipped += 1;
      }
    }

    await logAuditEvent(ctx, "event_segment.assign", {
      resourceId: segmentId,
      resourceType: "event_segment",
      payload: { ...result },
    });

    revalidatePath(`/events/${segment.event_id}/segments`);
    return { data: result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to assign members",
    };
  }
}

export async function removeFromSegment(segmentId: string, userId: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();
    const segment = await loadSegment(db, segmentId);
    if (!segment) {
      return { error: "Segment not found" };
    }
    const event = await loadScopedEvent(db, ctx, segment.event_id ?? "");
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const existing = await db.listRows<SegmentMembers>(
      "app",
      "segment_members",
      [
        Query.equal("segment_id", segmentId),
        Query.equal("user_id", userId),
        Query.limit(1),
      ]
    );
    const member = existing.rows[0];
    if (member) {
      // The member row's delete permission belongs to the assigned user, so an
      // admin removes it via the service-key client.
      const { db: adminDb } = await createAdminClient();
      await adminDb.deleteRow("app", "segment_members", member.$id);
    }

    await logAuditEvent(ctx, "event_segment.remove", {
      resourceId: segmentId,
      resourceType: "event_segment",
      payload: { user_id: userId },
    });

    revalidatePath(`/events/${segment.event_id}/segments`);
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

// ---------------------------------------------------------------------------
// Auto-assign
// ---------------------------------------------------------------------------

export interface AutoAssignResult {
  segments: { segment_id: string; name: string; assigned: number }[];
  unassigned: number;
}

/**
 * Deterministically distribute matched attendees across the event's segments of
 * a given `kind`. Attendees are grouped by `campus_id`; for each campus we fill
 * that campus's segments in order (ordered by name) up to capacity. Already
 * assigned users are skipped, so re-running is idempotent.
 */
export async function autoAssign(
  eventId: string,
  opts: { kind: string }
): Promise<{ data?: AutoAssignResult; error?: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();
    const event = await loadScopedEvent(db, ctx, eventId);
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const segmentsResponse = await db.listRows<EventSegments>(
      "app",
      "event_segments",
      [
        Query.equal("event_id", eventId),
        Query.equal("kind", opts.kind),
        Query.orderAsc("name"),
        Query.limit(200),
      ]
    );
    const segments = segmentsResponse.rows;
    if (segments.length === 0) {
      return { error: `No segments of kind "${opts.kind}" to fill.` };
    }

    const admin = await createAdminClient();
    const attendees = await listAttendeesForEvent(admin, eventId);

    // Build per-segment live state: capacity + already-assigned user set.
    const assignedUsers = new Set<string>();
    const segmentState = await Promise.all(
      segments.map(async (segment) => {
        // Row security hides members from the admin's session client; read
        // them with the service-key client so counts/dedup are accurate.
        const members = await admin.db.listRows<SegmentMembers>(
          "app",
          "segment_members",
          [Query.equal("segment_id", segment.$id), Query.limit(1000)]
        );
        for (const member of members.rows) {
          assignedUsers.add(member.user_id);
        }
        return {
          segment,
          count: members.rows.length,
          assigned: 0,
        };
      })
    );

    const result: AutoAssignResult = { segments: [], unassigned: 0 };

    for (const attendee of attendees) {
      const userId = attendee.matched_user_id;
      if (!userId || assignedUsers.has(userId)) {
        continue;
      }

      const targetCampus = attendee.campus_id ?? event.campus_id ?? null;
      const target = segmentState.find((state) => {
        const segmentCampus =
          state.segment.campus_id ?? event.campus_id ?? null;
        const campusMatches =
          targetCampus === null || segmentCampus === targetCampus;
        const capacity = state.segment.capacity ?? 0;
        const hasRoom = capacity === 0 || state.count < capacity;
        return campusMatches && hasRoom;
      });

      if (!target) {
        result.unassigned += 1;
        continue;
      }

      await admin.db.createRow(
        "app",
        "segment_members",
        ID.unique(),
        {
          segment_id: target.segment.$id,
          event_id: eventId,
          user_id: userId,
          attendee_id: attendee.$id,
          assigned_at: new Date().toISOString(),
        },
        memberPermissions(userId)
      );
      assignedUsers.add(userId);
      target.count += 1;
      target.assigned += 1;
    }

    result.segments = segmentState.map((state) => ({
      segment_id: state.segment.$id,
      name: state.segment.name,
      assigned: state.assigned,
    }));

    await logAuditEvent(ctx, "event_segment.auto_assign", {
      resourceId: eventId,
      resourceType: "event",
      payload: { kind: opts.kind, unassigned: result.unassigned },
    });

    revalidatePath(`/events/${eventId}/segments`);
    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to auto-assign",
    };
  }
}

async function listAttendeesForEvent(
  admin: AdminClient,
  eventId: string
): Promise<EventAttendees[]> {
  const rows: EventAttendees[] = [];
  let cursor: string | null = null;

  for (;;) {
    const queries: string[] = [
      Query.equal("event_id", eventId),
      Query.orderAsc("$id"),
      Query.limit(ATTENDEE_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await admin.db.listRows<EventAttendees>(
      "app",
      "event_attendees",
      queries
    );
    rows.push(...page.rows);
    if (page.rows.length < ATTENDEE_PAGE_SIZE) {
      break;
    }
    cursor = page.rows.at(-1)?.$id ?? null;
    if (!cursor) {
      break;
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Message a segment
// ---------------------------------------------------------------------------

export async function messageSegment(
  segmentId: string,
  content: MessageSegmentValues
) {
  const ctx = await requireAuth();
  const validated = messageSegmentSchema.safeParse(content);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const { db } = await createSessionClient();
    const segment = await loadSegment(db, segmentId);
    if (!segment) {
      return { error: "Segment not found" };
    }
    const event = await loadScopedEvent(db, ctx, segment.event_id ?? "");
    if (!event) {
      return { error: "Event not found" };
    }
    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const eventId = segment.event_id ?? null;
    const announcement = await db.createRow<Announcements>(
      "app",
      "announcements",
      ID.unique(),
      {
        status: AnnouncementsStatus.DRAFT,
        category: validated.data.category,
        audience_type: AnnouncementsAudienceType.SEGMENT,
        audience_value: segmentId,
        title_en: validated.data.title_en,
        title_no: validated.data.title_no ?? null,
        body_en: validated.data.body_en ?? null,
        body_no: validated.data.body_no ?? null,
        event_id: eventId,
        campus_id: segment.campus_id ?? event.campus_id ?? null,
        push: validated.data.push,
        deep_link: eventId ? `biso://event?id=${eventId}` : null,
        data: null,
        scheduled_at: null,
        sent_at: null,
        created_by: ctx.userId,
      }
    );

    await logAuditEvent(ctx, "event_segment.message", {
      resourceId: segmentId,
      resourceType: "event_segment",
      payload: { announcement_id: announcement.$id },
    });

    // Flow through the single announcement delivery path.
    const sent = await sendAnnouncement(announcement.$id);
    if ("error" in sent && sent.error) {
      return { error: sent.error as string };
    }

    revalidatePath(`/events/${segment.event_id}/segments`);
    return { data: { announcement_id: announcement.$id } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to message segment",
    };
  }
}
