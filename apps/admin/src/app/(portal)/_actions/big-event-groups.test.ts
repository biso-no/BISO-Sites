import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { GroupFormValues } from "@/lib/big-events/buses/group-form";
import { createFakeTablesDb, type FakeRow } from "@/test/fake-tables-db";

mock.module("server-only", () => ({}));

const fake = createFakeTablesDb();
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: fake.db })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: "a@example.com",
    managedCampuses: [],
    managedCampusIds: [],
    name: "Admin",
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "admin-1",
    ...overrides,
  };
}

const globalAdmin = makeCtx({ roles: ["globaladmin"] });
const bergenAdmin = makeCtx({
  managedCampusIds: ["2"],
  resolvedCampusIds: ["2"],
  roles: ["campusadmin"],
});

let currentCtx: UserAuthContext = globalAdmin;
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const { createGroup, deleteGroup, listGroups, updateGroup } = await import(
  "./big-event-groups"
);

const EVENTS = "big_events";
const PARTICIPANTS = "big_event_participants";
const GROUPS = "big_event_groups";
const MEMBERS = "big_event_group_members";

/** Winter Games: a National big event with Travel on, bus lists not published. */
function bigEvent(overrides: Record<string, unknown> = {}): FakeRow {
  return {
    $id: "b1",
    bus_lists_published_at: null,
    bus_lists_published_by: null,
    campus_id: "5",
    department_id: null,
    ends_at: "2027-01-27T17:00:00.000+00:00",
    name_no: "Winter Games 2027",
    starts_at: "2027-01-24T07:00:00.000+00:00",
    status: "draft",
    travel_enabled: true,
    ...overrides,
  };
}

function group(
  id: string,
  kind: string,
  fields: Record<string, unknown> = {}
): FakeRow {
  return {
    $id: id,
    big_event_id: "b1",
    booking_participant_id: null,
    campus_id: "2",
    capacity: null,
    contact_name: null,
    contact_phone: null,
    contact_user_id: null,
    home_arrival_note: null,
    home_bus_id: null,
    home_departs_at: null,
    home_maps_url: null,
    home_meeting_point: null,
    kind,
    name: id,
    note: null,
    out_bus_id: null,
    out_departs_at: null,
    out_maps_url: null,
    out_meeting_point: null,
    room_number: null,
    source_key: null,
    ...fields,
  };
}

function member(
  groupId: string,
  participantId: string,
  leg: "out" | "home" | null = null,
  pinned = false
): FakeRow {
  return {
    $id: `${groupId}-${participantId}-${leg ?? "x"}`,
    assigned_at: null,
    big_event_id: "b1",
    group_id: groupId,
    leg,
    participant_id: participantId,
    pinned,
  };
}

function participant(
  id: string,
  campusId: string | null,
  firstName: string,
  lastName: string | null
): FakeRow {
  return {
    $id: id,
    big_event_id: "b1",
    campus_id: campusId,
    first_name: firstName,
    last_name: lastName,
    phone: "+4791234567",
    ticket_email: `${id}@example.com`,
    user_id: null,
  };
}

function seed(
  tables: Record<string, FakeRow[]> = {},
  event: FakeRow = bigEvent()
): void {
  fake.reset({
    [EVENTS]: [event],
    [GROUPS]: [],
    [MEMBERS]: [],
    [PARTICIPANTS]: [],
    ...tables,
  });
}

function values(overrides: Partial<GroupFormValues> = {}): GroupFormValues {
  return {
    campus_id: "2",
    capacity: null,
    contact_name: "",
    contact_phone: "",
    home_arrival_note: "",
    home_departs_at: "",
    home_maps_url: "",
    home_meeting_point: "",
    kind: "room",
    name: "Room 1",
    note: "",
    out_departs_at: "",
    out_maps_url: "",
    out_meeting_point: "",
    room_number: "",
    ...overrides,
  };
}

function groupRow(id: string): FakeRow | undefined {
  return fake.rows(GROUPS).find((row) => row.$id === id);
}

function auditCalls(action: string): unknown[][] {
  return logAuditEvent.mock.calls.filter((call) => call[1] === action);
}

beforeEach(() => {
  currentCtx = globalAdmin;
  logAuditEvent.mockClear();
  seed();
});

