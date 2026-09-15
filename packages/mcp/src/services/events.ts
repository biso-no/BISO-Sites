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
import { canReadRow } from "../identity/scope";
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
  name: string;
  /** Free capacity, or null when the segment is uncapped (`capacity` 0). */
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
  ): Promise<SegmentSummary[]>;
}

const SEGMENT_LIMIT = 100;
const COUNT_PROBE = 1;

export function createEventsService(clients: BackendClients): EventsService {
  /**
   * Authorize against the parent event, not the segment.
   *
   * `event_segments`, `segment_members` and `event_attendees` all have
   * `rowSecurity: false` (and `event_attendees` has no table grants at all), so
   * Appwrite will not scope these for us. The event is the thing that carries
   * campus ownership, so that is what the check runs on.
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
          campus_id: string | null;
          department_id: string | null;
          capacity: number | null;
          status: string;
          translation_refs?: Array<{ locale: string; title: string }>;
        }>
      >("app", "events", eventId, [
        Query.select([
          "$id",
          "campus_id",
          "department_id",
          "capacity",
          "status",
          "translation_refs.locale",
          "translation_refs.title",
        ]),
      ]);

      if (!canReadRow(principal, event.campus_id, event.department_id)) {
        throw forbidden(
          `You do not have access to event ${eventId}.`,
          { eventId, campusId: event.campus_id },
          "Attendee and segment data is scoped to the campus that owns the event."
        );
      }

      const refs = event.translation_refs ?? [];
      return {
        title:
          refs.find((item) => item.locale === "no")?.title ??
          refs[0]?.title ??
          null,
        campusId: event.campus_id,
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

  async function countRows(table: string, queries: string[]): Promise<number> {
    const result = await clients.user.db.listRows(
      table === "event_attendees" ? "app" : "app",
      table,
      [...queries, Query.limit(COUNT_PROBE)]
    );
    return result.total;
  }

  async function loadSegments(
    eventId: string,
    campusId: string | null
  ): Promise<SegmentSummary[]> {
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

    const summaries: SegmentSummary[] = [];
    for (const row of result.rows) {
      const memberCount = await countRows("segment_members", [
        Query.equal("segment_id", row.$id),
      ]);
      const capacity = row.capacity ?? 0;
      summaries.push({
        id: row.$id,
        eventId: row.event_id,
        name: row.name,
        kind: row.kind,
        campusId: row.campus_id ?? campusId,
        campusLabel: campusLabel(row.campus_id ?? campusId),
        capacity,
        memberCount,
        topicId: row.topic_id,
        // `capacity: 0` is the schema default and means uncapped, not full.
        remaining: capacity > 0 ? Math.max(capacity - memberCount, 0) : null,
      });
    }
    return summaries;
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
        const segments = await loadSegments(input.eventId, event.campusId);
        const attendeeCount = await countRows("event_attendees", [
          Query.equal("event_id", input.eventId),
        ]);
        const assignedCount = await countRows("segment_members", [
          Query.equal("event_id", input.eventId),
        ]);

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
