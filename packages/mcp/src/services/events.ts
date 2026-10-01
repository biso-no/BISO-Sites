/**
 * Event segments and attendees.
 *
 * Segments are one of the more valuable capabilities the current assistant does
 * not expose at all: `event_segments`, `segment_members` and `event_attendees`
 * back a real workflow (import a ticket list, assign people to segments,
 * message a segment) that today only exists in the admin UI.
 *
 * Reads only here, for two reasons that are worth stating rather than implying:
 *
 * - `messageSegment` sends to people. Outbound messaging is the `restricted`
 *   tier and this package does not execute it.
 * - `importAttendeesCsv` and `autoAssign` write rows in bulk from a file. A
 *   partial failure mid-import leaves a half-populated segment, and the admin
 *   action owns the recovery semantics for that.
 *
 * Attendee data is personal data from a ticketing import: names, emails and
 * phone numbers. The listing returns counts and segment membership; individual
 * contact details come back only from the explicit per-attendee fetch, and the
 * phone number never does.
 */

import { Query } from "@repo/api";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel } from "../identity/campus";
import type { Principal } from "../identity/principal";
import { canReadRow, rowOwnership } from "../identity/scope";
import { inWaves } from "../runtime/concurrency";
import { forbidden, fromAppwriteError, notFound } from "../runtime/errors";
import type { Projected } from "./row";

export interface SegmentSummary {
  campusId: string | null;
  campusLabel: string;
  capacity: number;
  eventId: string | null;
  id: string;
  kind: string | null;
  memberCount: number;
  /** True when `memberCount` hit `COUNT_CEILING` and is a floor, not a total. */
  memberCountTruncated: boolean;
  name: string;
  /**
   * Free capacity, or null when the segment is uncapped (`capacity` 0) or when
   * `memberCount` is a floor and the remainder cannot be computed.
   */
  remaining: number | null;
  /** Notification topic this segment maps to, when it has one. */
  topicId: string | null;
}

export interface EventAudience {
  assignedCount: number;
  attendeeCount: number;
  capacity: number;
  eventId: string;
  eventTitle: string | null;
  notes: string[];
  segments: SegmentSummary[];
  unassignedCount: number;
}

export interface EventsService {
  audience(
    principal: Principal,
    input: { eventId: string }
  ): Promise<EventAudience>;
  listSegments(
    principal: Principal,
    input: { eventId: string }
  ): Promise<SegmentList>;
}

/**
 * A page of an event's segments, and whether it is the whole set.
 *
 * `event_segments` has no per-event ceiling, and both surfaces here read one
 * bounded window. A window that came back full is a floor, not a total — and
 * a segment that is simply absent looks exactly like one that does not exist,
 * capacity and member counts included.
 */
export interface SegmentList {
  rows: SegmentSummary[];
  /** True when the read filled its window and later segments may exist. */
  truncated: boolean;
}

/**
 * Most segments either surface will read for one event.
 *
 * `apps/admin`'s own segment list requests 200, so a lower ceiling here would
 * make segments the portal shows plainly missing rather than merely capped.
 * Matching it keeps the two surfaces answering the same question, and
 * `truncated` covers the case beyond it instead of silence.
 */
const SEGMENT_LIMIT = 200;
/**
 * Most rows either audience count will read before reporting a floor.
 *
 * These counts used to be `Query.limit(1)` plus `listRows(...).total`, on the
 * premise that `total` is the full match count regardless of page size. That
 * premise is disputed — see `inboxCounts` in `./operations.ts` for the whole
 * argument — so they count returned rows instead, which is correct under
 * either reading. `$id`-only projection keeps the transfer small; an audience
 * preview reads no attendee row, name or address either way.
 */
const COUNT_CEILING = 2000;

/**
 * How many segment counts are in flight at once.
 *
 * Eight, not unbounded: firing all 200 at once would hand the backend a burst
 * this package has no business creating, and Appwrite would queue them anyway.
 * Eight turns 200 sequential round trips into 25, which is the difference
 * between passing the read timeout and not.
 */
