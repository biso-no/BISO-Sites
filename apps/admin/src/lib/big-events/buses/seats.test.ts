import { describe, expect, test } from "bun:test";
import { busOf, busSeatUse } from "./seats";
import { bothWays, bus, inRoom, onBus, room } from "./test-rows";

describe("busSeatUse", () => {
  test("counts open places of a room on its bus", () => {
    const buses = [bus("bus-a", 50), bus("bus-b", 50)];
    const rooms = [
      // 4 places, 1 named → 3 open; out on A, home on B.
      room("room-1", 4, { out_bus_id: "bus-a", home_bus_id: "bus-b" }),
      // Full: no open places.
      room("room-2", 2, { out_bus_id: "bus-a", home_bus_id: "bus-a" }),
      // No capacity: no open places.
      room("room-3", null, { out_bus_id: "bus-b", home_bus_id: "bus-b" }),
    ];
    const members = [
      inRoom("room-1", "p1"),
      ...bothWays("bus-a", "p1"),
      inRoom("room-2", "p2"),
      inRoom("room-2", "p3"),
      ...bothWays("bus-a", "p2"),
      ...bothWays("bus-a", "p3"),
      ...bothWays("bus-b", "p4"),
    ];

    expect(busSeatUse({ buses, rooms, members })).toEqual(
      new Map([
        ["bus-a", { out: 3 + 3, home: 3 }],
        ["bus-b", { out: 1, home: 1 + 3 }],
      ])
    );
  });

  test("counts a person once per leg and ignores rooms and other buses", () => {
    const members = [
      onBus("bus-a", "p1", "out"),
      { ...onBus("bus-a", "p1", "out"), $id: "duplicate" },
      onBus("bus-z", "p2", "out"),
      inRoom("room-1", "p3"),
    ];

    expect(
      busSeatUse({ buses: [bus("bus-a", 10)], rooms: [], members })
    ).toEqual(new Map([["bus-a", { out: 1, home: 0 }]]));
  });
});

describe("busOf", () => {
  test("finds a person's bus for one leg among the given buses", () => {
    const members = [
      inRoom("room-1", "p1"),
      onBus("bus-a", "p1", "out"),
      onBus("bus-b", "p1", "home"),
      onBus("bus-z", "p2", "out"),
    ];
    const buses = new Set(["bus-a", "bus-b"]);

    expect(busOf("p1", "out", members, buses)).toBe("bus-a");
    expect(busOf("p1", "home", members, buses)).toBe("bus-b");
    expect(busOf("p2", "out", members, buses)).toBeNull();
  });

  test("prefers a pinned seat when a person is on two buses", () => {
    const members = [
      onBus("bus-a", "p1", "out"),
      onBus("bus-b", "p1", "out", true),
    ];

    expect(busOf("p1", "out", members, new Set(["bus-a", "bus-b"]))).toBe(
      "bus-b"
    );
  });
});
