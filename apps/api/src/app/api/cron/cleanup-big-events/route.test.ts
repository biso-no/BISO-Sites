import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());
const deleteRow = vi.hoisted(() => vi.fn());
const updateRow = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: { deleteRow, listRows, updateRow },
  })),
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/cleanup-big-events", {
    headers,
    method: "POST",
  });
const rows = (prefix: string, count: number) => ({
  rows: Array.from({ length: count }, (_, i) => ({ $id: `${prefix}${i}` })),
  total: count,
});
const NO_CONTACT = {
  booking_participant_id: null,
  contact_name: null,
  contact_phone: null,
  contact_user_id: null,
};
const group = (id: string, fields: Record<string, unknown>) => ({
  $id: id,
  kind: "room",
  name: "Rom",
  room_number: null,
  ...NO_CONTACT,
  ...fields,
});
const groupUpdates = () =>
  updateRow.mock.calls.filter(([, table]) => table === "big_event_groups");

describe("POST /api/cron/cleanup-big-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T00:00:00Z"));
    vi.stubEnv("CRON_SECRET", SECRET);
    deleteRow.mockResolvedValue(undefined);
    updateRow.mockResolvedValue(undefined);
  });

  it("requires the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
  });

  it("deletes participants 30 days after the end", async () => {
    listRows.mockImplementation((_db: string, table: string) => {
      if (table === "big_events") {
        return Promise.resolve(rows("e", 1));
      }
      if (table === "big_event_participants") {
        return Promise.resolve(rows("p", 3));
      }
      if (table === "big_event_group_members") {
        return Promise.resolve(rows("m", 2));
      }
      if (table === "big_event_groups") {
        return Promise.resolve({ rows: [], total: 0 });
      }
      return Promise.resolve(rows("d", 1));
    });
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(await response.json()).toEqual({
      deliveriesDeleted: 1,
      groupsAnonymised: 0,
      membersDeleted: 2,
      participantsDeleted: 3,
    });
    const eventsQuery = JSON.stringify(listRows.mock.calls[0]);
    expect(eventsQuery).toContain("big_events");
    expect(eventsQuery).toContain("2026-12-01T00:00:00.000Z");
    expect(deleteRow).toHaveBeenCalledWith(
      "app",
      "big_event_participants",
      "p0"
    );
    expect(deleteRow).not.toHaveBeenCalledWith("app", "big_events", "e0");
  });

  it("leaves a big event that ended 29 days ago alone", async () => {
    listRows.mockResolvedValue({ rows: [], total: 0 });
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(await response.json()).toEqual({
      deliveriesDeleted: 0,
      groupsAnonymised: 0,
      membersDeleted: 0,
      participantsDeleted: 0,
    });
    expect(listRows).toHaveBeenCalledTimes(1);
    expect(deleteRow).not.toHaveBeenCalled();
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("takes the buyers' names and contacts off an ended event's groups", async () => {
    listRows.mockImplementation((_db: string, table: string) => {
      if (table === "big_events") {
        return Promise.resolve(rows("e", 1));
      }
      if (table === "big_event_groups") {
        return Promise.resolve({
          rows: [
            group("g-booked", {
              booking_participant_id: "p0",
              name: "Ola Nordmann",
              room_number: "214",
            }),
            group("g-unnumbered", {
              booking_participant_id: "p1",
              name: "Kari Hansen",
            }),
            group("g-bus", {
              contact_name: "Per Sjåfør",
              contact_phone: "+4791234567",
              contact_user_id: "u1",
              kind: "bus",
              name: "Buss 1",
            }),
          ],
          total: 3,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();

    expect(body.groupsAnonymised).toBe(3);
    expect(groupUpdates()).toEqual([
      ["app", "big_event_groups", "g-booked", { ...NO_CONTACT, name: "214" }],
      [
        "app",
        "big_event_groups",
        "g-unnumbered",
        { ...NO_CONTACT, name: "Rom" },
      ],
      ["app", "big_event_groups", "g-bus", NO_CONTACT],
    ]);
    const groupQuery = JSON.stringify(
      listRows.mock.calls.find(([, table]) => table === "big_event_groups")
    );
    expect(groupQuery).toContain("e0");
    expect(deleteRow).not.toHaveBeenCalledWith(
      "app",
      "big_event_groups",
      expect.anything()
    );
  });

  it("leaves groups that are already anonymised alone", async () => {
    listRows.mockImplementation((_db: string, table: string) => {
      if (table === "big_events") {
        return Promise.resolve(rows("e", 1));
      }
      if (table === "big_event_groups") {
        return Promise.resolve({
          rows: [
            group("g-rom", {}),
            group("g-214", { name: "214", room_number: "214" }),
            group("g-bus", { kind: "bus", name: "Buss 1" }),
          ],
          total: 3,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();

    expect(body.groupsAnonymised).toBe(0);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("counts group updates against the per-run budget", async () => {
    let participantPages = 0;
    listRows.mockImplementation((_db: string, table: string) => {
      if (table === "big_events") {
        return Promise.resolve(rows("e", 1));
      }
      if (table === "big_event_participants") {
        participantPages += 1;
        // 9 full pages and 98 more: two deletes left in the budget.
        return Promise.resolve(rows("p", participantPages < 10 ? 100 : 98));
      }
      if (table === "big_event_groups") {
        return Promise.resolve({
          rows: ["a", "b", "c"].map((id) =>
            group(`g-${id}`, { booking_participant_id: id, name: "Ola" })
          ),
          total: 3,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();

    expect(body.participantsDeleted).toBe(998);
    expect(body.groupsAnonymised).toBe(2);
    expect(groupUpdates()).toHaveLength(2);
  });

  it("cleans events beyond the first 25 expired ones", async () => {
    listRows.mockImplementation((_db: string, table: string, q: string[]) => {
      const query = JSON.stringify(q);
      if (table === "big_events") {
        return Promise.resolve(
          query.includes("cursorAfter") ? rows("f", 5) : rows("e", 25)
        );
      }
      if (table === "big_event_participants" && query.includes("f4")) {
        return Promise.resolve(rows("p", 2));
      }
      return Promise.resolve({ rows: [], total: 0 });
    });
    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();
    expect(body.participantsDeleted).toBe(2);
    expect(
      listRows.mock.calls.filter(([, t]) => t === "big_events")
    ).toHaveLength(2);
  });

  it("stops at the per-run delete budget", async () => {
    listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve(table === "big_events" ? rows("e", 25) : rows("x", 100))
    );
    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();
    expect(body.participantsDeleted).toBe(1000);
    expect(body.membersDeleted + body.deliveriesDeleted).toBe(0);
    expect(body.groupsAnonymised).toBe(0);
    expect(deleteRow).toHaveBeenCalledTimes(1000);
    expect(updateRow).not.toHaveBeenCalled();
  });
});
