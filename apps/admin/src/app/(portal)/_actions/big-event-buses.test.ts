import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import {
  busSeatUse,
  type SeatMember,
  type SeatRoom,
  type SeatUse,
} from "@/lib/big-events/buses/seats";
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
// `mock.module` is process-wide: every export stays, only the room label is faked.
const actualIntl = await import("next-intl/server");
mock.module("next-intl/server", () => ({
  ...actualIntl,
  getTranslations: mock(
    async () => (key: string, values?: Record<string, string>) =>
      key === "roomName" ? `Rom · ${values?.name}` : key
  ),
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
  userId: "bergen-1",
});

let currentCtx: UserAuthContext = globalAdmin;
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const {
  applyAutoFill,
  moveToBus,
  moveToGroup,
  previewAutoFill,
  publishBusLists,
  setPinned,
} = await import("./big-event-buses");

const EVENTS = "big_events";
const PARTICIPANTS = "big_event_participants";
const GROUPS = "big_event_groups";
const MEMBERS = "big_event_group_members";
const NOW = "2027-01-10T10:00:00.000Z";
const LATER = "2027-01-10T11:30:00.000Z";

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

const PUBLISHED = {
  bus_lists_published_at: "2027-01-05T09:00:00.000+00:00",
  bus_lists_published_by: "admin-1",
};

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

function bus(id: string, capacity: number | null, campusId = "2"): FakeRow {
  return group(id, "bus", { campus_id: campusId, capacity, name: id });
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

function bothWays(busId: string, participantId: string, pinned = false) {
  return [
    member(busId, participantId, "out", pinned),
    member(busId, participantId, "home", pinned),
  ];
}

function participant(
  id: string,
  campusId: string | null = "2",
  firstName = id,
  lastName: string | null = null
): FakeRow {
  return {
    $id: id,
    big_event_id: "b1",
    bus_notice_due_at: null,
    bus_notified_at: null,
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

/** Each of the person's memberships as "group:leg:pinned", sorted. */
function placesOf(participantId: string): string[] {
  return fake
    .rows(MEMBERS)
    .filter((row) => row.participant_id === participantId)
    .map((row) => `${row.group_id}:${row.leg ?? "-"}:${row.pinned === true}`)
    .sort();
}

function roomBuses(roomId: string): [unknown, unknown] {
  const room = fake.rows(GROUPS).find((row) => row.$id === roomId);
  return [room?.out_bus_id, room?.home_bus_id];
}

/** Seats taken per bus and leg, room open places included. */
function seatsNow(): Record<string, SeatUse> {
  const groups = fake.rows(GROUPS) as unknown as (SeatRoom & {
    kind: string;
  })[];
  const use = busSeatUse({
    buses: groups.filter((row) => row.kind === "bus"),
    members: fake.rows(MEMBERS) as unknown as SeatMember[],
    rooms: groups.filter((row) => row.kind === "room"),
  });
  return Object.fromEntries(use);
}

function noticeOf(participantId: string): unknown {
  return fake.rows(PARTICIPANTS).find((row) => row.$id === participantId)
    ?.bus_notice_due_at;
}

function auditCalls(action: string): unknown[][] {
  return logAuditEvent.mock.calls.filter((call) => call[1] === action);
}

function auditPayload(action: string): Record<string, unknown> {
  const call = auditCalls(action).at(-1);
  return (call?.[2] as { payload: Record<string, unknown> }).payload;
}

function writeCount(): number {
  return (
    fake.db.createRow.mock.calls.length +
    fake.db.updateRow.mock.calls.length +
    fake.db.deleteRow.mock.calls.length
  );
}

beforeEach(() => {
  currentCtx = globalAdmin;
  logAuditEvent.mockClear();
  setSystemTime(new Date(NOW));
  seed();
});

afterEach(() => {
  setSystemTime();
});

describe("auto-fill", () => {
  test("applyAutoFill writes the planned seats and room buses", async () => {
    // room-1 holds 3: two named and one open place, so it needs 3 seats.
    seed({
      [GROUPS]: [
        bus("bus-a", 4),
        bus("bus-b", 4),
        group("room-1", "room", { capacity: 3, name: "Kari Nordmann" }),
        bus("bus-oslo", 10, "1"),
      ],
      [PARTICIPANTS]: [
        participant("r1"),
        participant("r2"),
        participant("s1"),
        participant("s2"),
        participant("s3"),
        participant("o1", "1"),
      ],
      [MEMBERS]: [
        member("room-1", "r1"),
        member("room-1", "r2"),
        ...bothWays("bus-a", "r1"),
        ...bothWays("bus-a", "s1"),
        ...bothWays("bus-oslo", "o1"),
      ],
    });

    const result = await applyAutoFill("b1", "2");

    // The room fills bus-a (largest first); the rest spread onto bus-b.
    expect(placesOf("r1")).toEqual([
      "bus-a:home:false",
      "bus-a:out:false",
      "room-1:-:false",
    ]);
    expect(placesOf("r2")).toEqual([
      "bus-a:home:false",
      "bus-a:out:false",
      "room-1:-:false",
    ]);
    for (const id of ["s1", "s2", "s3"]) {
      expect(placesOf(id)).toEqual(["bus-b:home:false", "bus-b:out:false"]);
    }
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-a"]);
    // A move to someone's current bus is a no-op: r1's seats keep their rows.
    const r1Rows = fake
      .rows(MEMBERS)
      .filter((row) => row.participant_id === "r1" && row.leg !== null)
      .map((row) => row.$id)
      .sort();
    expect(r1Rows).toEqual(["bus-a-r1-home", "bus-a-r1-out"]);
    // Another campus's people are left alone.
    expect(placesOf("o1")).toEqual([
      "bus-oslo:home:false",
      "bus-oslo:out:false",
    ]);
    // New seats are not pinned and carry the big event.
    const created = fake.db.createRow.mock.calls.map(
      (call) => call[3] as Record<string, unknown>
    );
    expect(created.every((row) => row.pinned === false)).toBe(true);
    expect(created.every((row) => row.big_event_id === "b1")).toBe(true);
    // Before publishing, nobody owes a notice.
    expect(fake.rows(PARTICIPANTS).every((row) => !row.bus_notice_due_at)).toBe(
      true
    );
    expect(result).toEqual({ moved: 4, unplaced: 0 });
    const payload = auditPayload("big_event.bus.fill");
    expect(payload).toMatchObject({ complete: true, only_unseated: false });
    expect(JSON.stringify(payload)).not.toContain("Kari");
  });

  test("before publishing, people without a seat come off the buses", async () => {
    // bus-a holds 2; room-1 needs 3 seats, so it is too big; s1 and s2 fill bus-a.
    seed({
      [GROUPS]: [
        bus("bus-a", 2),
        group("room-1", "room", {
          capacity: 3,
          home_bus_id: "bus-a",
          out_bus_id: "bus-a",
        }),
      ],
      [PARTICIPANTS]: [
        participant("r1"),
        participant("p0"),
        participant("s1"),
        participant("s2"),
        participant("s3"),
      ],
      [MEMBERS]: [
        member("room-1", "r1"),
        ...bothWays("bus-a", "r1"),
        ...bothWays("bus-a", "s3"),
        member("bus-a", "p0", "home", true),
      ],
    });

    const result = await applyAutoFill("b1", "2");

    // The pinned home seat of p0 counts on the home leg only; out has 2 seats.
    expect(roomBuses("room-1")).toEqual([null, null]);
    expect(placesOf("r1")).toEqual(["room-1:-:false"]);
    expect(placesOf("p0")).toContain("bus-a:home:true");
    const seated = ["p0", "s1", "s2", "s3"].filter((id) =>
      placesOf(id).includes("bus-a:out:false")
    );
    expect(seated).toHaveLength(2);
    expect(result.unplaced).toBe(3);
  });

  test("refuses to fill when a bus has no seat count", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), group("Bus 2", "bus", { capacity: null })],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
    });

    const preview = await previewAutoFill("b1", "2");
    expect(preview.missingCapacity).toEqual(["Bus 2"]);

    await expect(applyAutoFill("b1", "2")).rejects.toThrow("Bus 2");
    await expect(applyAutoFill("b1", "all")).rejects.toThrow("Bus 2");
    expect(writeCount()).toBe(0);
    expect(fake.rows(MEMBERS)).toHaveLength(0);
  });

  test("after publishing, auto-fill only seats people without a bus", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 2), bus("bus-b", 10)],
        [PARTICIPANTS]: [
          participant("p1"),
          participant("p2"),
          participant("p3"),
          participant("p4"),
        ],
        [MEMBERS]: [
          // bus-a is full and lopsided; a repack would move them.
          ...bothWays("bus-a", "p1"),
          ...bothWays("bus-a", "p2"),
          // p4 has an out seat but no way home.
          member("bus-b", "p4", "out"),
        ],
      },
      bigEvent(PUBLISHED)
    );

    const result = await applyAutoFill("b1", "2");

    expect(placesOf("p1")).toEqual(["bus-a:home:false", "bus-a:out:false"]);
    expect(placesOf("p2")).toEqual(["bus-a:home:false", "bus-a:out:false"]);
    expect(placesOf("p3")).toEqual(["bus-b:home:false", "bus-b:out:false"]);
    expect(placesOf("p4")).toEqual(["bus-b:home:false", "bus-b:out:false"]);
    expect(fake.db.deleteRow).not.toHaveBeenCalled();
    // People the fill seats after publishing are owed their notice; the rest aren't.
    expect(noticeOf("p3")).toBe(NOW);
    expect(noticeOf("p4")).toBe(NOW);
    expect(noticeOf("p1")).toBeNull();
    expect(noticeOf("p2")).toBeNull();
    expect(result).toEqual({ moved: 2, unplaced: 0 });
    expect(auditPayload("big_event.bus.fill")).toMatchObject({
      only_unseated: true,
    });
  });

  test("previewAutoFill counts seats and names who is left without one", async () => {
    // bus-a has one seat; room-1 needs 4 (Kari and three open places).
    seed({
      [GROUPS]: [
        bus("bus-a", 1),
        group("room-1", "room", { capacity: 4, name: "Kari Nordmann" }),
        bus("bus-oslo", 1, "1"),
      ],
      [PARTICIPANTS]: [
        participant("k1", "2", "Kari", "Nordmann"),
        participant("a1", "2", "Lise", "Dahl"),
        participant("a2", "2", "Åse Marie", "Ødegård"),
        participant("a3", "2", "Per", null),
        participant("a4", "2", "Ola", "Berg"),
        participant("o1", "1", "Oda", "Lie"),
        participant("o2", "1", "Odd", "Moe"),
      ],
      [MEMBERS]: [member("room-1", "k1")],
    });

    const bergen = await previewAutoFill("b1", "2");

    expect(bergen.placed).toBe(1);
    expect(bergen.missingCapacity).toEqual([]);
    expect(bergen.perBus).toEqual([
      { busId: "bus-a", campusId: "2", capacity: 1, name: "bus-a", out: 1 },
    ]);
    // First names and last initials; a room shows as the room.
    expect(bergen.unplaced).toEqual([
      { count: 3, names: ["Ola B.", "Per", "Åse Marie Ø."], reason: "no_seat" },
      { count: 1, names: ["Rom · Kari Nordmann"], reason: "too_big" },
    ]);
    const text = JSON.stringify(bergen);
    expect(text).not.toContain("@example.com");
    expect(text).not.toContain("+47");
    expect(text).not.toContain("Dahl");

    // Every campus the caller may manage, one at a time.
    const all = await previewAutoFill("b1", "all");
    expect(all.perBus.map((row) => row.busId)).toEqual(["bus-oslo", "bus-a"]);
    expect(all.placed).toBe(2);
    expect(all.unplaced[0]).toEqual({
      count: 4,
      names: ["Odd M.", "Ola B.", "Per", "Åse Marie Ø."],
      reason: "no_seat",
    });
    expect(writeCount()).toBe(0);
  });

  test("a campus admin fills only their own campus", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [bus("bus-a", 3), bus("bus-oslo", 3, "1")],
      [PARTICIPANTS]: [participant("p1"), participant("o1", "1")],
    });

    await expect(previewAutoFill("b1", "1")).rejects.toThrow("own campus");
    await expect(applyAutoFill("b1", "1")).rejects.toThrow("own campus");

    const result = await applyAutoFill("b1", "all");
    expect(result.moved).toBe(1);
    expect(placesOf("p1")).toEqual(["bus-a:home:false", "bus-a:out:false"]);
    expect(placesOf("o1")).toEqual([]);
  });

  test("a failed write stops the fill and is still audited", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [...bothWays("bus-a", "p1"), ...bothWays("bus-a", "p2")],
    });
    fake.setBeforeWrite((write) => {
      if (write.kind === "create" && write.data?.leg === "home") {
        throw new Error("network");
      }
    });
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);

    await expect(applyAutoFill("b1", "2")).rejects.toThrow("Try again");
    quiet.mockRestore();

    // Old seats are only removed once every new seat is written.
    expect(fake.db.deleteRow).not.toHaveBeenCalled();
    expect(auditPayload("big_event.bus.fill")).toMatchObject({
      complete: false,
    });
  });

  test("a failed fill after publishing still leaves the notices", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 4)],
        [PARTICIPANTS]: [participant("p1")],
      },
      bigEvent(PUBLISHED)
    );
    fake.setBeforeWrite((write) => {
      if (write.kind === "create") {
        throw new Error("network");
      }
    });
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);

    await expect(applyAutoFill("b1", "2")).rejects.toThrow("Try again");
    quiet.mockRestore();

    expect(placesOf("p1")).toEqual([]);
    expect(noticeOf("p1")).toBe(NOW);
  });

  test("refuses bus work when Travel is off", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 4)],
        [PARTICIPANTS]: [participant("p1")],
      },
      bigEvent({ travel_enabled: false })
    );

    await expect(previewAutoFill("b1", "2")).rejects.toThrow("Travel");
    await expect(applyAutoFill("b1", "2")).rejects.toThrow("Travel");
    await expect(
      moveToBus("b1", {
        busId: "bus-a",
        legs: "both",
        notify: false,
        participantIds: ["p1"],
      })
    ).rejects.toThrow("Travel");
    await expect(publishBusLists("b1")).rejects.toThrow("Travel");
    expect(writeCount()).toBe(0);
  });
});

