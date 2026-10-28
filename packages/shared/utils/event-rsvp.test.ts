import { describe, expect, it } from "vitest";
import {
  EVENT_RSVPS_TABLE,
  type EventRsvpDb,
  isEventRsvpOpen,
  parseEventRsvpStatus,
  readEventRsvp,
  setEventRsvp,
} from "./event-rsvp";

const now = new Date("2026-10-27T12:00:00Z");
const FUTURE = "2026-11-01T12:00:00Z";

interface Rsvp {
  $id: string;
  event_id: string;
  status: string;
  user_id: string;
}

interface ParsedQuery {
  attribute?: string;
  method: string;
  values: unknown[];
}

function makeDb(
  opts: {
    createError?: unknown;
    event?: Record<string, unknown> | null;
    rsvps?: Rsvp[];
    rowAfterConflict?: Rsvp;
  } = {}
) {
  const event =
    opts.event === undefined
      ? {
          $id: "e1",
          end_date: FUTURE,
          member_only: false,
          status: "published",
        }
      : opts.event;
  const rsvps: Rsvp[] = [...(opts.rsvps ?? [])];
  const calls = {
    created: [] as {
      data: Record<string, unknown>;
      permissions: string[];
    }[],
    deleted: [] as string[],
    updated: [] as { data: Record<string, unknown>; id: string }[],
  };
  let createError = opts.createError;
  const db: EventRsvpDb = {
    createRow(_table, id, data, permissions) {
      if (createError) {
        const error = createError;
        createError = undefined;
        if (opts.rowAfterConflict) {
          rsvps.push(opts.rowAfterConflict);
        }
        return Promise.reject(error);
      }
      calls.created.push({ data, permissions });
      rsvps.push({ $id: id, ...data } as Rsvp);
      return Promise.resolve({});
    },
    deleteRow(_table, id) {
      calls.deleted.push(id);
      const i = rsvps.findIndex((r) => r.$id === id);
      if (i >= 0) {
        rsvps.splice(i, 1);
      }
      return Promise.resolve({});
    },
    listRows<T>(table: string, queries: string[]) {
      const parsed = queries.map((q) => JSON.parse(q) as ParsedQuery);
      const equals = parsed.filter((q) => q.method === "equal");
      const limit = (parsed.find((q) => q.method === "limit")?.values[0] ??
        100) as number;
      const cursor = parsed.find((q) => q.method === "cursorAfter")
        ?.values[0] as string | undefined;
      if (table === "events") {
        return Promise.resolve({
          rows: (event ? [event] : []) as unknown as T[],
        });
      }
      let rows = rsvps.filter((r) =>
        equals.every(
          (q) =>
            (r as unknown as Record<string, unknown>)[q.attribute ?? ""] ===
            q.values[0]
        )
      );
      if (cursor) {
        rows = rows.slice(rows.findIndex((r) => r.$id === cursor) + 1);
      }
      return Promise.resolve({ rows: rows.slice(0, limit) as unknown as T[] });
    },
    updateRow(_table, id, data) {
      calls.updated.push({ data, id });
      const row = rsvps.find((r) => r.$id === id);
      if (row) {
        Object.assign(row, data);
      }
      return Promise.resolve({});
    },
  };
  return { calls, db, rsvps };
}

function row(id: string, user: string, status: string): Rsvp {
  return { $id: id, event_id: "e1", status, user_id: user };
}

describe("parseEventRsvpStatus", () => {
  it("accepts the three statuses and null, rejects the rest", () => {
    expect(parseEventRsvpStatus("going")).toBe("going");
    expect(parseEventRsvpStatus(null)).toBeNull();
    expect(parseEventRsvpStatus("yes")).toBeUndefined();
    expect(parseEventRsvpStatus(undefined)).toBeUndefined();
  });
});

describe("isEventRsvpOpen", () => {
  const end = "2026-10-27T12:00:00Z";
  it("is open up to end_date and closed 1 ms after", () => {
    expect(isEventRsvpOpen({ end_date: end }, now)).toBe(true);
    expect(
      isEventRsvpOpen({ end_date: end }, new Date(now.getTime() + 1))
    ).toBe(false);
  });
  it("falls back to start_date", () => {
    expect(isEventRsvpOpen({ start_date: end }, now)).toBe(true);
    expect(
      isEventRsvpOpen({ start_date: end }, new Date(now.getTime() + 1))
    ).toBe(false);
  });
  it("is open with neither date", () => {
    expect(isEventRsvpOpen({}, now)).toBe(true);
  });
});

