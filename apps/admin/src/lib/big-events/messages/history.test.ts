import { describe, expect, test } from "bun:test";
import type { BigEventMessageRow } from "@repo/shared/big-events/types";
import { messageHistory } from "./history";

const RUN = "2027-01-10T10:00:00.000+00:00";
/** An hour before the default message is due. */
const NOW = new Date("2027-01-10T08:00:00.000Z");

function message(
  overrides: Partial<BigEventMessageRow> & { $id: string }
): BigEventMessageRow {
  return {
    $createdAt: "2027-01-10T09:00:00.000+00:00",
    $databaseId: "app",
    $permissions: [],
    $sequence: "1",
    $tableId: "big_event_messages",
    $updatedAt: "2027-01-10T09:00:00.000+00:00",
    also_sms: false,
    audience: JSON.stringify({ type: "everyone" }),
    big_event_id: "b1",
    body_en: "Hi",
    body_no: "Hei",
    campus_ids: [],
    created_by: "admin-1",
    email_count: 0,
    failed_count: 0,
    important: false,
    kind: "manual",
    leg: null,
    pinned: false,
    push_count: 0,
    recipients: 0,
    scheduled_at: "2027-01-10T09:00:00.000+00:00",
    sent_at: "2027-01-10T09:00:05.000+00:00",
    sms_count: 0,
    status: "sent",
    title_en: "Info",
    title_no: "Info",
    ...overrides,
  };
}

const groups = new Map([
  ["bus-1", { name: "Buss 1", visible: true }],
  ["bus-9", { name: "Buss 9", visible: false }],
]);
const always = () => true;