describe("createGroup", () => {
  test("refuses a bus when Travel is off", async () => {
    seed({}, bigEvent({ travel_enabled: false }));
    await expect(
      createGroup("b1", values({ kind: "bus", name: "Bus 1" }))
    ).rejects.toThrow("Travel");
    expect(fake.rows(GROUPS)).toHaveLength(0);
    expect(auditCalls("big_event.group.create")).toHaveLength(0);
  });

  test("a campus admin can't create a group on another campus", async () => {
    currentCtx = bergenAdmin;
    await expect(
      createGroup("b1", values({ campus_id: "1" }))
    ).rejects.toThrow();
    await expect(
      createGroup("b1", values({ campus_id: null }))
    ).rejects.toThrow();
    await expect(
      createGroup("b1", values({ campus_id: "5" }))
    ).rejects.toThrow();
    expect(fake.rows(GROUPS)).toHaveLength(0);

    const { id } = await createGroup("b1", values({ campus_id: "2" }));
    expect(groupRow(id)).toMatchObject({
      big_event_id: "b1",
      campus_id: "2",
      kind: "room",
    });
  });

  test("stores a bus's times in UTC, a tidy phone number and no room number", async () => {
    const { id } = await createGroup(
      "b1",
      values({
        capacity: 50,
        contact_name: "Per",
        contact_phone: "912 34 567",
        home_departs_at: "2027-01-27T15:30:00+01:00",
        kind: "bus",
        name: "Bus 1",
        out_departs_at: "2027-01-24T08:00:00+01:00",
        out_maps_url: "https://maps.example.com/bi",
        out_meeting_point: "BI Nydalen",
        room_number: "12",
      })
    );
    expect(groupRow(id)).toMatchObject({
      capacity: 50,
      contact_phone: "+4791234567",
      home_departs_at: "2027-01-27T14:30:00.000Z",
      home_maps_url: null,
      kind: "bus",
      out_departs_at: "2027-01-24T07:00:00.000Z",
      out_maps_url: "https://maps.example.com/bi",
      out_meeting_point: "BI Nydalen",
      room_number: null,
    });
    const [call] = auditCalls("big_event.group.create");
    expect(call?.[2]).toMatchObject({
      payload: { big_event_id: "b1", kind: "bus" },
      resourceId: id,
    });
  });

  test("keeps bus fields off other kinds", async () => {
    const { id } = await createGroup(
      "b1",
      values({
        kind: "room",
        out_departs_at: "2027-01-24T08:00:00+01:00",
        out_meeting_point: "BI Nydalen",
        room_number: "12",
      })
    );
    expect(groupRow(id)).toMatchObject({
      out_departs_at: null,
      out_meeting_point: null,
      room_number: "12",
    });
  });
});

describe("updateGroup", () => {
  test("refuses to change the campus of a group with people in it", async () => {
    seed({
      [GROUPS]: [group("r1", "room"), group("r2", "room")],
      [MEMBERS]: [member("r1", "p1")],
    });
    await expect(
      updateGroup("r1", values({ campus_id: "3", name: "r1" }))
    ).rejects.toThrow();
    expect(groupRow("r1")?.campus_id).toBe("2");

    await updateGroup("r2", values({ campus_id: "3", name: "Room 2" }));
    expect(groupRow("r2")).toMatchObject({ campus_id: "3", name: "Room 2" });
    const [call] = auditCalls("big_event.group.update");
    expect(call?.[2]).toMatchObject({
      payload: { big_event_id: "b1", changed: ["campus_id", "name"] },
      resourceId: "r2",
    });
  });

  test("a campus admin can't edit another campus's group or move one away", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        group("oslo", "room", { campus_id: "1" }),
        group("r2", "room"),
      ],
    });
    await expect(
      updateGroup("oslo", values({ campus_id: "2" }))
    ).rejects.toThrow();
    await expect(
      updateGroup("r2", values({ campus_id: "1" }))
    ).rejects.toThrow();
    expect(groupRow("oslo")?.campus_id).toBe("1");
    expect(groupRow("r2")?.campus_id).toBe("2");
  });
});