describe("moving by hand", () => {
  test("moving by hand pins the moved legs", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [...bothWays("bus-a", "p1"), ...bothWays("bus-b", "p2")],
    });

    const result = await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: false,
      participantIds: ["p1", "p2"],
    });

    expect(placesOf("p1")).toEqual(["bus-b:home:true", "bus-b:out:true"]);
    // Already on bus-b: the seats stay and are pinned; p2 didn't move.
    expect(placesOf("p2")).toEqual(["bus-b:home:true", "bus-b:out:true"]);
    expect(
      fake
        .rows(MEMBERS)
        .filter((row) => row.participant_id === "p2")
        .map((row) => row.$id)
        .sort()
    ).toEqual(["bus-b-p2-home", "bus-b-p2-out"]);
    expect(result).toEqual({ moved: 1 });
    expect(auditPayload("big_event.bus.move")).toMatchObject({
      complete: true,
      moved: 1,
    });
  });

  test("moving one leg keeps the other", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
      [PARTICIPANTS]: [participant("p1"), participant("p2"), participant("p3")],
      [MEMBERS]: [...bothWays("bus-a", "p1"), member("bus-a", "p3", "home")],
    });

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "home",
      notify: false,
      participantIds: ["p1"],
    });
    expect(placesOf("p1")).toEqual(["bus-a:out:false", "bus-b:home:true"]);

    // No home seat yet: home follows out (D5).
    await moveToBus("b1", {
      busId: "bus-b",
      legs: "out",
      notify: false,
      participantIds: ["p2", "p3"],
    });
    expect(placesOf("p2")).toEqual(["bus-b:home:true", "bus-b:out:true"]);
    expect(placesOf("p3")).toEqual(["bus-a:home:false", "bus-b:out:true"]);

    // Off the bus on one leg only.
    await moveToBus("b1", {
      busId: null,
      legs: "out",
      notify: false,
      participantIds: ["p1"],
    });
    expect(placesOf("p1")).toEqual(["bus-b:home:true"]);
  });

  test("campus admins can't move people across campuses", async () => {
    seed({
      [GROUPS]: [bus("bus-bergen", 4), bus("bus-oslo", 4, "1")],
      [PARTICIPANTS]: [participant("b1p"), participant("o1", "1")],
      [MEMBERS]: [...bothWays("bus-oslo", "o1")],
    });

    currentCtx = bergenAdmin;
    // Another campus's person onto their bus.
    await expect(
      moveToBus("b1", {
        busId: "bus-bergen",
        legs: "both",
        notify: false,
        participantIds: ["o1"],
      })
    ).rejects.toThrow("own campus");
    // Their own person onto another campus's bus.
    await expect(
      moveToBus("b1", {
        busId: "bus-oslo",
        legs: "both",
        notify: false,
        participantIds: ["b1p"],
      })
    ).rejects.toThrow("own campus");
    // Another campus's person off their bus.
    await expect(
      moveToBus("b1", {
        busId: null,
        legs: "both",
        notify: false,
        participantIds: ["o1"],
      })
    ).rejects.toThrow("own campus");
    // Pins and groups follow the same rule.
    await expect(
      setPinned("b1", { participantIds: ["o1"], pinned: true })
    ).rejects.toThrow("own campus");

    // Full access still keeps people on their own campus's buses.
    currentCtx = globalAdmin;
    await expect(
      moveToBus("b1", {
        busId: "bus-bergen",
        legs: "both",
        notify: false,
        participantIds: ["o1"],
      })
    ).rejects.toThrow("campus");
    expect(writeCount()).toBe(0);
    expect(placesOf("o1")).toEqual([
      "bus-oslo:home:false",
      "bus-oslo:out:false",
    ]);
  });

  test("moving after publishing marks a notice when asked, not otherwise", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
        [PARTICIPANTS]: [
          participant("p1"),
          participant("p2"),
          participant("p3"),
        ],
        [MEMBERS]: [
          ...bothWays("bus-a", "p1"),
          ...bothWays("bus-a", "p2"),
          ...bothWays("bus-b", "p3"),
        ],
      },
      bigEvent(PUBLISHED)
    );

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: true,
      participantIds: ["p1", "p3"],
    });
    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: false,
      participantIds: ["p2"],
    });

    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p2")).toBeNull();
    // Already on that bus: nothing changed, nothing to tell.
    expect(noticeOf("p3")).toBeNull();

    // Before publishing a move never owes a notice.
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [...bothWays("bus-a", "p1")],
    });
    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: true,
      participantIds: ["p1"],
    });
    expect(noticeOf("p1")).toBeNull();
  });

  test("moving twice keeps one pending notice", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
        [PARTICIPANTS]: [participant("p1")],
        [MEMBERS]: [...bothWays("bus-a", "p1")],
      },
      bigEvent(PUBLISHED)
    );

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: true,
      participantIds: ["p1"],
    });
    expect(noticeOf("p1")).toBe(NOW);

    setSystemTime(new Date(LATER));
    await moveToBus("b1", {
      busId: "bus-a",
      legs: "out",
      notify: true,
      participantIds: ["p1"],
    });

    // One timestamp, overwritten: only the latest notice goes out.
    expect(noticeOf("p1")).toBe(LATER);
    expect(fake.rows(PARTICIPANTS)).toHaveLength(1);
    expect(fake.rows("big_event_deliveries")).toHaveLength(0);
    expect(placesOf("p1")).toEqual(["bus-a:out:true", "bus-b:home:true"]);
  });

  test("a failed hand move still leaves the notice", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
        [PARTICIPANTS]: [participant("p1"), participant("p2")],
        [MEMBERS]: [...bothWays("bus-a", "p1"), ...bothWays("bus-a", "p2")],
      },
      bigEvent(PUBLISHED)
    );
    // p2's new seats fail once; p1's are written.
    let failures = 2;
    fake.setBeforeWrite((write) => {
      if (
        write.kind === "create" &&
        write.data?.participant_id === "p2" &&
        failures > 0
      ) {
        failures -= 1;
        throw new Error("network");
      }
    });
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);

    const move = {
      busId: "bus-b",
      legs: "both" as const,
      notify: true,
      participantIds: ["p1", "p2"],
    };
    await expect(moveToBus("b1", move)).rejects.toThrow("Try again");
    quiet.mockRestore();

    // R11: notices are written before any seat changes.
    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p2")).toBe(NOW);
    expect(auditPayload("big_event.bus.move")).toMatchObject({
      complete: false,
    });

    // The retry finds p1 already on bus-b, so it owes p1 nothing new; the
    // notice from the first try is still there.
    setSystemTime(new Date(LATER));
    await moveToBus("b1", move);
    expect(placesOf("p1")).toEqual(["bus-b:home:true", "bus-b:out:true"]);
    expect(placesOf("p2")).toEqual(["bus-b:home:true", "bus-b:out:true"]);
    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p2")).toBe(LATER);
  });

  test("setPinned pins and unpins every bus seat of the people", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4), group("room-1", "room")],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [
        member("bus-a", "p1", "out"),
        member("bus-b", "p1", "home", true),
        member("room-1", "p1"),
      ],
    });

    await setPinned("b1", { participantIds: ["p1"], pinned: true });
    expect(placesOf("p1")).toEqual([
      "bus-a:out:true",
      "bus-b:home:true",
      "room-1:-:false",
    ]);
    // Only the seat that changed is written.
    expect(fake.db.updateRow).toHaveBeenCalledTimes(1);

    await setPinned("b1", { participantIds: ["p1"], pinned: false });
    expect(placesOf("p1")).toEqual([
      "bus-a:out:false",
      "bus-b:home:false",
      "room-1:-:false",
    ]);
    expect(auditCalls("big_event.bus.pin")).toHaveLength(2);
  });
});