describe("readEventRsvp", () => {
  it("counts going and maybe and never not_going", async () => {
    const { db } = makeDb({
      rsvps: [
        row("r1", "a", "going"),
        row("r2", "b", "going"),
        row("r3", "c", "maybe"),
        row("r4", "d", "not_going"),
      ],
    });
    const summary = await readEventRsvp(db, {
      eventId: "e1",
      now,
      userId: null,
    });
    expect(summary?.counts).toEqual({ going: 2, maybe: 1 });
  });

  it("returns the caller's own answer", async () => {
    const { db } = makeDb({
      rsvps: [row("r1", "u1", "maybe"), row("r2", "u2", "going")],
    });
    const mine = await readEventRsvp(db, { eventId: "e1", now, userId: "u1" });
    const anon = await readEventRsvp(db, { eventId: "e1", now, userId: null });
    expect(mine?.mine).toBe("maybe");
    expect(anon?.mine).toBeNull();
  });

  it("returns null for a draft or missing event", async () => {
    const draft = makeDb({ event: { $id: "e1", status: "draft" } });
    const missing = makeDb({ event: null });
    expect(
      await readEventRsvp(draft.db, { eventId: "e1", now, userId: null })
    ).toBeNull();
    expect(
      await readEventRsvp(missing.db, { eventId: "e1", now, userId: null })
    ).toBeNull();
  });

  it("counts across pages", async () => {
    const rsvps = Array.from({ length: 1001 }, (_, i) =>
      row(`r${i}`, `u${i}`, "going")
    );
    const { db } = makeDb({ rsvps });
    const summary = await readEventRsvp(db, {
      eventId: "e1",
      now,
      userId: null,
    });
    expect(summary?.counts.going).toBe(1001);
  });
});

describe("setEventRsvp", () => {
  const base = { eventId: "e1", isMember: () => Promise.resolve(true), now };

  it("creates a row readable only by the student", async () => {
    const { calls, db } = makeDb();
    const result = await setEventRsvp(db, {
      ...base,
      status: "going",
      userId: "u1",
    });
    expect(calls.created).toHaveLength(1);
    expect(calls.created[0]?.permissions).toEqual(['read("user:u1")']);
    expect(calls.created[0]?.data).toEqual({
      event_id: "e1",
      status: "going",
      user_id: "u1",
    });
    expect(result.ok && result.summary.mine).toBe("going");
    expect(EVENT_RSVPS_TABLE).toBe("event_rsvps");
  });

  it("changes an existing answer", async () => {
    const { calls, db } = makeDb({ rsvps: [row("r1", "u1", "going")] });
    await setEventRsvp(db, { ...base, status: "maybe", userId: "u1" });
    expect(calls.updated).toEqual([{ data: { status: "maybe" }, id: "r1" }]);
    expect(calls.created).toHaveLength(0);
  });

  it("writes nothing when the status is unchanged", async () => {
    const { calls, db } = makeDb({ rsvps: [row("r1", "u1", "going")] });
    await setEventRsvp(db, { ...base, status: "going", userId: "u1" });
    expect(calls.updated).toHaveLength(0);
    expect(calls.created).toHaveLength(0);
  });

  it("with null deletes the row", async () => {
    const { calls, db } = makeDb({ rsvps: [row("r1", "u1", "going")] });
    const result = await setEventRsvp(db, {
      ...base,
      status: null,
      userId: "u1",
    });
    expect(calls.deleted).toEqual(["r1"]);
    expect(result.ok && result.summary.mine).toBeNull();
  });

  it("refuses a write after the event ends", async () => {
    const { calls, db } = makeDb({
      event: {
        $id: "e1",
        end_date: "2026-10-01T00:00:00Z",
        status: "published",
      },
    });
    const result = await setEventRsvp(db, {
      ...base,
      status: "going",
      userId: "u1",
    });
    expect(result).toEqual({ ok: false, reason: "closed" });
    expect(calls.created).toHaveLength(0);
  });

  it("members-only: asks isMember only when setting an answer", async () => {
    const { db } = makeDb({
      event: {
        $id: "e1",
        end_date: FUTURE,
        member_only: true,
        status: "published",
      },
      rsvps: [row("r1", "u1", "going")],
    });
    let asked = 0;
    const isMember = () => {
      asked += 1;
      return Promise.resolve(false);
    };
    const denied = await setEventRsvp(db, {
      ...base,
      isMember,
      status: "maybe",
      userId: "u1",
    });
    expect(denied).toEqual({ ok: false, reason: "members_only" });
    expect(asked).toBe(1);
    const cleared = await setEventRsvp(db, {
      ...base,
      isMember,
      status: null,
      userId: "u1",
    });
    expect(cleared.ok).toBe(true);
    expect(asked).toBe(1);
  });

  it("updates when a create loses the race", async () => {
    const { calls, db } = makeDb({
      createError: { code: 409 },
      rowAfterConflict: row("r9", "u1", "maybe"),
    });
    const result = await setEventRsvp(db, {
      ...base,
      status: "going",
      userId: "u1",
    });
    expect(calls.updated).toEqual([{ data: { status: "going" }, id: "r9" }]);
    expect(result.ok).toBe(true);
  });

  it("returns not_found for an unpublished event", async () => {
    const { db } = makeDb({ event: { $id: "e1", status: "draft" } });
    const result = await setEventRsvp(db, {
      ...base,
      status: "going",
      userId: "u1",
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