describe("deleteGroup", () => {
  test("deleting a bus clears it from rooms", async () => {
    seed({
      [GROUPS]: [
        group("bus1", "bus", { capacity: 50 }),
        group("bus2", "bus", { capacity: 50 }),
        group("r1", "room", { home_bus_id: "bus1", out_bus_id: "bus1" }),
        group("r2", "room", { home_bus_id: "bus2", out_bus_id: "bus1" }),
        group("r3", "room", { home_bus_id: "bus2", out_bus_id: "bus2" }),
      ],
      [MEMBERS]: [
        member("bus1", "p1", "out"),
        member("bus1", "p1", "home"),
        member("bus2", "p2", "out"),
        member("r1", "p1"),
      ],
    });

    await deleteGroup("bus1");

    expect(groupRow("bus1")).toBeUndefined();
    expect(groupRow("r1")).toMatchObject({
      home_bus_id: null,
      out_bus_id: null,
    });
    expect(groupRow("r2")).toMatchObject({
      home_bus_id: "bus2",
      out_bus_id: null,
    });
    expect(groupRow("r3")).toMatchObject({
      home_bus_id: "bus2",
      out_bus_id: "bus2",
    });
    expect(
      fake
        .rows(MEMBERS)
        .map((row) => row.$id)
        .sort()
    ).toEqual(["bus2-p2-out", "r1-p1-x"]);
    const [call] = auditCalls("big_event.group.delete");
    expect(call?.[2]).toMatchObject({
      payload: {
        big_event_id: "b1",
        complete: true,
        kind: "bus",
        memberships_removed: 2,
        rooms_cleared: 2,
      },
      resourceId: "bus1",
    });
  });

  test("refuses to delete a published bus with people on it", async () => {
    seed(
      {
        [GROUPS]: [
          group("bus1", "bus", { capacity: 50 }),
          group("empty", "bus", { capacity: 50 }),
          group("r1", "room", { home_bus_id: "empty", out_bus_id: "empty" }),
        ],
        [MEMBERS]: [member("bus1", "p1", "out")],
      },
      bigEvent({ bus_lists_published_at: "2026-11-20T10:00:00.000Z" })
    );

    await expect(deleteGroup("bus1")).rejects.toThrow(
      "Move the people off this bus first."
    );
    expect(groupRow("bus1")).toBeDefined();
    expect(fake.rows(MEMBERS)).toHaveLength(1);
    expect(fake.db.deleteRow).not.toHaveBeenCalled();

    // A published bus nobody is on can still go.
    await deleteGroup("empty");
    expect(groupRow("empty")).toBeUndefined();
    expect(groupRow("r1")).toMatchObject({
      home_bus_id: null,
      out_bus_id: null,
    });
  });

  test("deletes a room and everyone's place in it", async () => {
    seed({
      [GROUPS]: [group("r1", "room", { capacity: 4 })],
      [MEMBERS]: [member("r1", "p1"), member("r1", "p2")],
    });
    await deleteGroup("r1");
    expect(groupRow("r1")).toBeUndefined();
    expect(fake.rows(MEMBERS)).toHaveLength(0);
  });

  test("stops when a write fails and still records the attempt", async () => {
    seed({
      [GROUPS]: [group("r1", "room")],
      [MEMBERS]: [member("r1", "p1"), member("r1", "p2")],
    });
    fake.setBeforeWrite((write) => {
      if (write.rowId === "r1-p2-x") {
        throw new Error("Appwrite is down");
      }
    });
    await expect(deleteGroup("r1")).rejects.toThrow();
    expect(groupRow("r1")).toBeDefined();
    const [call] = auditCalls("big_event.group.delete");
    expect(call?.[2]).toMatchObject({
      payload: { complete: false, memberships_removed: 1 },
      resourceId: "r1",
    });
  });

  test("a campus admin can't delete another campus's group", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        group("oslo", "room", { campus_id: "1" }),
        group("none", "buddy", { campus_id: null }),
      ],
    });
    await expect(deleteGroup("oslo")).rejects.toThrow();
    await expect(deleteGroup("none")).rejects.toThrow();
    expect(fake.rows(GROUPS)).toHaveLength(2);
  });
});