describe("moving into groups", () => {
  test("moving into a room with a bus moves the person onto that bus", async () => {
    seed(
      {
        [GROUPS]: [
          bus("bus-a", 8),
          bus("bus-b", 8),
          group("room-1", "room", {
            capacity: 4,
            home_bus_id: "bus-a",
            out_bus_id: "bus-a",
          }),
          group("room-2", "room", { capacity: 4 }),
        ],
        [PARTICIPANTS]: [participant("p1"), participant("p2")],
        [MEMBERS]: [
          member("room-2", "p1"),
          ...bothWays("bus-b", "p1"),
          member("bus-b", "p2", "out", true),
          member("bus-b", "p2", "home"),
        ],
      },
      bigEvent(PUBLISHED)
    );

    const result = await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: true,
      participantIds: ["p1", "p2"],
    });

    // One room per person, and the room's bus both ways, pinned.
    expect(placesOf("p1")).toEqual([
      "bus-a:home:true",
      "bus-a:out:true",
      "room-1:-:true",
    ]);
    // A pinned way out stays, and so does p2's way home (R10, R3c/R19):
    // p2's bus didn't change.
    expect(placesOf("p2")).toEqual([
      "bus-b:home:false",
      "bus-b:out:true",
      "room-1:-:true",
    ]);
    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p2")).toBeNull();
    expect(result).toEqual({ moved: 2 });
  });

  test("moving someone into a room by hand pins that room place", async () => {
    seed({
      [GROUPS]: [group("room-1", "room"), group("room-2", "room")],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-2", "p1")],
    });

    await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p1"],
    });

    // Ruling R9: an import (which respects pins) can't undo the hand move.
    expect(placesOf("p1")).toEqual(["room-1:-:true"]);
    const created = fake.db.createRow.mock.calls.map(
      (call) => call[3] as Record<string, unknown>
    );
    expect(created).toEqual([
      expect.objectContaining({ group_id: "room-1", leg: null, pinned: true }),
    ]);
  });

  test("moving between buddy groups keeps one group per kind and leaves buses alone", async () => {
    seed(
      {
        [GROUPS]: [
          bus("bus-a", 8),
          group("buddy-1", "buddy"),
          group("buddy-2", "buddy"),
          group("team-1", "team"),
        ],
        [PARTICIPANTS]: [participant("p1")],
        [MEMBERS]: [
          member("buddy-1", "p1"),
          member("team-1", "p1"),
          ...bothWays("bus-a", "p1"),
        ],
      },
      bigEvent(PUBLISHED)
    );

    await moveToGroup("b1", {
      groupId: "buddy-2",
      kind: "buddy",
      notify: true,
      participantIds: ["p1"],
    });
    expect(placesOf("p1")).toEqual([
      "buddy-2:-:true",
      "bus-a:home:false",
      "bus-a:out:false",
      "team-1:-:false",
    ]);
    expect(noticeOf("p1")).toBeNull();

    await moveToGroup("b1", {
      groupId: null,
      kind: "team",
      notify: true,
      participantIds: ["p1"],
    });
    expect(placesOf("p1")).toEqual([
      "buddy-2:-:true",
      "bus-a:home:false",
      "bus-a:out:false",
    ]);

    await expect(
      moveToGroup("b1", {
        groupId: "bus-a",
        kind: "room",
        notify: true,
        participantIds: ["p1"],
      })
    ).rejects.toThrow("no longer exists");
  });

  test("campus admins can't move people into other campuses' groups", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        group("room-bergen", "room"),
        group("room-oslo", "room", { campus_id: "1" }),
      ],
      [PARTICIPANTS]: [participant("p1"), participant("o1", "1")],
    });

    await expect(
      moveToGroup("b1", {
        groupId: "room-oslo",
        kind: "room",
        notify: false,
        participantIds: ["p1"],
      })
    ).rejects.toThrow("own campus");
    await expect(
      moveToGroup("b1", {
        groupId: "room-bergen",
        kind: "room",
        notify: false,
        participantIds: ["o1"],
      })
    ).rejects.toThrow("own campus");
    expect(writeCount()).toBe(0);
  });

  test("already in the room → that place gets pinned", async () => {
    seed({
      [GROUPS]: [group("room-1", "room")],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-1", "p1")],
    });

    const result = await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p1"],
    });

    // R9/R12: the place stays (same row) and is pinned; nobody moved.
    expect(placesOf("p1")).toEqual(["room-1:-:true"]);
    expect(fake.rows(MEMBERS).map((row) => row.$id)).toEqual(["room-1-p1-x"]);
    expect(fake.db.createRow).not.toHaveBeenCalled();
    expect(result).toEqual({ moved: 0 });
  });

  test("campus admins can't take people out of groups they can't change", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        group("team-national", "team", { campus_id: "5" }),
        group("team-none", "team", { campus_id: null }),
        group("team-bergen", "team"),
      ],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [member("team-national", "p1"), member("team-none", "p2")],
    });

    // Out of a National team: refused.
    await expect(
      moveToGroup("b1", {
        groupId: null,
        kind: "team",
        notify: false,
        participantIds: ["p1"],
      })
    ).rejects.toThrow("Someone here is in a group you can't change.");
    // Into their campus's team while in a team with no campus: refused.
    await expect(
      moveToGroup("b1", {
        groupId: "team-bergen",
        kind: "team",
        notify: false,
        participantIds: ["p2"],
      })
    ).rejects.toThrow("Someone here is in a group you can't change.");
    expect(writeCount()).toBe(0);
    expect(placesOf("p1")).toEqual(["team-national:-:false"]);
    expect(placesOf("p2")).toEqual(["team-none:-:false"]);
    expect(auditCalls("big_event.group.move")).toHaveLength(0);
  });

  test("a pinned way out takes the way home with it only when there's no way home yet", async () => {
    seed({
      [GROUPS]: [
        bus("bus-a", 8),
        bus("bus-b", 8),
        bus("bus-c", 8),
        group("room-1", "room", {
          capacity: 4,
          home_bus_id: "bus-a",
          out_bus_id: "bus-a",
        }),
      ],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [
        member("bus-b", "p1", "out", true),
        member("bus-c", "p1", "home"),
        member("bus-b", "p2", "out", true),
      ],
    });

    await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p1", "p2"],
    });

    // p1 keeps the way home they have, as auto-fill would (R3c, R19), and
    // never takes the room's (R10); p2 has none, so home follows the pinned
    // way out (R5).
    expect(placesOf("p1")).toEqual([
      "bus-b:out:true",
      "bus-c:home:false",
      "room-1:-:true",
    ]);
    expect(placesOf("p2")).toEqual([
      "bus-b:home:true",
      "bus-b:out:true",
      "room-1:-:true",
    ]);
  });

  test("someone of another campus joins the room but not its bus", async () => {
    seed({
      [GROUPS]: [
        bus("bus-a", 8),
        bus("bus-oslo", 8, "1"),
        group("room-1", "room", {
          campus_id: null,
          capacity: 4,
          home_bus_id: "bus-a",
          out_bus_id: "bus-a",
        }),
      ],
      [PARTICIPANTS]: [
        participant("p1"),
        participant("o1", "1"),
        participant("n1", null),
      ],
      [MEMBERS]: [...bothWays("bus-oslo", "o1")],
    });

    // R19: no refusal; each person rides the room's bus only on their campus.
    await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p1", "o1", "n1"],
    });

    expect(placesOf("p1")).toEqual([
      "bus-a:home:true",
      "bus-a:out:true",
      "room-1:-:true",
    ]);
    expect(placesOf("o1")).toEqual([
      "bus-oslo:home:false",
      "bus-oslo:out:false",
      "room-1:-:true",
    ]);
    expect(placesOf("n1")).toEqual(["room-1:-:true"]);
    // The room's people ride different buses: it keeps its own.
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-a"]);
  });

  test("a campus admin's people join a room on another campus's bus without riding it", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        bus("bus-oslo", 8, "1"),
        group("room-2", "room", {
          capacity: 4,
          home_bus_id: "bus-oslo",
          out_bus_id: "bus-oslo",
        }),
      ],
      [PARTICIPANTS]: [participant("p1")],
    });

    // The Oslo bus isn't Bergen's to change, but p1 wouldn't ride it anyway.
    await moveToGroup("b1", {
      groupId: "room-2",
      kind: "room",
      notify: false,
      participantIds: ["p1"],
    });

    expect(placesOf("p1")).toEqual(["room-2:-:true"]);
    expect(roomBuses("room-2")).toEqual(["bus-oslo", "bus-oslo"]);
  });

  test("a room move follows a pinned way out only onto a bus you can change", async () => {
    const roomOnBusA = () =>
      seed({
        [GROUPS]: [
          bus("bus-a", 8),
          bus("bus-oslo", 8, "1"),
          group("room-1", "room", {
            capacity: 4,
            home_bus_id: "bus-a",
            out_bus_id: "bus-a",
          }),
        ],
        [PARTICIPANTS]: [participant("p1")],
        // Pinned to another campus's bus (e.g. before a campus change, R4),
        // with no way home yet.
        [MEMBERS]: [member("bus-oslo", "p1", "out", true)],
      });
    const move = {
      groupId: "room-1",
      kind: "room" as const,
      notify: false,
      participantIds: ["p1"],
    };
    const expected = ["bus-a:home:true", "bus-oslo:out:true", "room-1:-:true"];

    // A campus admin can't change the Oslo bus: home takes the room's bus.
    currentCtx = bergenAdmin;
    roomOnBusA();
    await moveToGroup("b1", move);
    expect(placesOf("p1")).toEqual(expected);

    // Full access can change it, but it isn't p1's campus's bus.
    currentCtx = globalAdmin;
    roomOnBusA();
    await moveToGroup("b1", move);
    expect(placesOf("p1")).toEqual(expected);
  });

  test("a room with only a bus out gives the way home on the same bus", async () => {
    seed({
      [GROUPS]: [
        bus("bus-a", 8),
        group("room-1", "room", { capacity: 4, out_bus_id: "bus-a" }),
      ],
      [PARTICIPANTS]: [participant("p1")],
    });

    await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p1"],
    });

    // R12 (R5: home follows out).
    expect(placesOf("p1")).toEqual([
      "bus-a:home:true",
      "bus-a:out:true",
      "room-1:-:true",
    ]);
  });
});

