import { describe, expect, it } from "vitest";
import {
  channelFor,
  contentTableFor,
  contentTypeForTable,
  dueAtFor,
  eligibilityFor,
  lockRowIdFor,
} from "./content-notifications";

const HASHED_JOB_ID = /^job_[0-9a-f]+$/;

describe("content type mapping", () => {
  it("maps types to tables and back", () => {
    expect(contentTableFor("event")).toBe("events");
    expect(contentTableFor("news")).toBe("news");
    expect(contentTableFor("job")).toBe("jobs");
    expect(contentTypeForTable("events")).toBe("event");
    expect(contentTypeForTable("jobs")).toBe("job");
    expect(contentTypeForTable("users")).toBeNull();
  });
});

describe("lockRowIdFor", () => {
  it("uses a readable lock id", () => {
    expect(lockRowIdFor("event", "abc123")).toBe("event_abc123");
  });
  it("hashes ids that would be too long or unsafe", () => {
    const id = lockRowIdFor("news", "x".repeat(40));
    expect(id.startsWith("news_")).toBe(true);
    expect(id).toHaveLength(36);
    expect(lockRowIdFor("news", "x".repeat(40))).toBe(id);
    expect(lockRowIdFor("job", "a/b")).toMatch(HASHED_JOB_ID);
  });
});

describe("channelFor", () => {
  it("maps content to its channel", () => {
    expect(channelFor("event", "2")).toBe("events_bergen");
    expect(channelFor("job", "5")).toBe("jobs_national");
    expect(channelFor("news", null)).toBe("news_national");
  });
});

describe("eligibilityFor", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  it("needs published and notify on", () => {
    expect(
      eligibilityFor("news", { status: "draft", notify_push: true }, now)
    ).toEqual({ ok: false, reason: "not published" });
    expect(
      eligibilityFor("news", { status: "published", notify_push: null }, now)
    ).toEqual({ ok: false, reason: "notify off" });
    expect(
      eligibilityFor("news", { status: "published", notify_push: true }, now)
    ).toEqual({ ok: true });
  });
  it("skips events that are over", () => {
    expect(
      eligibilityFor(
        "event",
        {
          status: "published",
          notify_push: true,
          start_date: "2026-11-01T18:00:00Z",
          end_date: null,
        },
        now
      )
    ).toEqual({ ok: false, reason: "event over" });
    expect(
      eligibilityFor(
        "event",
        {
          status: "published",
          notify_push: true,
          start_date: "2026-11-01T18:00:00Z",
          end_date: "2026-11-03T18:00:00Z",
        },
        now
      )
    ).toEqual({ ok: true });
  });
  it("skips jobs past their deadline", () => {
    expect(
      eligibilityFor(
        "job",
        {
          status: "published",
          notify_push: true,
          application_deadline: "2026-11-01T22:59:59Z",
        },
        now
      )
    ).toEqual({ ok: false, reason: "deadline passed" });
    expect(
      eligibilityFor(
        "job",
        { status: "published", notify_push: true, application_deadline: null },
        now
      )
    ).toEqual({ ok: true });
  });
});

describe("dueAtFor", () => {
  it("waits the delay in the daytime", () => {
    expect(
      dueAtFor({
        now: new Date("2026-11-02T12:00:00Z"),
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2026-11-02T12:03:00.000Z");
  });
  it("waits for a later scheduled publish time", () => {
    expect(
      dueAtFor({
        now: new Date("2026-11-02T12:00:00Z"),
        scheduledPublishAt: "2026-11-03T09:00:00Z",
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2026-11-03T09:00:00.000Z");
  });
  it("holds 23:30 Oslo until 08:00 next day (winter, UTC+1)", () => {
    expect(
      dueAtFor({
        now: new Date("2026-11-02T22:30:00Z"),
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2026-11-03T07:00:00.000Z");
  });
  it("holds 05:00 Oslo until 08:00 same day (summer, UTC+2)", () => {
    expect(
      dueAtFor({
        now: new Date("2027-06-10T03:00:00Z"),
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2027-06-10T06:00:00.000Z");
  });
  it("lands on 08:00 Oslo across the spring DST change", () => {
    expect(
      dueAtFor({
        now: new Date("2027-03-27T22:30:00Z"),
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2027-03-28T06:00:00.000Z");
  });
  it("lands on 08:00 Oslo across the autumn DST change", () => {
    expect(
      dueAtFor({
        now: new Date("2026-10-24T21:30:00Z"),
        delayMinutes: 3,
      }).toISOString()
    ).toBe("2026-10-25T07:00:00.000Z");
  });
  it("07:59 is still night, 08:00 is not, 21:59 is day, 22:00 is night", () => {
    const due = (iso: string) =>
      dueAtFor({ now: new Date(iso), delayMinutes: 0 }).toISOString();
    // Winter, Oslo = UTC+1
    expect(due("2026-11-02T06:59:00Z")).toBe("2026-11-02T07:00:00.000Z");
    expect(due("2026-11-02T07:00:00Z")).toBe("2026-11-02T07:00:00.000Z");
    expect(due("2026-11-02T20:59:00Z")).toBe("2026-11-02T20:59:00.000Z");
    expect(due("2026-11-02T21:00:00Z")).toBe("2026-11-03T07:00:00.000Z");
  });
});
