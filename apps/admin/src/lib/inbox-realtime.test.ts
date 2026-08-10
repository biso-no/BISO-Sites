import { describe, expect, it } from "bun:test";
import {
  eventTouchesTable,
  isCreateEvent,
  shouldNotifyForCampus,
} from "./inbox-realtime";

describe("isCreateEvent", () => {
  it("detects create events", () => {
    expect(
      isCreateEvent(["databases.app.tables.approval_requests.rows.abc.create"])
    ).toBe(true);
  });

  it("rejects update/delete events", () => {
    expect(
      isCreateEvent(["databases.app.tables.approval_requests.rows.abc.update"])
    ).toBe(false);
  });
});

describe("eventTouchesTable", () => {
  it("matches the table segment exactly", () => {
    const events = ["databases.app.tables.approval_requests.rows.abc.create"];
    expect(eventTouchesTable(events, "approval_requests")).toBe(true);
    expect(eventTouchesTable(events, "form_submissions")).toBe(false);
  });
});

describe("shouldNotifyForCampus", () => {
  it("notifies when no campus filter is active", () => {
    expect(shouldNotifyForCampus("1", null)).toBe(true);
  });

  it("notifies when the payload has no campus", () => {
    expect(shouldNotifyForCampus(null, "1")).toBe(true);
  });

  it("notifies on matching campus and suppresses on mismatch", () => {
    expect(shouldNotifyForCampus("1", "1")).toBe(true);
    expect(shouldNotifyForCampus("2", "1")).toBe(false);
  });
});
