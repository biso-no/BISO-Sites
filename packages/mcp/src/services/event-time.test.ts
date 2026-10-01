import { OSLO_TIME_ZONE } from "@repo/shared/utils/oslo-time";
import { describe, expect, it } from "vitest";
import {
  DATE_FILTER_NOTE,
  OSLO_TIME_NOTE,
  resolveDateFilter,
} from "./event-time";

describe("resolveDateFilter", () => {
  it("reads a bare date as the Oslo day start, not UTC midnight", () => {
    // 22 September is CEST (UTC+2), so the Oslo day starts two hours before
    // the UTC day. Read as written, `2026-09-22` would drop an event starting
    // 00:30 Oslo from the very day it belongs to.
    expect(resolveDateFilter("2026-09-22")).toBe("2026-09-21T22:00:00.000Z");
  });

  it("follows the offset across the winter half of the year", () => {
    // CET (UTC+1): the same bare date resolves an hour later than in summer,
    // which a fixed offset would get wrong for half the year.
    expect(resolveDateFilter("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
  });

  it("uses the offset in force at midnight on a DST changeover day", () => {
    // Norway switches at 02:00, so both changeover days still start on the
    // outgoing offset: 29 March on CET, 25 October on CEST.
    expect(resolveDateFilter("2026-03-29")).toBe("2026-03-28T23:00:00.000Z");
    expect(resolveDateFilter("2026-10-25")).toBe("2026-10-24T22:00:00.000Z");
  });

  it("leaves a full instant alone", () => {
    // It already names an instant; re-resolving it would move the caller's
    // filter by the Oslo offset.
    expect(resolveDateFilter("2026-09-22T11:00:00.000Z")).toBe(
      "2026-09-22T11:00:00.000Z"
    );
  });

  it("leaves a zoneless timestamp and a malformed value alone", () => {
    // Deliberately narrow: only the bare date is ambiguous in a way this
    // server can resolve without guessing.
    expect(resolveDateFilter("2026-09-22T13:00")).toBe("2026-09-22T13:00");
    expect(resolveDateFilter("last tuesday")).toBe("last tuesday");
    expect(resolveDateFilter("")).toBe("");
  });
});

describe("the notes shown to a client", () => {
  it("name the zone from the shared rule rather than a local copy", () => {
    // If `@repo/shared/utils/oslo-time` ever moves BISO's zone, these must
    // move with it instead of asserting a stale one.
    expect(OSLO_TIME_NOTE).toContain(OSLO_TIME_ZONE);
    expect(DATE_FILTER_NOTE).toContain(OSLO_TIME_ZONE);
  });
});
