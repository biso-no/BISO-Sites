import { describe, expect, test } from "bun:test";
import type { BigEventGroupRow } from "@repo/shared/big-events/types";
import { bus, room } from "@/lib/big-events/buses/test-rows";
import type {
  BoardPerson,
  GroupMemberView,
  GroupsView,
  GroupView,
} from "../../../../_actions/big-event-groups";
import {
  boardCampuses,
  boardColumns,
  defaultBoardCampus,
  movingPeople,
  NO_BUS,
  roomMoveChangesBus,
} from "./bus-board-model";

function seat(
  participantId: string,
  name: string,
  leg: "out" | "home",
  overrides: Partial<GroupMemberView> = {}
): GroupMemberView {
  return {
    campusId: "2",
    leg,
    name,
    participantId,
    pinned: false,
    roomName: null,
    ...overrides,
  };
}

function free(
  participantId: string,
  name: string,
  campusId: string | null = "2"
): BoardPerson {
  return { campusId, name, participantId, roomName: null };
}

function view(
  row: BigEventGroupRow,
  overrides: Partial<GroupView> = {}
): GroupView {
  return {
    ...row,
    members: [],
    openPlaces: null,
    riders: null,
    seats: null,
    ...overrides,
  };
}

function groupsView(overrides: Partial<GroupsView> = {}): GroupsView {
  return {
    campuses: ["1", "2"],
    canPublish: true,
    groups: [],
    manageableCampuses: ["1", "2", "3", "4", "5"],
    outRiders: 0,
    publishedAt: null,
    travel: true,
    unseated: [],
    ...overrides,
  };
}

const bus1 = view(
  { ...bus("bus-1", 2, "2"), name: "Bus 1" },
  {
    members: [
      seat("p1", "Ola Nordmann", "out", { pinned: true, roomName: "Ola" }),
      seat("p1", "Ola Nordmann", "home"),
      seat("p2", "Kari Nordmann", "out"),
      seat("p3", "Per Hansen", "out"),
    ],
    seats: { home: 1, out: 3 },
  }
);
const bus3 = view(
  { ...bus("bus-3", null, "2"), name: "Bus 3" },
  {
    members: [
      seat("p2", "Kari Nordmann", "home"),
      seat("p4", "Anne Berg", "home"),
    ],
    seats: { home: 2, out: 0 },
  }
);
const osloBus = view({ ...bus("bus-o", 50, "1"), name: "Oslo bus" });

describe("boardCampuses", () => {
  test("campuses with buses or people, never National", () => {
    const shown = groupsView({
      groups: [bus1, view(room("r5", 2, { campus_id: "5" }))],
      unseated: [free("p9", "Ida", "3"), free("p8", "Nils", null)],
    });
    expect(boardCampuses(shown)).toEqual(["2", "3"]);
  });

  test("falls back to the caller's campuses on an empty event", () => {
    expect(boardCampuses(groupsView())).toEqual(["1", "2", "3", "4"]);
  });
});

describe("defaultBoardCampus", () => {
  test("the first campus with a bus, else the first campus listed", () => {
    const shown = groupsView({
      groups: [bus1],
      unseated: [free("p9", "Ida", "1")],
    });
    expect(defaultBoardCampus(shown, boardCampuses(shown))).toBe("2");
    const noBuses = groupsView({ unseated: [free("p9", "Ida", "3")] });
    expect(defaultBoardCampus(noBuses, boardCampuses(noBuses))).toBe("3");
  });
});

describe("boardColumns", () => {
  const shown = groupsView({
    groups: [bus1, bus3, osloBus],
    unseated: [free("p5", "Bo Lie"), free("p6", "Oda Lie", "1")],
  });

  test("not on a bus first, then the campus's buses with their people", () => {
    const columns = boardColumns(shown, "2");
    expect(columns.map((column) => column.id)).toEqual([
      NO_BUS,
      "bus-1",
      "bus-3",
    ]);
    expect(columns[0]?.people.map((chip) => chip.name)).toEqual(["Bo Lie"]);
    expect(columns[1]?.people.map((chip) => chip.name)).toEqual([
      "Kari Nordmann",
      "Ola Nordmann",
      "Per Hansen",
    ]);
    // Only a way home: shown on the home bus.
    expect(columns[2]?.people.map((chip) => chip.name)).toEqual(["Anne Berg"]);
  });

  test("a chip says when the way home differs, or only one way is booked", () => {
    const [, first, third] = boardColumns(shown, "2");
    const chip = (id: string) =>
      [...(first?.people ?? []), ...(third?.people ?? [])].find(
        (person) => person.participantId === id
      );
    expect(chip("p1")).toMatchObject({
      homeBus: null,
      onlyLeg: null,
      pinned: true,
      roomName: "Ola",
    });
    expect(chip("p2")).toMatchObject({ homeBus: "Bus 3", onlyLeg: null });
    expect(chip("p3")).toMatchObject({ homeBus: null, onlyLeg: "out" });
    expect(chip("p4")).toMatchObject({ homeBus: null, onlyLeg: "home" });
  });

  test("marks the legs with more people than seats, as a warning only", () => {
    const [, first, third] = boardColumns(shown, "2");
    expect(first?.over).toEqual(["out"]);
    // No seat count: never over.
    expect(third?.over).toEqual([]);
  });
});

