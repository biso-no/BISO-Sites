import { describe, expect, test } from "bun:test";
import {
  allowedCampusChoices,
  canSendNotifications,
  isAudienceAllowed,
  isTopicValueAllowed,
} from "./audience-policy";

const global = { managedCampusIds: [], roles: ["globaladmin"] };
const bergenAdmin = { managedCampusIds: ["2"], roles: ["campusadmin"] };
const osloAdmin = { managedCampusIds: ["1"], roles: ["campusadmin"] };
const department = { managedCampusIds: [], roles: [] as string[] };

describe("canSendNotifications", () => {
  test("only global and campus admins", () => {
    expect(canSendNotifications(["globaladmin"])).toBe(true);
    expect(canSendNotifications(["campusadmin"])).toBe(true);
    expect(canSendNotifications([])).toBe(false);
    expect(canSendNotifications(["hr"])).toBe(false);
  });
});

describe("isAudienceAllowed", () => {
  test.each([
    ["broadcast", null],
    ["broadcast", "5"],
    ["broadcast", "2"],
    ["broadcast", "1"],
    ["topic", null],
    ["topic", "5"],
    ["topic", "3"],
    ["users", null],
  ] as const)("global admin may send %s to campus %p", (audienceType, campusId) => {
    expect(isAudienceAllowed(global, { audienceType, campusId })).toBe(true);
  });

  test("global admin may message any segment", () => {
    expect(
      isAudienceAllowed(global, {
        audienceType: "segment",
        campusId: null,
        segmentCampusId: "4",
      })
    ).toBe(true);
  });

  test.each([
    "broadcast",
    "topic",
  ] as const)("campus admin %s: own campus only", (audienceType) => {
    expect(
      isAudienceAllowed(bergenAdmin, { audienceType, campusId: "2" })
    ).toBe(true);
    expect(
      isAudienceAllowed(bergenAdmin, { audienceType, campusId: "1" })
    ).toBe(false);
    expect(
      isAudienceAllowed(bergenAdmin, { audienceType, campusId: null })
    ).toBe(false);
    expect(
      isAudienceAllowed(bergenAdmin, { audienceType, campusId: "5" })
    ).toBe(false);
  });

  test("campus admin may send to specific people", () => {
    expect(
      isAudienceAllowed(bergenAdmin, { audienceType: "users", campusId: null })
    ).toBe(true);
  });

  test("campus admin segment: group campus must be an own campus", () => {
    const req = { audienceType: "segment", campusId: null } as const;
    expect(
      isAudienceAllowed(bergenAdmin, { ...req, segmentCampusId: "2" })
    ).toBe(true);
    expect(
      isAudienceAllowed(bergenAdmin, { ...req, segmentCampusId: "1" })
    ).toBe(false);
    expect(
      isAudienceAllowed(bergenAdmin, { ...req, segmentCampusId: null })
    ).toBe(false);
  });

  test("campus admin of Oslo may message an Oslo group on a National event", () => {
    expect(
      isAudienceAllowed(osloAdmin, {
        audienceType: "segment",
        campusId: "5",
        segmentCampusId: "1",
      })
    ).toBe(true);
  });

  test("department members may send nothing", () => {
    expect(
      isAudienceAllowed(department, { audienceType: "users", campusId: null })
    ).toBe(false);
  });
});

describe("allowedCampusChoices", () => {
  test("global admin gets all campuses", () => {
    expect(allowedCampusChoices(global, "broadcast").allCampuses).toBe(true);
    expect(allowedCampusChoices(global, "users").allCampuses).toBe(false);
  });

  test("campus admin gets own campuses only", () => {
    expect(allowedCampusChoices(bergenAdmin, "topic")).toEqual({
      allCampuses: false,
      campusIds: ["2"],
    });
  });
});

describe("isTopicValueAllowed", () => {
  test.each([
    ["events", "2", true],
    ["events_bergen", "2", true],
    ["products", "2", true],
    ["shop_bergen", "2", true],
    ["events", null, true],
    ["events_national", null, true],
    ["general", "2", false],
    ["events_national", "2", false],
    ["events_oslo", "2", false],
    ["news_oslo", "2", false],
    ["", "2", false],
    [null, "2", false],
  ])("value %p on campus %p -> %p", (value, campus, expected) => {
    expect(isTopicValueAllowed(value, campus)).toBe(expected);
  });
});
