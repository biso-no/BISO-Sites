/**
 * Event audience reads.
 *
 * Two tables make this domain unusual, and both are schema facts rather than
 * design choices:
 *
 * - `event_attendees`: `rowSecurity: false`, **no** table read grant. A user
 *   credential cannot read it at all.
 * - `segment_members`: `rowSecurity: true`, no table read grant. A user
 *   credential sees only rows individually granted to it — so it does not
 *   fail, it undercounts.
 *
 * The counts therefore have to go through the service key, *after* the caller
 * has been authorized against the parent event. These tests pin both halves:
 * that the authorization happens first, and that it is a count that gets
 * elevated, never an attendee row.
 */

import { describe, expect, test } from "bun:test";
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
} from "../testing/index";
import { createEventsService } from "./events";

function tables() {
  return {
    events: [
      {
        $id: "ev-1",
        campus_id: "1",
        department_id: "dept-a",
        capacity: 100,
        status: "published",
        translation_refs: [{ locale: "no", title: "Fest" }],
      },
    ],
    event_segments: [
      { $id: "seg-1", event_id: "ev-1", name: "Crew", capacity: 10 },
      { $id: "seg-2", event_id: "ev-1", name: "Guests", capacity: 50 },
    ],
    segment_members: [
      { $id: "sm-1", segment_id: "seg-1", event_id: "ev-1" },
      { $id: "sm-2", segment_id: "seg-1", event_id: "ev-1" },
      { $id: "sm-3", segment_id: "seg-2", event_id: "ev-1" },
    ],
    event_attendees: [
      { $id: "at-1", event_id: "ev-1", name: "Ada", email: "ada@example.com" },
      {
        $id: "at-2",
        event_id: "ev-1",
        name: "Linn",
        email: "linn@example.com",
      },
    ],
  };
}

describe("event audience", () => {
  test("counts go through the service key", async () => {
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    const audience = await service.audience(CAMPUS_ADMIN("Oslo", "1"), {
      eventId: "ev-1",
    });

    expect(audience.attendeeCount).toBe(2);
    expect(
      backend.elevations.some((reason) => reason.includes("event_attendees"))
    ).toBe(true);
  });

  test("segment membership is counted in full, not just the caller's own rows", async () => {
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    const segments = await service.listSegments(CAMPUS_ADMIN("Oslo", "1"), {
      eventId: "ev-1",
    });

    const crew = segments.find((segment) => segment.id === "seg-1");
    expect(crew?.memberCount).toBe(2);
    expect(
      backend.elevations.some((reason) => reason.includes("segment_members"))
    ).toBe(true);
  });

  test("authorization runs before any elevation", async () => {
    // The decisive ordering property: a caller who fails the event's campus
    // check must never reach the service key.
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    await expect(
      service.audience(CAMPUS_ADMIN("Bergen", "2"), { eventId: "ev-1" })
    ).rejects.toThrow();

    expect(backend.elevations).toEqual([]);
  });

  test("a department member outside the owning department gets nothing elevated", async () => {
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    await expect(
      service.audience(DEPARTMENT_MEMBER("dept-other", "1"), {
        eventId: "ev-1",
      })
    ).rejects.toThrow();

    expect(backend.elevations).toEqual([]);
  });

  test("no attendee identity is returned, only a count", async () => {
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    const audience = await service.audience(CAMPUS_ADMIN("Oslo", "1"), {
      eventId: "ev-1",
    });

    const serialized = JSON.stringify(audience);
    expect(serialized).not.toContain("ada@example.com");
    expect(serialized).not.toContain("Ada");
  });

  test("the service key is never used to widen who may ask", async () => {
    // Elevation answers a question the caller is already entitled to ask; it
    // must not turn an unauthorized caller into an authorized one.
    const backend = createFakeBackend({ tables: tables() });
    const service = createEventsService(backend);

    await expect(
      service.listSegments(CAMPUS_ADMIN("Bergen", "2"), { eventId: "ev-1" })
    ).rejects.toThrow();
    expect(backend.elevations).toEqual([]);
  });
});

describe("assigned attendees are counted once", () => {
  /**
   * `segment_members` is unique on `(segment_id, user_id)` only, and the admin
   * auto-assign path dedupes within one segment `kind` rather than across the
   * event. A person in two segments is two rows and one attendee.
   */
  function sharedAttendee() {
    return {
      events: [
        {
          $id: "ev-1",
          campus_id: "1",
          department_id: "dept-a",
          capacity: 100,
          status: "published",
          translation_refs: [{ locale: "no", title: "Fest" }],
        },
      ],
      event_segments: [
        { $id: "seg-bus", event_id: "ev-1", name: "Bus", capacity: 10 },
        {
          $id: "seg-workshop",
          event_id: "ev-1",
          name: "Workshop",
          capacity: 10,
        },
      ],
      // One user, two segments — two rows, written by the two different
      // assignment paths. Auto-assign sets `attendee_id`; manual assign does
      // not. Seeding both columns on both rows (as the first version of this
      // test did) hides exactly the bug the identity choice has to survive.
      segment_members: [
        {
          $id: "sm-1",
          segment_id: "seg-bus",
          event_id: "ev-1",
          user_id: "u-1",
          attendee_id: "at-1",
        },
        {
          $id: "sm-2",
          segment_id: "seg-workshop",
          event_id: "ev-1",
          user_id: "u-1",
        },
      ],
      event_attendees: [
        { $id: "at-1", event_id: "ev-1", name: "Ada" },
        { $id: "at-2", event_id: "ev-1", name: "Linn" },
      ],
    };
  }

  test("a person in two segments counts as one assigned attendee", async () => {
    const service = createEventsService(
      createFakeBackend({ tables: sharedAttendee(), hasElevated: true })
    );
    const audience = await service.audience(CAMPUS_ADMIN("Oslo", "1"), {
      eventId: "ev-1",
    });

    expect(audience.assignedCount).toBe(1);
  });

  test("the second attendee is still reported as unassigned", async () => {
    // The consequence that matters: counting rows made `assignedCount` 2,
    // which cancelled out `attendeeCount` and claimed nobody was left.
    const service = createEventsService(
      createFakeBackend({ tables: sharedAttendee(), hasElevated: true })
    );
    const audience = await service.audience(CAMPUS_ADMIN("Oslo", "1"), {
      eventId: "ev-1",
    });

    expect(audience.attendeeCount).toBe(2);
    expect(audience.unassignedCount).toBe(1);
  });
});