describe("room buses follow hand moves (R18)", () => {
  /** A Payment 1 room: four places, only its buyer named so far. */
  const bookedRoom = (busId: string | null = "bus-a") =>
    group("room-1", "room", {
      capacity: 4,
      home_bus_id: busId,
      out_bus_id: busId,
    });

  test("moving a room's only named member moves the room's open places", async () => {
    seed(
      {
        [GROUPS]: [bus("bus-a", 8), bus("bus-b", 8), bookedRoom()],
        [PARTICIPANTS]: [participant("p1"), participant("p2")],
        [MEMBERS]: [member("room-1", "p1"), ...bothWays("bus-a", "p1")],
      },
      bigEvent(PUBLISHED)
    );

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: true,
      participantIds: ["p1"],
    });

    expect(roomBuses("room-1")).toEqual(["bus-b", "bus-b"]);
    // The buyer and the three open places all sit on bus-b now.
    expect(seatsNow()).toEqual({
      "bus-a": { home: 0, out: 0 },
      "bus-b": { home: 4, out: 4 },
    });
    // The room moving owes nobody a notice; p1's own move does.
    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p2")).toBeNull();

    // A roommate named later takes the room's new bus.
    await moveToGroup("b1", {
      groupId: "room-1",
      kind: "room",
      notify: false,
      participantIds: ["p2"],
    });
    expect(placesOf("p2")).toEqual([
      "bus-b:home:true",
      "bus-b:out:true",
      "room-1:-:true",
    ]);
    expect(seatsNow()).toEqual({
      "bus-a": { home: 0, out: 0 },
      "bus-b": { home: 4, out: 4 },
    });
  });

  test("a room stays put while its members are split", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 8), bus("bus-b", 8), bookedRoom()],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [
        member("room-1", "p1"),
        member("room-1", "p2"),
        ...bothWays("bus-a", "p1"),
        ...bothWays("bus-a", "p2"),
      ],
    });

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: false,
      participantIds: ["p1"],
    });
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-a"]);
    // p2 and the two open places stay on bus-a.
    expect(seatsNow()).toEqual({
      "bus-a": { home: 3, out: 3 },
      "bus-b": { home: 1, out: 1 },
    });

    // Once everyone named rides bus-b, the room follows.
    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: false,
      participantIds: ["p2"],
    });
    expect(roomBuses("room-1")).toEqual(["bus-b", "bus-b"]);
    expect(seatsNow()).toEqual({
      "bus-a": { home: 0, out: 0 },
      "bus-b": { home: 4, out: 4 },
    });
  });

  test("each leg follows on its own, and off the bus the room keeps its bus", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 8), bus("bus-b", 8), bookedRoom()],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-1", "p1"), ...bothWays("bus-a", "p1")],
    });

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "home",
      notify: false,
      participantIds: ["p1"],
    });
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-b"]);
    expect(seatsNow()).toEqual({
      "bus-a": { home: 0, out: 4 },
      "bus-b": { home: 4, out: 0 },
    });

    // Nobody named rides a bus now: the room's open places stay held.
    await moveToBus("b1", {
      busId: null,
      legs: "both",
      notify: false,
      participantIds: ["p1"],
    });
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-b"]);
  });

  test("a room without a bus gets the bus its people are moved onto", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 8), bookedRoom(null)],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-1", "p1")],
    });

    await moveToBus("b1", {
      busId: "bus-a",
      legs: "out",
      notify: false,
      participantIds: ["p1"],
    });

    // No way home yet, so home came with the way out (R5).
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-a"]);
    expect(seatsNow()).toEqual({ "bus-a": { home: 4, out: 4 } });
  });

  test("someone leaving or joining a room lets the room follow the people in it", async () => {
    seed({
      [GROUPS]: [
        bus("bus-a", 8),
        bus("bus-b", 8),
        bus("bus-c", 8),
        bookedRoom(),
        group("room-2", "room", { capacity: 2 }),
      ],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      // p1 and p2 ride different buses: room-1 is split and holds bus-a.
      [MEMBERS]: [
        member("room-1", "p1"),
        member("room-1", "p2"),
        ...bothWays("bus-b", "p1"),
        ...bothWays("bus-c", "p2"),
      ],
    });

    await moveToGroup("b1", {
      groupId: "room-2",
      kind: "room",
      notify: false,
      participantIds: ["p2"],
    });
    // room-1 now names only p1, room-2 only p2.
    expect(roomBuses("room-1")).toEqual(["bus-b", "bus-b"]);
    expect(roomBuses("room-2")).toEqual(["bus-c", "bus-c"]);

    // The last person out: an empty room keeps its bus.
    await moveToGroup("b1", {
      groupId: null,
      kind: "room",
      notify: false,
      participantIds: ["p1"],
    });
    expect(roomBuses("room-1")).toEqual(["bus-b", "bus-b"]);
  });

  test("a room the caller can't change keeps its bus", async () => {
    currentCtx = bergenAdmin;
    seed({
      [GROUPS]: [
        bus("bus-a", 8),
        bus("bus-b", 8),
        group("room-national", "room", {
          campus_id: "5",
          capacity: 4,
          home_bus_id: "bus-a",
          out_bus_id: "bus-a",
        }),
      ],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-national", "p1"), ...bothWays("bus-a", "p1")],
    });

    await moveToBus("b1", {
      busId: "bus-b",
      legs: "both",
      notify: false,
      participantIds: ["p1"],
    });

    expect(placesOf("p1")).toEqual([
      "bus-b:home:true",
      "bus-b:out:true",
      "room-national:-:false",
    ]);
    expect(roomBuses("room-national")).toEqual(["bus-a", "bus-a"]);
  });

  test("a room write that fails is made by moving again", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 8), bus("bus-b", 8), bookedRoom()],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [member("room-1", "p1"), ...bothWays("bus-a", "p1")],
    });
    let failures = 1;
    fake.setBeforeWrite((write) => {
      if (write.tableId === GROUPS && failures > 0) {
        failures -= 1;
        throw new Error("network");
      }
    });
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);
    const move = {
      busId: "bus-b",
      legs: "both" as const,
      notify: false,
      participantIds: ["p1"],
    };

    await expect(moveToBus("b1", move)).rejects.toThrow("Try again");
    quiet.mockRestore();
    expect(roomBuses("room-1")).toEqual(["bus-a", "bus-a"]);
    expect(auditPayload("big_event.bus.move")).toMatchObject({
      complete: false,
    });

    await moveToBus("b1", move);
    expect(roomBuses("room-1")).toEqual(["bus-b", "bus-b"]);
    expect(placesOf("p1")).toEqual([
      "bus-b:home:true",
      "bus-b:out:true",
      "room-1:-:false",
    ]);
    expect(auditPayload("big_event.bus.move")).toMatchObject({
      complete: true,
    });
  });
});

