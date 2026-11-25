import { describe, expect, test } from "bun:test";
import {
  type AutoFillInput,
  type AutoFillPlan,
  planAutoFill,
} from "./plan-auto-fill";
import {
  bothWays,
  bus,
  inRoom,
  onBus,
  people,
  person,
  room,
} from "./test-rows";

function fill(input: Partial<AutoFillInput>): AutoFillPlan {
  return planAutoFill({
    campusId: "1",
    buses: [],
    participants: [],
    rooms: [],
    members: [],
    onlyUnseated: false,
    ...input,
  });
}

function busFor(plan: AutoFillPlan, participantId: string): string | null {
  return (
    plan.moves.find((move) => move.participantId === participantId)?.busId ??
    null
  );
}

function moved(plan: AutoFillPlan): string[] {
  return plan.moves.map((move) => move.participantId).sort();
}

describe("planAutoFill", () => {
  test("spreads people evenly across a campus's buses", () => {
    const plan = fill({
      buses: [bus("bus-a", 50), bus("bus-b", 50)],
      participants: people(60),
    });

    expect(plan.seatsAfter).toEqual(
      new Map([
        ["bus-a", { out: 30, home: 30 }],
        ["bus-b", { out: 30, home: 30 }],
      ])
    );
    expect(plan.moves).toHaveLength(60);
    expect(plan.moves.every((move) => move.legs.join() === "out,home")).toBe(
      true
    );
    expect(plan.unplaced).toEqual([]);
  });

  test("repacks unpinned people before publishing", () => {
    const plan = fill({
      buses: [bus("bus-a", 4), bus("bus-b", 4)],
      participants: people(4),
      members: ["p01", "p02", "p03", "p04"].flatMap((id) =>
        bothWays("bus-a", id)
      ),
    });

    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 2, home: 2 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 2, home: 2 });
    expect(moved(plan)).toEqual(["p01", "p02", "p03", "p04"]);
  });

  test("keeps a room together", () => {
    // room-1 holds 4: three named and one open place, so it needs 4 seats.
    const plan = fill({
      buses: [bus("bus-a", 5), bus("bus-b", 5)],
      participants: [person("r1"), person("r2"), person("r3"), ...people(4)],
      rooms: [room("room-1", 4)],
      members: [
        inRoom("room-1", "r1"),
        inRoom("room-1", "r2"),
        inRoom("room-1", "r3"),
      ],
    });

    expect(busFor(plan, "r1")).toBe("bus-a");
    expect(busFor(plan, "r2")).toBe("bus-a");
    expect(busFor(plan, "r3")).toBe("bus-a");
    expect(plan.roomBuses).toEqual([{ roomId: "room-1", busId: "bus-a" }]);
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 4, home: 4 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 4, home: 4 });
  });

  test("pinned people never move and their seats count", () => {
    const plan = fill({
      buses: [bus("bus-a", 3), bus("bus-b", 3)],
      participants: [person("p00"), ...people(4)],
      members: [...bothWays("bus-a", "p00", true), ...bothWays("bus-b", "p01")],
    });

    expect(moved(plan)).toEqual(["p01", "p02", "p03", "p04"]);
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 3, home: 3 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 2, home: 2 });
  });

  test("a room with a pinned member goes to that member's bus", () => {
    const plan = fill({
      buses: [bus("bus-a", 2), bus("bus-b", 10)],
      participants: [person("m1"), person("m2"), person("m3"), person("s1")],
      rooms: [room("room-1", 3)],
      members: [
        inRoom("room-1", "m1"),
        inRoom("room-1", "m2"),
        inRoom("room-1", "m3"),
        ...bothWays("bus-a", "m1", true),
      ],
    });

    expect(busFor(plan, "m1")).toBeNull();
    expect(busFor(plan, "m2")).toBe("bus-a");
    expect(busFor(plan, "m3")).toBe("bus-a");
    expect(busFor(plan, "s1")).toBe("bus-b");
    expect(plan.roomBuses).toEqual([{ roomId: "room-1", busId: "bus-a" }]);
    // Over its 2 seats: capacity is a warning, not a stop.
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 3, home: 3 });
  });

  test("a room too big for any bus is reported", () => {
    const plan = fill({
      buses: [bus("bus-a", 3), bus("bus-b", 2)],
      participants: [person("m1"), person("m2")],
      rooms: [room("room-1", 4)],
      members: [inRoom("room-1", "m1"), inRoom("room-1", "m2")],
    });

    expect(plan.unplaced).toEqual([
      { participantIds: ["m1", "m2"], roomId: "room-1", reason: "too_big" },
    ]);
    expect(plan.moves).toEqual([]);
    expect(plan.roomBuses).toEqual([]);
  });

  test("a room pinned to two buses is reported as split", () => {
    const plan = fill({
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [person("m1"), person("m2"), person("m3")],
      rooms: [room("room-1", 3)],
      members: [
        inRoom("room-1", "m1"),
        inRoom("room-1", "m2"),
        inRoom("room-1", "m3"),
        onBus("bus-a", "m1", "out", true),
        onBus("bus-b", "m2", "out", true),
        ...bothWays("bus-a", "m3"),
      ],
    });

    expect(plan.unplaced).toEqual([
      { participantIds: ["m3"], roomId: "room-1", reason: "split_room" },
    ]);
    // m3 isn't moved; m1 and m2, pinned out only, get a way home.
    expect(plan.moves).toEqual([
      { participantId: "m1", busId: "bus-a", legs: ["home"] },
      { participantId: "m2", busId: "bus-b", legs: ["home"] },
    ]);
    expect(plan.roomBuses).toEqual([]);
    // m3 keeps the seat they had.
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 2, home: 2 });
  });

  test("reports people without a seat", () => {
    // room-1 and room-2 need 2 seats each; the one bus has 3.
    const plan = fill({
      buses: [bus("bus-a", 3)],
      participants: [person("r1"), person("r2"), ...people(4)],
      rooms: [room("room-1", 2), room("room-2", 2)],
      members: [
        inRoom("room-1", "r1"),
        inRoom("room-2", "r2"),
        ...bothWays("bus-a", "p04"),
      ],
    });

    expect(plan.unplaced).toEqual([
      { participantIds: ["r2"], roomId: "room-2", reason: "no_seat" },
      {
        participantIds: ["p02", "p03", "p04"],
        roomId: null,
        reason: "no_seat",
      },
    ]);
    const withoutSeat = plan.unplaced.flatMap((entry) => entry.participantIds);
    expect(withoutSeat).toHaveLength(4);
    expect(moved(plan)).toEqual(["p01", "r1"]);
    // p04 loses the seat they had: the repack gave it away.
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 3, home: 3 });
  });

  test("with no buses everyone is reported without a seat", () => {
    const plan = fill({ participants: people(2) });

    expect(plan.unplaced).toEqual([
      { participantIds: ["p01", "p02"], roomId: null, reason: "no_seat" },
    ]);
  });

  test("only seats unseated people when asked", () => {
    const plan = fill({
      onlyUnseated: true,
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [
        person("r1"),
        person("r2"),
        person("s1"),
        person("s2"),
        person("s3"),
        person("s4"),
      ],
      rooms: [room("room-1", 3, { out_bus_id: "bus-a", home_bus_id: "bus-a" })],
      members: [
        inRoom("room-1", "r1"),
        inRoom("room-1", "r2"),
        ...bothWays("bus-a", "r1"),
        ...bothWays("bus-a", "s1"),
        // s4 has a home bus but no out bus.
        onBus("bus-b", "s4", "home"),
      ],
    });

    // Seated people (r1, s1) keep their bus; r2 joins the room's bus.
    expect(moved(plan)).toEqual(["r2", "s2", "s3", "s4"]);
    expect(busFor(plan, "r2")).toBe("bus-a");
    expect(plan.moves.find((move) => move.participantId === "s4")).toEqual({
      participantId: "s4",
      busId: "bus-b",
      legs: ["out"],
    });
    expect(plan.roomBuses).toEqual([]);
    // bus-a: r1, s1, r2 and room-1's open place.
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 4, home: 4 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 3, home: 3 });
  });

  test("home follows out except pinned home legs", () => {
    const plan = fill({
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [person("s1"), person("s2")],
      members: [onBus("bus-b", "s1", "home", true)],
    });

    expect(plan.moves).toEqual([
      { participantId: "s1", busId: "bus-a", legs: ["out"] },
      { participantId: "s2", busId: "bus-b", legs: ["out", "home"] },
    ]);
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 1, home: 0 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 1, home: 2 });
  });

  test("everyone with an out bus gets a way home", () => {
    // A repack: s1 is pinned out only; s2 is pinned out and rides home on B.
    const repack = fill({
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [person("s1"), person("s2")],
      members: [
        onBus("bus-a", "s1", "out", true),
        onBus("bus-a", "s2", "out", true),
        onBus("bus-b", "s2", "home"),
      ],
    });

    expect(repack.moves).toEqual([
      { participantId: "s1", busId: "bus-a", legs: ["home"] },
    ]);
    expect(repack.seatsAfter.get("bus-a")).toEqual({ out: 2, home: 1 });
    expect(repack.seatsAfter.get("bus-b")).toEqual({ out: 0, home: 1 });

    // After publishing: an out seat but no home seat.
    const published = fill({
      onlyUnseated: true,
      buses: [bus("bus-a", 10)],
      participants: [person("s1")],
      members: [onBus("bus-a", "s1", "out")],
    });

    expect(published.moves).toEqual([
      { participantId: "s1", busId: "bus-a", legs: ["home"] },
    ]);
    expect(published.seatsAfter.get("bus-a")).toEqual({ out: 1, home: 1 });
  });

  test("after publishing a room keeps its home bus", () => {
    const plan = fill({
      onlyUnseated: true,
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [person("r1")],
      rooms: [room("room-1", 3, { out_bus_id: "bus-a", home_bus_id: "bus-b" })],
      members: [
        inRoom("room-1", "r1"),
        onBus("bus-a", "r1", "out"),
        onBus("bus-b", "r1", "home"),
      ],
    });

    expect(plan.roomBuses).toEqual([]);
    expect(plan.moves).toEqual([]);
    // r1 plus room-1's two open places, out on A and home on B.
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 3, home: 0 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 0, home: 3 });
  });

  test("in a repack only a pinned seat ties a room to a bus", () => {
    // m1 is pinned to another campus's bus and has a stale seat on B.
    const plan = fill({
      buses: [bus("bus-a", 10), bus("bus-b", 10)],
      participants: [person("m1"), person("m2")],
      rooms: [room("room-1", 2)],
      members: [
        inRoom("room-1", "m1"),
        inRoom("room-1", "m2"),
        onBus("bus-z", "m1", "out", true),
        onBus("bus-b", "m1", "out"),
      ],
    });

    expect(plan.moves).toEqual([
      { participantId: "m2", busId: "bus-a", legs: ["out", "home"] },
    ]);
    expect(plan.roomBuses).toEqual([{ roomId: "room-1", busId: "bus-a" }]);
    expect(plan.unplaced).toEqual([]);
  });

  test("an overfilled pinned-room bus pushes later units to other buses", () => {
    const plan = fill({
      buses: [bus("bus-a", 3), bus("bus-b", 3)],
      participants: [
        person("m1"),
        person("m2"),
        person("m3"),
        person("m4"),
        ...people(3),
      ],
      rooms: [room("room-1", 4)],
      members: [
        inRoom("room-1", "m1"),
        inRoom("room-1", "m2"),
        inRoom("room-1", "m3"),
        inRoom("room-1", "m4"),
        ...bothWays("bus-a", "m1", true),
      ],
    });

    for (const id of ["m2", "m3", "m4"]) {
      expect(busFor(plan, id)).toBe("bus-a");
    }
    for (const id of ["p01", "p02", "p03"]) {
      expect(busFor(plan, id)).toBe("bus-b");
    }
    expect(plan.seatsAfter.get("bus-a")).toEqual({ out: 4, home: 4 });
    expect(plan.seatsAfter.get("bus-b")).toEqual({ out: 3, home: 3 });
    expect(plan.unplaced).toEqual([]);
  });

  test("a pin on another campus's bus doesn't move the room there", () => {
    const plan = fill({
      buses: [bus("bus-a", 10), bus("bus-z", 10, "2")],
      participants: [person("m1"), person("m2")],
      rooms: [room("room-1", 3)],
      members: [
        inRoom("room-1", "m1"),
        inRoom("room-1", "m2"),
        ...bothWays("bus-z", "m1", true),
      ],
    });

    expect(plan.moves).toEqual([
      { participantId: "m2", busId: "bus-a", legs: ["out", "home"] },
    ]);
    expect(plan.roomBuses).toEqual([{ roomId: "room-1", busId: "bus-a" }]);
    expect(plan.unplaced).toEqual([]);
    // m2 and room-1's open place.
    expect(plan.seatsAfter).toEqual(new Map([["bus-a", { out: 2, home: 2 }]]));
  });

  test("ignores other campuses", () => {
    const plan = fill({
      buses: [bus("bus-a", 10), bus("bus-z", 10, "2")],
      participants: [person("p1"), person("q1", "2"), person("n1", null)],
      // A room on campus 2 isn't a unit when filling campus 1's buses.
      rooms: [room("room-z", 4, { campus_id: "2" })],
      members: [inRoom("room-z", "p1"), inRoom("room-z", "q1")],
    });

    expect(plan.moves).toEqual([
      { participantId: "p1", busId: "bus-a", legs: ["out", "home"] },
    ]);
    expect(plan.roomBuses).toEqual([]);
    expect(plan.unplaced).toEqual([]);
    expect(plan.seatsAfter).toEqual(new Map([["bus-a", { out: 1, home: 1 }]]));
  });

  test("gives the same plan whatever order the rows come in", () => {
    const input: Partial<AutoFillInput> = {
      buses: [bus("bus-a", 6), bus("bus-b", 6)],
      participants: [person("r1"), person("r2"), ...people(7)],
      rooms: [room("room-1", 3), room("room-2", 2)],
      members: [
        inRoom("room-1", "r1"),
        inRoom("room-2", "r2"),
        ...bothWays("bus-b", "p03", true),
      ],
    };
    const reversed: Partial<AutoFillInput> = {
      buses: [...(input.buses ?? [])].reverse(),
      participants: [...(input.participants ?? [])].reverse(),
      rooms: [...(input.rooms ?? [])].reverse(),
      members: [...(input.members ?? [])].reverse(),
    };

    expect(fill(reversed)).toEqual(fill(input));
  });
});
