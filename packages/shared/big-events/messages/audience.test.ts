import { describe, expect, it } from "vitest";
import type { GroupLeg } from "../tables";
import { type Audience, resolveAudience } from "./audience";

const participants = [
  { $id: "p-oslo-1", campus_id: "1" },
  { $id: "p-oslo-2", campus_id: "1" },
  { $id: "p-bergen-1", campus_id: "2" },
  { $id: "p-no-campus", campus_id: null },
];

function seat(groupId: string, participantId: string, leg: GroupLeg | null) {
  return { group_id: groupId, leg, participant_id: participantId };
}

const members = [
  seat("bus-1", "p-oslo-1", "out"),
  seat("bus-1", "p-oslo-2", "home"),
  seat("bus-2", "p-oslo-2", "out"),
  seat("bus-2", "p-oslo-1", "home"),
  seat("room-1", "p-oslo-1", null),
  seat("room-1", "p-bergen-1", null),
  seat("buddy-1", "p-bergen-1", null),
  seat("buddy-1", "p-gone", null),
];

function resolve(audience: Audience, allowedCampusIds: string[] | "all") {
  return resolveAudience({
    allowedCampusIds,
    audience,
    members,
    participants,
  });
}

describe("resolveAudience", () => {
  it("a campus admin's everyone is their campus", () => {
    expect(resolve({ type: "everyone" }, ["1"])).toEqual([
      "p-oslo-1",
      "p-oslo-2",
    ]);
    expect(resolve({ type: "everyone" }, "all")).toEqual([
      "p-bergen-1",
      "p-no-campus",
      "p-oslo-1",
      "p-oslo-2",
    ]);
    // Asking for another campus, or for people elsewhere, reaches nobody there.
    expect(resolve({ campusIds: ["1", "2"], type: "campus" }, ["2"])).toEqual([
      "p-bergen-1",
    ]);
    expect(
      resolve(
        {
          participantIds: ["p-bergen-1", "p-oslo-2", "p-no-campus"],
          type: "people",
        },
        ["1"]
      )
    ).toEqual(["p-oslo-2"]);
    expect(resolve({ groupIds: ["room-1"], type: "groups" }, ["2"])).toEqual([
      "p-bergen-1",
    ]);
  });

  it("a bus audience uses the chosen leg", () => {
    expect(
      resolve({ groupIds: ["bus-1"], leg: "home", type: "groups" }, "all")
    ).toEqual(["p-oslo-2"]);
    expect(
      resolve(
        { groupIds: ["bus-1", "bus-2"], leg: "home", type: "groups" },
        "all"
      )
    ).toEqual(["p-oslo-1", "p-oslo-2"]);
    // No leg chosen means the way out (plan M5).
    expect(resolve({ groupIds: ["bus-1"], type: "groups" }, "all")).toEqual([
      "p-oslo-1",
    ]);
    // Rooms and buddy groups have no legs: everyone in them, whatever the leg.
    expect(
      resolve(
        {
          groupIds: ["bus-2", "room-1", "buddy-1"],
          leg: "home",
          type: "groups",
        },
        "all"
      )
    ).toEqual(["p-bergen-1", "p-oslo-1"]);
  });

  it("dedupes, sorts and drops people who aren't participants", () => {
    expect(
      resolve(
        {
          participantIds: ["p-oslo-2", "p-gone", "p-oslo-1", "p-oslo-2"],
          type: "people",
        },
        "all"
      )
    ).toEqual(["p-oslo-1", "p-oslo-2"]);
    expect(resolve({ groupIds: ["buddy-1"], type: "groups" }, "all")).toEqual([
      "p-bergen-1",
    ]);
    expect(resolve({ campusIds: [], type: "campus" }, "all")).toEqual([]);
  });
});
