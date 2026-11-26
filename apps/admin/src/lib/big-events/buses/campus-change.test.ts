import { describe, expect, test } from "bun:test";
import { seatsOffCampus } from "./campus-change";

const busCampus = new Map<string, string | null>([
  ["oslo-1", "1"],
  ["bergen-1", "2"],
  ["no-campus", null],
]);

describe("seatsOffCampus (M12)", () => {
  test("seats on another campus's buses go, own-campus seats and groups stay", () => {
    const seats = [
      { $id: "s1", group_id: "oslo-1", leg: "out" as const },
      { $id: "s2", group_id: "oslo-1", leg: "home" as const },
      { $id: "s3", group_id: "bergen-1", leg: "out" as const },
      { $id: "room", group_id: "room-1", leg: null },
      { $id: "gone", group_id: "deleted-bus", leg: "out" as const },
    ];
    expect(seatsOffCampus(seats, busCampus, "2")).toEqual(["s1", "s2"]);
    expect(seatsOffCampus(seats, busCampus, "1")).toEqual(["s3"]);
  });

  test("without a campus, only a bus without one is theirs (as the send counts it)", () => {
    const seats = [
      { $id: "s1", group_id: "oslo-1", leg: "out" as const },
      { $id: "s2", group_id: "no-campus", leg: "out" as const },
    ];
    expect(seatsOffCampus(seats, busCampus, null)).toEqual(["s1"]);
  });
});