describe("movingPeople", () => {
  const columnOf = new Map([
    ["p1", "bus-1"],
    ["p2", "bus-1"],
    ["p5", NO_BUS],
  ]);

  test("the selection when the dragged person is in it, minus people already there", () => {
    const selection = new Set(["p1", "p5"]);
    expect(movingPeople("p1", selection, columnOf, "bus-3")).toEqual([
      "p1",
      "p5",
    ]);
    expect(movingPeople("p1", selection, columnOf, "bus-1")).toEqual(["p5"]);
  });

  test("only the dragged person when they aren't selected", () => {
    expect(movingPeople("p2", new Set(["p1"]), columnOf, NO_BUS)).toEqual([
      "p2",
    ]);
    expect(movingPeople("p2", new Set(), columnOf, "bus-1")).toEqual([]);
  });

  test("leaves out people no longer on the board", () => {
    expect(
      movingPeople("p1", new Set(["p1", "gone"]), columnOf, "bus-3")
    ).toEqual(["p1"]);
  });
});

describe("roomMoveChangesBus", () => {
  const busA = view({ ...bus("bus-a", 50, "2"), name: "Bus A" });
  const busB = view({ ...bus("bus-b", 50, "2"), name: "Bus B" });
  const roomOn = (busId: string | null, homeBusId: string | null = null) =>
    view(
      room("room-x", 4, {
        campus_id: "2",
        home_bus_id: homeBusId,
        out_bus_id: busId,
      })
    );
  const riding = (seats: [string, "out" | "home", boolean][]): GroupView[] =>
    [busA, busB].map((one) => ({
      ...one,
      members: seats
        .filter(([busId]) => busId === one.$id)
        .map(([, leg, pinned]) => seat("p1", "Ola", leg, { pinned })),
    }));
  const ola = { campusId: "2", participantId: "p1" };

  test("no prompt for a room on the bus they already ride", () => {
    const groups = riding([
      ["bus-a", "out", false],
      ["bus-a", "home", false],
    ]);
    expect(roomMoveChangesBus(groups, roomOn("bus-a"), ola)).toBe(false);
    expect(roomMoveChangesBus(groups, roomOn("bus-a", "bus-a"), ola)).toBe(
      false
    );
  });

  test("a room on another bus, or a first bus, changes it", () => {
    const groups = riding([
      ["bus-a", "out", false],
      ["bus-a", "home", false],
    ]);
    expect(roomMoveChangesBus(groups, roomOn("bus-b"), ola)).toBe(true);
    // Same way out, other way home.
    expect(roomMoveChangesBus(groups, roomOn("bus-a", "bus-b"), ola)).toBe(
      true
    );
    expect(roomMoveChangesBus(riding([]), roomOn("bus-a"), ola)).toBe(true);
  });

  test("pinned legs stay, and a pinned way out keeps the way home with it", () => {
    const pinnedBoth = riding([
      ["bus-a", "out", true],
      ["bus-a", "home", true],
    ]);
    expect(roomMoveChangesBus(pinnedBoth, roomOn("bus-b"), ola)).toBe(false);
    // Out pinned on A, home unpinned on A: home follows the pinned way out.
    const pinnedOut = riding([
      ["bus-a", "out", true],
      ["bus-a", "home", false],
    ]);
    expect(roomMoveChangesBus(pinnedOut, roomOn("bus-b"), ola)).toBe(false);
    // But not onto a bus of another campus.
    const elsewhere = { campusId: "3", participantId: "p1" };
    expect(roomMoveChangesBus(pinnedOut, roomOn("bus-b"), elsewhere)).toBe(
      true
    );
  });

  test("no bus change without a room bus the caller sees", () => {
    const groups = riding([["bus-a", "out", false]]);
    expect(roomMoveChangesBus(groups, roomOn(null), ola)).toBe(false);
    expect(roomMoveChangesBus(groups, roomOn("bus-gone"), ola)).toBe(false);
    expect(roomMoveChangesBus(groups, null, ola)).toBe(false);
    const buddy = { ...roomOn("bus-b"), kind: "buddy" as const };
    expect(roomMoveChangesBus(groups, buddy, ola)).toBe(false);
  });
});