describe("listGroups", () => {
  test("listGroups shows only the caller's campus groups and no contact details of participants", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        group("bus-b", "bus", {
          capacity: 50,
          contact_name: "Bus host",
          name: "Bus 1",
        }),
        group("room-b", "room", { capacity: 4, name: "Kari Nordmann" }),
        group("room-o", "room", { campus_id: "1", name: "Ola Hansen" }),
        group("buddy-none", "buddy", { campus_id: null, name: "No campus" }),
      ],
      [MEMBERS]: [
        member("bus-b", "p-b1", "out", true),
        member("bus-b", "p-b1", "home"),
        member("bus-b", "p-o1", "out"),
        member("room-b", "p-b1"),
        member("room-o", "p-o1"),
        member("buddy-none", "p-b1"),
      ],
      [PARTICIPANTS]: [
        participant("p-b1", "2", "Kari", "Nordmann"),
        participant("p-o1", "1", "Ola", "Hansen"),
      ],
    });

    const view = await listGroups("b1");

    expect(view.groups.map((row) => row.$id)).toEqual(["bus-b", "room-b"]);
    const [bus, room] = view.groups;
    expect(bus?.members).toEqual([
      {
        leg: "out",
        name: "Kari Nordmann",
        participantId: "p-b1",
        pinned: true,
        roomName: "Kari Nordmann",
      },
      {
        leg: "home",
        name: "Kari Nordmann",
        participantId: "p-b1",
        pinned: false,
        roomName: "Kari Nordmann",
      },
    ]);
    // Seats count everyone on the bus, also people the caller can't see.
    expect(bus?.seats).toEqual({ home: 1, out: 2 });
    expect(bus?.openPlaces).toBeNull();
    expect(room?.openPlaces).toBe(3);
    expect(room?.seats).toBeNull();
    expect(view.campuses).toEqual(["2"]);
    expect(view.canPublish).toBe(false);
    expect(view.travel).toBe(true);
    expect(view.publishedAt).toBeNull();

    const shown = JSON.stringify(view);
    expect(shown).not.toContain("@example.com");
    expect(shown).not.toContain("+4791234567");
    expect(shown).not.toContain("Ola");
    expect(shown).not.toContain("No campus");
  });

  test("sorts groups by kind, campus and name and counts a room's open places on its bus", async () => {
    seed({
      [GROUPS]: [
        group("other", "other", { name: "Crew" }),
        group("team-a", "team", { name: "Alpha" }),
        group("room-z", "room", {
          capacity: 4,
          home_bus_id: "bus-2",
          name: "Zara",
          out_bus_id: "bus-2",
        }),
        group("room-a", "room", { campus_id: "1", name: "Anna" }),
        group("bus-n", "bus", { campus_id: "5", name: "Bus N" }),
        group("bus-2", "bus", { capacity: 50, name: "Bus 2" }),
        group("buddy", "buddy", { campus_id: null, name: "Buddies" }),
      ],
      [MEMBERS]: [
        member("room-z", "p1"),
        member("bus-2", "p1", "out"),
        member("bus-2", "p1", "home"),
      ],
      [PARTICIPANTS]: [participant("p1", "2", "Kari", null)],
    });

    const view = await listGroups("b1");

    expect(view.groups.map((row) => row.$id)).toEqual([
      "bus-2",
      "bus-n",
      "room-a",
      "room-z",
      "buddy",
      "team-a",
      "other",
    ]);
    const bus = view.groups[0];
    // Kari plus the room's three open places, each way.
    expect(bus?.seats).toEqual({ home: 4, out: 4 });
    expect(bus?.members.map((row) => row.name)).toEqual(["Kari", "Kari"]);
    expect(view.campuses).toEqual(["1", "2", "5"]);
    expect(view.canPublish).toBe(true);
  });

  test("can't publish twice or without Travel", async () => {
    seed({}, bigEvent({ bus_lists_published_at: "2026-11-20T10:00:00.000Z" }));
    const published = await listGroups("b1");
    expect(published.canPublish).toBe(false);
    expect(published.publishedAt).toBe("2026-11-20T10:00:00.000Z");

    seed({}, bigEvent({ travel_enabled: false }));
    const noTravel = await listGroups("b1");
    expect(noTravel.canPublish).toBe(false);
    expect(noTravel.travel).toBe(false);
  });
});