describe("publishing", () => {
  test("publishing marks a notice for everyone with a bus and can't run twice", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4), bus("bus-b", 4)],
      [PARTICIPANTS]: [
        participant("p1"),
        participant("p2"),
        participant("p3"),
        participant("p4", "1"),
      ],
      [MEMBERS]: [
        ...bothWays("bus-a", "p1"),
        // A way home but no way out: no bus to announce.
        member("bus-a", "p2", "home"),
        member("bus-b", "p4", "out"),
      ],
    });

    const result = await publishBusLists("b1");

    expect(result).toEqual({ notices: 2 });
    expect(noticeOf("p1")).toBe(NOW);
    expect(noticeOf("p4")).toBe(NOW);
    expect(noticeOf("p2")).toBeNull();
    expect(noticeOf("p3")).toBeNull();
    const event = fake.rows(EVENTS)[0];
    expect(event?.bus_lists_published_at).toBe(NOW);
    expect(event?.bus_lists_published_by).toBe("admin-1");
    expect(auditPayload("big_event.bus.publish")).toMatchObject({
      complete: true,
      notices: 2,
    });

    await expect(publishBusLists("b1")).rejects.toThrow("already published");
    expect(auditCalls("big_event.bus.publish")).toHaveLength(1);
  });

  test("a failed publish can be retried and marks everyone", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4)],
      [PARTICIPANTS]: [participant("p1"), participant("p2")],
      [MEMBERS]: [...bothWays("bus-a", "p1"), ...bothWays("bus-a", "p2")],
    });
    // p2's notice fails once.
    let failures = 1;
    fake.setBeforeWrite((write) => {
      if (write.rowId === "p2" && failures > 0) {
        failures -= 1;
        throw new Error("network");
      }
    });
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);

    await expect(publishBusLists("b1")).rejects.toThrow("Try again");
    quiet.mockRestore();

    // R11: notices first, the stamp last, so nothing is published yet.
    expect(fake.rows(EVENTS)[0]?.bus_lists_published_at).toBeNull();
    expect(noticeOf("p1")).toBe(NOW);
    expect(auditPayload("big_event.bus.publish")).toMatchObject({
      complete: false,
    });

    setSystemTime(new Date(LATER));
    await expect(publishBusLists("b1")).resolves.toEqual({ notices: 2 });
    expect(noticeOf("p1")).toBe(LATER);
    expect(noticeOf("p2")).toBe(LATER);
    expect(fake.rows(EVENTS)[0]?.bus_lists_published_at).toBe(LATER);
  });

  test("publishing needs settings access", async () => {
    seed({
      [GROUPS]: [bus("bus-a", 4)],
      [PARTICIPANTS]: [participant("p1")],
      [MEMBERS]: [...bothWays("bus-a", "p1")],
    });

    // A campus admin on a National big event can't change its settings.
    currentCtx = bergenAdmin;
    await expect(publishBusLists("b1")).rejects.toThrow("settings");
    expect(fake.rows(EVENTS)[0]?.bus_lists_published_at).toBeNull();
    expect(noticeOf("p1")).toBeNull();
    expect(writeCount()).toBe(0);

    // On their own campus's big event they can.
    seed(
      {
        [GROUPS]: [bus("bus-a", 4)],
        [PARTICIPANTS]: [participant("p1")],
        [MEMBERS]: [...bothWays("bus-a", "p1")],
      },
      bigEvent({ campus_id: "2" })
    );
    await expect(publishBusLists("b1")).resolves.toEqual({ notices: 1 });
  });
});