describe("messageHistory", () => {
  test("history shows automatic messages, one per cron run and kind (R21)", () => {
    const items = messageHistory({
      now: NOW,
      canManage: always,
      groups,
      messages: [
        message({
          $id: "m1",
          audience: JSON.stringify({
            participantIds: ["p1", "p2"],
            type: "people",
          }),
          campus_ids: ["1"],
          email_count: 1,
          failed_count: 1,
          kind: "bus_assigned",
          leg: "out",
          push_count: 1,
          recipients: 2,
          scheduled_at: RUN,
          sent_at: "2027-01-10T10:00:03.000+00:00",
        }),
        message({
          $id: "m2",
          audience: JSON.stringify({ participantIds: ["p3"], type: "people" }),
          campus_ids: ["2"],
          kind: "bus_assigned",
          leg: "out",
          push_count: 1,
          recipients: 1,
          scheduled_at: "2027-01-10T10:00:00.000Z",
          sent_at: "2027-01-10T10:00:04.000+00:00",
          sms_count: 1,
        }),
        message({ $id: "m3" }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(["m1", "m3"]);
    expect(items[0]).toMatchObject({
      audience: { count: 3, type: "people" },
      automatic: true,
      counts: { email: 1, failed: 1, people: 3, push: 2, sms: 1 },
      kind: "bus_assigned",
      leg: "out",
      messageIds: ["m1", "m2"],
      sentAt: "2027-01-10T10:00:04.000+00:00",
      status: "sent",
    });
    expect(items[1]).toMatchObject({ automatic: false, messageIds: ["m3"] });
  });

  test("automatic messages of other runs or kinds stay apart; manual ones never merge", () => {
    const items = messageHistory({
      now: NOW,
      canManage: always,
      groups,
      messages: [
        message({ $id: "a", kind: "bus_moved", scheduled_at: RUN }),
        message({ $id: "b", kind: "bus_none", scheduled_at: RUN }),
        message({
          $id: "c",
          kind: "bus_moved",
          scheduled_at: "2027-01-10T10:01:00.000Z",
        }),
        message({ $id: "d", scheduled_at: RUN }),
        message({ $id: "e", scheduled_at: RUN }),
      ],
    });
    expect(items).toHaveLength(5);
  });

  test("newest first; a missing status is scheduled; sent time only once sent (R11)", () => {
    const items = messageHistory({
      now: NOW,
      canManage: always,
      groups,
      messages: [
        message({
          $id: "old",
          scheduled_at: "2027-01-09T09:00:00.000Z",
        }),
        message({
          $id: "sending",
          scheduled_at: "2027-01-10T09:30:00.000Z",
          sent_at: "2027-01-10T09:30:01.000Z",
          status: "sending",
        }),
        message({
          $id: "later",
          scheduled_at: "2027-01-12T09:00:00.000Z",
          sent_at: null,
          status: null,
        }),
      ],
    });
    expect(items.map((item) => [item.id, item.status, item.sentAt])).toEqual([
      ["later", "scheduled", null],
      ["sending", "sending", null],
      ["old", "sent", "2027-01-10T09:00:05.000+00:00"],
    ]);
  });

  test("offers Cancel, Try again and Unpin only where they apply", () => {
    const items = messageHistory({
      now: NOW,
      canManage: (row) => row.$id !== "theirs",
      groups,
      messages: [
        message({ $id: "scheduled", sent_at: null, status: "scheduled" }),
        message({ $id: "theirs", sent_at: null, status: "scheduled" }),
        message({ $id: "failed", failed_count: 2, status: "failed" }),
        message({ $id: "pinned", important: true, pinned: true }),
        message({
          $id: "auto",
          kind: "departure_reminder",
          sent_at: null,
          status: "scheduled",
        }),
      ],
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get("scheduled")).toMatchObject({
      canCancel: true,
      canUnpin: false,
      retryIds: [],
    });
    expect(byId.get("theirs")).toMatchObject({ canCancel: false });
    expect(byId.get("failed")).toMatchObject({
      canCancel: false,
      counts: { failed: 2 },
      retryIds: ["failed"],
      status: "failed",
    });
    expect(byId.get("pinned")).toMatchObject({
      canUnpin: true,
      important: true,
      pinned: true,
    });
    expect(byId.get("auto")).toMatchObject({ canCancel: false });
  });

  test("no Cancel within a minute of the send time, or after it (R28)", () => {
    const items = messageHistory({
      canManage: always,
      groups,
      messages: [
        message({
          $id: "in-30s",
          scheduled_at: "2027-01-10T08:00:30.000Z",
          sent_at: null,
          status: "scheduled",
        }),
        message({
          $id: "past",
          scheduled_at: "2027-01-10T07:59:00.000Z",
          sent_at: null,
          status: "scheduled",
        }),
        message({
          $id: "in-2min",
          scheduled_at: "2027-01-10T08:02:00.000Z",
          sent_at: null,
          status: "scheduled",
        }),
        message({
          $id: "no-time",
          scheduled_at: null,
          sent_at: null,
          status: "scheduled",
        }),
      ],
      now: NOW,
    });
    const canCancel = Object.fromEntries(
      items.map((item) => [item.id, item.canCancel])
    );
    expect(canCancel).toEqual({
      "in-2min": true,
      "in-30s": false,
      "no-time": false,
      past: false,
    });
  });

  test("a merged item with one failed message offers to try that one again", () => {
    const [item] = messageHistory({
      now: NOW,
      canManage: always,
      groups,
      messages: [
        message({ $id: "ok", kind: "bus_assigned", scheduled_at: RUN }),
        message({
          $id: "bad",
          kind: "bus_assigned",
          scheduled_at: RUN,
          status: "failed",
        }),
      ],
    });
    expect(item).toMatchObject({
      retryIds: ["bad"],
      sentAt: null,
      status: "failed",
    });
  });

  test("who it was for names only the groups the caller may see", () => {
    const items = messageHistory({
      now: NOW,
      canManage: always,
      groups,
      messages: [
        message({
          $id: "groups",
          audience: JSON.stringify({
            groupIds: ["bus-1", "bus-9", "gone"],
            leg: "home",
            type: "groups",
          }),
        }),
        message({
          $id: "campus",
          audience: JSON.stringify({ campusIds: ["2"], type: "campus" }),
          scheduled_at: "2027-01-10T08:00:00.000Z",
        }),
        message({
          $id: "broken",
          audience: "{",
          scheduled_at: "2027-01-10T07:00:00.000Z",
        }),
      ],
    });
    expect(items.map((item) => item.audience)).toEqual([
      { groupNames: ["Buss 1"], hiddenGroups: 2, leg: "home", type: "groups" },
      { campusIds: ["2"], type: "campus" },
      null,
    ]);
  });
});