const COUNT_CONCURRENCY = 8;

/** Most `segment_members` rows one audience preview will read. */
const MEMBER_SCAN_CEILING = 2000;

export function createEventsService(clients: BackendClients): EventsService {
  /**
   * Authorize against the parent event, not the segment.
   *
   * `event_segments`, `segment_members` and `event_attendees` all have
   * `rowSecurity: false` (and `event_attendees` has no table grants at all), so
   * Appwrite will not scope these for us. The event is the thing that carries
   * campus ownership, so that is what the check runs on.
   *
   * Ownership is read from the `campus`/`department` **relationships**, not the
   * legacy `campus_id`/`department_id` scalars. `events` carries both, and
   * mid-backfill they disagree — the scalar being the stale one. The portal's
   * own `event-segments.ts` calls `getContentOwnership(event, { legacyFallback:
   * true })` for exactly this read, and what follows this check is a
   * service-key path over tables Appwrite will not gate, so a stale scalar
   * here is the whole boundary.
   */
  async function assertEventAccess(
    principal: Principal,
    eventId: string
  ): Promise<{
    title: string | null;
    campusId: string | null;
    capacity: number;
  }> {
    try {
      const event = await clients.user.db.getRow<
        Projected<{
          campus?: string | { $id: string } | null;
          department?: string | { $id: string } | null;
          campus_id: string | null;
          department_id: string | null;
          capacity: number | null;
          status: string;
          translation_refs?: Array<{ locale: string; title: string }>;
        }>
      >("app", "events", eventId, [
        Query.select([
          "$id",
          "campus.$id",
          "department.$id",
          "campus_id",
          "department_id",
          "capacity",
          "status",
          "translation_refs.locale",
          "translation_refs.title",
        ]),
      ]);

      const ownership = rowOwnership(event, { legacyFallback: true });
      if (!canReadRow(principal, ownership.campusId, ownership.departmentId)) {
        throw forbidden(
          `You do not have access to event ${eventId}.`,
          { eventId, campusId: ownership.campusId },
          "Attendee and segment data is scoped to the campus that owns the event."
        );
      }

      const refs = event.translation_refs ?? [];
      return {
        title:
          refs.find((item) => item.locale === "no")?.title ??
          refs[0]?.title ??
          null,
        campusId: ownership.campusId,
        capacity: event.capacity ?? 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "DomainError") {
        throw error;
      }
      const mapped = fromAppwriteError(error, { operation: "read event" });
      if (mapped.code === "not_found" || mapped.code === "forbidden") {
        throw notFound(`No event ${eventId}.`, { eventId });
      }
      throw mapped;
    }
  }

  /**
   * Count matching rows through the service key, after the caller has already
   * been authorized against the parent event.
   *
   * The caller's own client cannot answer these questions:
   *
   * - `event_attendees` has `rowSecurity: false` and **no** table read grant,
   *   so a user credential cannot read it at all — authorized staff would get
   *   an error rather than a number.
   * - `segment_members` has `rowSecurity: true` and no table read grant, so a
   *   user credential sees only the rows individually granted to them. That
   *   does not fail loudly; it silently returns a smaller number, which is
   *   worse, because an audience preview that undercounts still looks like an
   *   answer.
   *
   * Elevation is therefore load-bearing and not a shortcut. It happens only
   * after `loadEvent` has run `canReadRow` against the event's own campus and
   * department, and only ever produces a count — no attendee row, name or
   * address is read or returned.
   *
   * `truncated` says the count is a floor because it reached `COUNT_CEILING`.
   * A caller that renders it as an exact figure would be claiming more than
   * this knows.
   */
  async function countRows(
    table: string,
    queries: string[]
  ): Promise<{ count: number; truncated: boolean }> {
    const { db } = clients.requireElevated(
      `count ${table} for an event audience (the table grants no read to user credentials)`
    );
    const result = await db.listRows("app", table, [
      ...queries,
      Query.select(["$id"]),
      Query.limit(COUNT_CEILING),
    ]);
    return {
      count: result.rows.length,
      truncated: result.rows.length === COUNT_CEILING,
    };
  }

  /**
   * How many *attendees* are assigned to a segment, not how many rows say so.
   *
   * `segment_members` is unique on `(segment_id, user_id)` only, and the admin
   * auto-assign path dedupes within one segment `kind` rather than across the
   * event — so a person in a bus segment and a workshop segment is two rows and
   * one attendee. Counting rows inflates `assignedCount`, and because
   * `unassignedCount` is `attendeeCount - assignedCount` it can report nobody
   * left to assign while attendees are in fact unassigned.
   *
   * Identity is `user_id`, which is the only column both assignment paths
   * write: the admin auto-assign path sets `attendee_id` as well, the manual
   * one does not, and the schema marks `user_id` required and `attendee_id`
   * optional. Keying on `attendee_id` where present would give one person two
   * identities across those two paths and bring the inflated count straight
   * back. It is also the column the `(segment_id, user_id)` unique index uses,
   * so it is what "assigned once" already means to the backend.
   *
   * Only the identity columns are projected: this runs on the elevated client,
   * and an audience preview has no business reading anything else.
   */
  async function countAssignedAttendees(
    eventId: string
  ): Promise<{ count: number; truncated: boolean }> {
    const { db } = clients.requireElevated(
      "count assigned attendees for an event audience (segment_members grants no read to user credentials)"
    );
    const result = await db.listRows<
      Projected<{ user_id: string | null; attendee_id: string | null }>
    >("app", "segment_members", [
      Query.equal("event_id", eventId),
      Query.select(["$id", "user_id", "attendee_id"]),
      Query.limit(MEMBER_SCAN_CEILING),
    ]);
    const identities = new Set<string>();
    for (const row of result.rows) {
      const identity = row.user_id ?? row.attendee_id ?? row.$id;
      identities.add(identity);
    }
    return {
      count: identities.size,
      // A full window, not `total > rows.length`: see `COUNT_CEILING` above.
      truncated: result.rows.length === MEMBER_SCAN_CEILING,
    };
  }

  async function loadSegments(
    eventId: string,
    campusId: string | null
  ): Promise<SegmentList> {
    const result = await clients.user.db.listRows<
      Projected<{
        event_id: string | null;
        name: string;
        kind: string | null;
        campus_id: string | null;
        capacity: number | null;
        topic_id: string | null;
      }>
    >("app", "event_segments", [
      Query.equal("event_id", eventId),
      Query.orderAsc("name"),
      Query.limit(SEGMENT_LIMIT),
    ]);

    // One count per segment, in bounded-concurrency waves rather than one at a
    // time. A segment count is its own request, and `SEGMENT_LIMIT` is 200, so
    // sequential counting is up to 200 round trips for a single tool call —
    // enough to pass the read timeout on a large event, after which the caller
    // gets nothing at all while the abandoned handler keeps issuing the rest.
    // `Promise.race` abandons a read; it cannot cancel it (see `invokeTool`).
    //
    // Not collapsed into a single `Query.equal("segment_id", [...200 ids])`
    // scan, which would be one request: each segment would then share one
    // `COUNT_CEILING` instead of having its own, so an event with many
    // populated segments would start reporting floors where it reports exact
    // counts today — a precision regression that cannot be justified from
    // here, since the ceiling that matters is the backend's own limit on how
    // many values `Query.equal` accepts, and that needs a live instance to
    // establish. Roadmap S13.
    const counted = await inWaves(result.rows, COUNT_CONCURRENCY, (row) =>
      countRows("segment_members", [Query.equal("segment_id", row.$id)])
    );
    const summaries: SegmentSummary[] = result.rows.map((row, index) => {
      // `inWaves` preserves input order, so index `i` is `result.rows[i]`'s
      // own count. A mismatch here would report one segment's membership
      // against another's capacity.
      const members = counted[index] ?? { count: 0, truncated: false };
      const memberCount = members.count;
      const capacity = row.capacity ?? 0;
      return {
        id: row.$id,
        eventId: row.event_id,
        name: row.name,
        kind: row.kind,
        campusId: row.campus_id ?? campusId,
        campusLabel: campusLabel(row.campus_id ?? campusId),
        capacity,
        memberCount,
        memberCountTruncated: members.truncated,
        topicId: row.topic_id,
        // `capacity: 0` is the schema default and means uncapped, not full.
        // A floor count cannot answer "how many are left" either, so a
        // truncated count reports unknown rather than a number it cannot hold.
        remaining:
          capacity > 0 && !members.truncated
            ? Math.max(capacity - memberCount, 0)
            : null,
      };
    });
    // Counting the rows returned, not reading `result.total`: what this needs
    // to know is whether the window filled, which is true under either reading
    // of what `total` counts (roadmap 3.5).
    return { rows: summaries, truncated: result.rows.length >= SEGMENT_LIMIT };
  }

  return {
    async listSegments(principal, input) {
      const event = await assertEventAccess(principal, input.eventId);
      try {
        return await loadSegments(input.eventId, event.campusId);
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list segments" });
      }
    },

    async audience(principal, input) {
      const event = await assertEventAccess(principal, input.eventId);
      const notes: string[] = [];

      try {
        const segmentPage = await loadSegments(input.eventId, event.campusId);
        const segments = segmentPage.rows;
        if (segmentPage.truncated) {
          // Said first: every count below is computed over these segments
          // only, so an omitted segment silently lowers the assigned count
          // and raises the unassigned one.
          notes.push(
            `This event has at least ${SEGMENT_LIMIT} segments; only the first ${SEGMENT_LIMIT} were read, and the assignment counts below cover those alone.`
          );
        }
        const attendees = await countRows("event_attendees", [
          Query.equal("event_id", input.eventId),
        ]);
        const attendeeCount = attendees.count;
        if (attendees.truncated) {
          notes.push(
            `More than ${COUNT_CEILING} attendees are registered for this event; the attendee count is a floor and the unassigned count is not reliable.`
          );
        }
        const truncatedSegments = segments.filter(
          (segment) => segment.memberCountTruncated
        );
        if (truncatedSegments.length > 0) {
          notes.push(
            `Member counts are a floor for: ${truncatedSegments.map((segment) => segment.name).join(", ")}.`
          );
        }
        const assigned = await countAssignedAttendees(input.eventId);
        const assignedCount = assigned.count;
        if (assigned.truncated) {
          notes.push(
            `More than ${MEMBER_SCAN_CEILING} segment assignments exist for this event; the assigned and unassigned counts are computed from the first ${MEMBER_SCAN_CEILING} and are a lower and upper bound respectively.`
          );
        }

        if (event.capacity > 0 && attendeeCount > event.capacity) {
          notes.push(
            `The attendee list (${attendeeCount}) exceeds the event capacity (${event.capacity}).`
          );
        }
        if (segments.length === 0) {
          notes.push("This event has no segments defined.");
        }
        const overfull = segments.filter(
          (segment) => segment.remaining === 0 && segment.capacity > 0
        );
        if (overfull.length > 0) {
          notes.push(
            `At capacity: ${overfull.map((segment) => segment.name).join(", ")}.`
          );
        }
        notes.push(
          "Messaging a segment is not available from this server; outbound messages are a restricted operation."
        );

        return {
          eventId: input.eventId,
          eventTitle: event.title,
          capacity: event.capacity,
          attendeeCount,
          segments,
          assignedCount,
          unassignedCount: Math.max(attendeeCount - assignedCount, 0),
          notes,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "resolve audience" });
      }
    },
  };
}
