/**
 * Which columns authorize an event's audience data.
 *
 * `events` carries both the canonical `campus`/`department` relationships and
 * the legacy `campus_id`/`department_id` scalars, and mid-backfill they
 * disagree — the scalar being the stale one. `apps/admin`'s own
 * `event-segments.ts` reads this with `getContentOwnership(event, {
 * legacyFallback: true })`, relationship first.
 *
 * It matters more here than in a plain listing: everything past this check
 * runs on the service key over `event_segments`, `segment_members` and
 * `event_attendees`, all of which Appwrite will not scope. The check is the
 * whole boundary, so authorizing it on a stale column both admits the wrong
 * campus and locks out the right one.
 */

import { describe, expect, test } from "bun:test";
import { CAMPUS_ADMIN, createFakeBackend } from "../testing/index";
import { createEventsService } from "./events";

/** One event mid-backfill: the scalar still says Oslo, the row is Bergen's. */
function movedToBergen() {
  return {
    events: [
      {
        $id: "ev-moved",
        campus_id: "1",
        campus: { $id: "2" },
        department_id: "dept-a",
        department: { $id: "dept-a" },
        capacity: 100,
        status: "published",
        translation_refs: [{ locale: "no", title: "Fest" }],
      },
    ],
    event_segments: [
      { $id: "seg-1", event_id: "ev-moved", name: "Crew", capacity: 10 },
    ],
    segment_members: [
      { $id: "sm-1", segment_id: "seg-1", event_id: "ev-moved" },
    ],
    event_attendees: [{ $id: "at-1", event_id: "ev-moved", name: "Ada" }],
  };
}

function service() {
  return createEventsService(createFakeBackend({ tables: movedToBergen() }));
}

describe("an event mid-relationship-backfill", () => {
  test("the campus named only by the stale scalar is refused", async () => {
    await expect(
      service().listSegments(CAMPUS_ADMIN("Oslo", "1"), {
        eventId: "ev-moved",
      })
    ).rejects.toThrow();
  });

  test("the campus that owns it by relationship is served", async () => {
    const segments = await service().listSegments(CAMPUS_ADMIN("Bergen", "2"), {
      eventId: "ev-moved",
    });
    expect(segments.rows.map((row) => row.id)).toEqual(["seg-1"]);
  });

  test("the audience path is gated the same way", async () => {
    await expect(
      service().audience(CAMPUS_ADMIN("Oslo", "1"), { eventId: "ev-moved" })
    ).rejects.toThrow();
  });

  test("and a segment with no campus of its own falls back to the canonical one", async () => {
    // `event_segments` carries only a `campus_id` scalar, so a segment with
    // none borrows the event's campus. That fallback has to be the campus the
    // gate just authorized, or the label contradicts the check above it.
    const audience = await service().audience(CAMPUS_ADMIN("Bergen", "2"), {
      eventId: "ev-moved",
    });
    expect(audience.segments.map((s) => s.campusId)).toEqual(["2"]);
  });
});

describe("an event with more segments than one window holds", () => {
  /**
   * `event_segments` enforces no per-event ceiling, and both surfaces read one
   * bounded window. A full window is a floor: the segments past it, and their
   * capacity and membership, are not merely uncounted — they look absent.
   * `apps/admin`'s own list asks for 200, so anything lower here would hide
   * rows the portal shows.
   */
  function manySegments(count: number) {
    const base = movedToBergen();
    base.event_segments = Array.from({ length: count }, (_, i) => ({
      $id: `seg-${i}`,
      event_id: "ev-moved",
      name: `Segment ${String(i).padStart(3, "0")}`,
      capacity: 10,
    }));
    base.segment_members = [];
    return base;
  }

  function serviceWith(count: number) {
    return createEventsService(
      createFakeBackend({ tables: manySegments(count) })
    );
  }

  test("the listing says it is truncated rather than looking complete", async () => {
    const page = await serviceWith(250).listSegments(
      CAMPUS_ADMIN("Bergen", "2"),
      { eventId: "ev-moved" }
    );
    expect(page.truncated).toBe(true);
    expect(page.rows).toHaveLength(200);
  });

  test("a set that fits is not flagged", async () => {
    const page = await serviceWith(3).listSegments(
      CAMPUS_ADMIN("Bergen", "2"),
      {
        eventId: "ev-moved",
      }
    );
    expect(page.truncated).toBe(false);
    expect(page.rows).toHaveLength(3);
  });

  test("the audience preview says its counts cover the read segments only", async () => {
    const audience = await serviceWith(250).audience(
      CAMPUS_ADMIN("Bergen", "2"),
      { eventId: "ev-moved" }
    );
    expect(audience.notes.some((note) => note.includes("at least"))).toBe(true);
  });
});
