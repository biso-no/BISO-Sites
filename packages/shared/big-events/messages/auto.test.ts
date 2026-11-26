import type { Messaging, TablesDB } from "@repo/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BIG_EVENT_TABLES } from "../tables";
import type {
  BigEventGroupRow,
  BigEventMessageRecipientRow,
  BigEventMessageRow,
  BigEventParticipantRow,
} from "../types";

vi.mock("server-only", () => ({}));
const { dispatchAnnouncement } = vi.hoisted(() => ({
  dispatchAnnouncement: vi.fn(),
}));
vi.mock("../../utils/push-dispatch", () => ({ dispatchAnnouncement }));
// The real send runs; a test can still make one send fail or skip sending.
vi.mock("./send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./send")>();
  return { ...actual, sendMessage: vi.fn(actual.sendMessage) };
});

const { autoTextsFor, runDueMessages } = await import("./auto");
const send = await import("./send");
const realSend = (await vi.importActual<typeof import("./send")>("./send"))
  .sendMessage;
const sendMessage = vi.mocked(send.sendMessage);

// ── In-memory Appwrite fake ───────────────────────────────────────────────────

type Row = Record<string, unknown> & { $id: string };
interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

const E = BIG_EVENT_TABLES.events;
const P = BIG_EVENT_TABLES.participants;
const G = BIG_EVENT_TABLES.groups;
const GM = BIG_EVENT_TABLES.groupMembers;
const M = BIG_EVENT_TABLES.messages;
const R = BIG_EVENT_TABLES.messageRecipients;
const MINUTE = 60_000;
const START = Date.parse("2027-01-10T12:00:00.000Z");

/** The time `minutes` after 12:00 on 10 January 2027. */
const at = (minutes: number) =>
  new Date(START + minutes * MINUTE).toISOString();

let clock = new Date(START);

function rejectWith(message: string, code: number): Promise<never> {
  return Promise.reject(Object.assign(new Error(message), { code }));
}

/** Datetimes compare as times, anything else as text; null matches nothing. */
function compare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) {
    return null;
  }
  const left = Date.parse(String(a));
  const right = Date.parse(String(b));
  if (!(Number.isNaN(left) || Number.isNaN(right))) {
    return left - right;
  }
  return String(a).localeCompare(String(b));
}

function matches(row: Row, query: ParsedQuery): boolean {
  const value = query.attribute ? row[query.attribute] : undefined;
  const order = compare(value, query.values?.[0]);
  switch (query.method) {
    case "equal":
      return (query.values ?? []).includes(value);
    case "isNull":
      return value === null || value === undefined;
    case "isNotNull":
      return value !== null && value !== undefined;
    case "lessThanEqual":
      return order !== null && order <= 0;
    case "greaterThanEqual":
      return order !== null && order >= 0;
    case "limit":
    case "cursorAfter":
    case "select":
    case "orderAsc":
      return true;
    default:
      throw new Error(`fake db: unsupported query ${query.method}`);
  }
}

class FakeDb {
  readonly tables = new Map<string, Map<string, Row>>();
  /** Runs after each list, so a test can play a change made meanwhile. */
  afterList: ((table: string, queries: string[]) => void) | null = null;
  /** Return true to fail that list (an outage). */
  failList: ((table: string, queries: string[]) => boolean) | null = null;

  table(name: string): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  rows<T>(name: string): T[] {
    return [...this.table(name).values()] as unknown as T[];
  }

  seed(name: string, row: Row): void {
    const stamp = clock.toISOString();
    this.table(name).set(row.$id, {
      $createdAt: stamp,
      $updatedAt: stamp,
      ...row,
    });
  }

  getRow<T>(_db: string, table: string, id: string): Promise<T> {
    const row = this.table(table).get(id);
    return row
      ? Promise.resolve(structuredClone(row) as unknown as T)
      : rejectWith("Row not found", 404);
  }

  listRows<T>(
    _db: string,
    table: string,
    queries: string[] = []
  ): Promise<{ rows: T[]; total: number }> {
    if (this.failList?.(table, queries)) {
      return Promise.reject(new Error("Appwrite is down"));
    }
    const parsed = queries.map((q) => JSON.parse(q) as ParsedQuery);
    if (parsed.some((q) => (q.values?.length ?? 0) > 100)) {
      return Promise.reject(new Error("Query values limit exceeded"));
    }
    let rows = [...this.table(table).values()].filter((row) =>
      parsed.every((q) => matches(row, q))
    );
    const order = parsed.find((q) => q.method === "orderAsc");
    if (order?.attribute) {
      const key = order.attribute;
      rows.sort((a, b) => compare(a[key], b[key]) ?? 0);
    }
    const total = rows.length;
    const cursor = parsed.find((q) => q.method === "cursorAfter");
    if (cursor) {
      const index = rows.findIndex((row) => row.$id === cursor.values?.[0]);
      rows = rows.slice(index + 1);
    }
    const limit = parsed.find((q) => q.method === "limit");
    rows = rows.slice(0, (limit?.values?.[0] as number | undefined) ?? 25);
    const result = { rows: structuredClone(rows) as unknown as T[], total };
    this.afterList?.(table, queries);
    return Promise.resolve(result);
  }

  createRow(
    _db: string,
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Row> {
    // Appwrite refuses a value longer than its column.
    if (table === M && String(data.audience).length > 4000) {
      return rejectWith("Invalid `audience`: longer than 4000 chars", 400);
    }
    const duplicate =
      table === R &&
      this.rows<Row>(R).some(
        (row) =>
          row.message_id === data.message_id &&
          row.participant_id === data.participant_id
      );
    if (duplicate) {
      return rejectWith("Row already exists", 409);
    }
    this.seed(table, { $id: id, ...data });
    return Promise.resolve(structuredClone(this.table(table).get(id) as Row));
  }

  updateRow(
    _db: string,
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Row> {
    const row = this.table(table).get(id);
    if (!row) {
      return rejectWith("Row not found", 404);
    }
    Object.assign(row, data, { $updatedAt: clock.toISOString() });
    return Promise.resolve(structuredClone(row));
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let db: FakeDb;

function deps() {
  return {
    db: db as unknown as TablesDB,
    isSmsEnabled: () => Promise.resolve(false),
    messaging: {} as Messaging,
    now: () => clock,
    users: {
      get: () => Promise.resolve({ targets: [] }),
    },
    webBase: "https://biso.test",
  };
}

/** Runs the cron `minutes` after 12:00. */
function runAt(minutes: number, options?: { budgetMs?: number }) {
  clock = new Date(START + minutes * MINUTE);
  return runDueMessages(deps(), clock, options);
}

function event(fields: Record<string, unknown> = {}, id = "be1"): void {
  db.seed(E, {
    $id: id,
    auto_bus_assigned: true,
    auto_bus_moved: true,
    auto_departure_reminder: true,
    auto_texts: null,
    bus_lists_published_at: at(-120),
    campus_id: "1",
    ends_at: "2027-01-27T12:00:00.000Z",
    name_no: "Winter Games",
    slug: `winter-games-${id}`,
    status: "published",
    travel_enabled: true,
    ...fields,
  });
}

function bus(
  id: string,
  name: string,
  fields: Partial<BigEventGroupRow> = {},
  bigEventId = "be1"
): void {
  db.seed(G, {
    $id: id,
    big_event_id: bigEventId,
    campus_id: "1",
    contact_name: null,
    contact_phone: null,
    home_departs_at: null,
    home_meeting_point: null,
    home_reminder_sent_at: null,
    kind: "bus",
    name,
    out_departs_at: "2027-01-22T13:00:00.000Z",
    out_meeting_point: "Nydalen T",
    out_reminder_sent_at: null,
    room_number: null,
    ...fields,
  } as Row);
}

function seat(participantId: string, busId: string, leg = "out"): void {
  db.seed(GM, {
    $id: `seat-${participantId}-${leg}`,
    big_event_id: db.table(P).get(participantId)?.big_event_id ?? "be1",
    group_id: busId,
    leg,
    participant_id: participantId,
  });
}

interface PersonFields {
  bigEventId?: string;
  bus?: string;
  campus?: string | null;
  dueAt?: string | null;
  notifiedAt?: string | null;
}

/** A participant with an email address; `bus` gives them a seat out. */
function person(id: string, fields: PersonFields = {}): void {
  db.seed(P, {
    $id: id,
    big_event_id: fields.bigEventId ?? "be1",
    bus_notice_due_at: fields.dueAt ?? null,
    bus_notified_at: fields.notifiedAt ?? null,
    campus_id: fields.campus === undefined ? "1" : fields.campus,
    first_name: `Name-${id}`,
    last_name: null,
    phone: null,
    ticket_email: `${id}@example.com`,
    user_id: null,
  });
  if (fields.bus) {
    seat(id, fields.bus);
  }
}

/** Moves someone to another bus out and owes them a notice, as admin does. */
function move(participantId: string, busId: string, when: string): void {
  const row = db.table(GM).get(`seat-${participantId}-out`);
  if (row) {
    row.group_id = busId;
  }
  const participant = db.table(P).get(participantId);
  if (participant) {
    participant.bus_notice_due_at = when;
  }
}

function message(id: string, fields: Partial<BigEventMessageRow> = {}): void {
  db.seed(M, {
    $id: id,
    also_sms: false,
    audience: JSON.stringify({ type: "everyone" }),
    big_event_id: "be1",
    body_en: "Hi {first name}!",
    body_no: "Hei {fornavn}!",
    campus_ids: [],
    email_count: 0,
    important: false,
    kind: "manual",
    leg: null,
    push_count: 0,
    recipients: 0,
    scheduled_at: at(-5),
    sent_at: null,
    sms_count: 0,
    status: "scheduled",
    title_en: "News",
    title_no: "Nytt",
    ...fields,
  } as Row);
}

const messages = () => db.rows<BigEventMessageRow>(M);
const automatic = () => messages().filter((row) => row.kind !== "manual");
const participant = (id: string) =>
  db.table(P).get(id) as unknown as BigEventParticipantRow;
const group = (id: string) =>
  db.table(G).get(id) as unknown as BigEventGroupRow;
const audienceOf = (row: BigEventMessageRow) =>
  JSON.parse(row.audience ?? "null");
const recipientsOf = (messageId: string) =>
  db
    .rows<BigEventMessageRecipientRow>(R)
    .filter((row) => row.message_id === messageId);

beforeEach(() => {
  clock = new Date(START);
  db = new FakeDb();
  dispatchAnnouncement.mockReset();
  dispatchAnnouncement.mockResolvedValue({ recipients: 0 });
  sendMessage.mockReset();
  sendMessage.mockImplementation(realSend);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Texts ─────────────────────────────────────────────────────────────────────

describe("autoTextsFor", () => {
  it("uses the big event's own texts and the default where one is empty", () => {
    const texts = autoTextsFor(
      {
        auto_texts: JSON.stringify({
          bus_assigned: {
            en: { body: "", title: "  " },
            no: { body: "Hei {fornavn}, du tar {buss}.", title: "Din buss" },
          },
          bus_moved: { no: { body: "", title: "Byttet buss" } },
        }),
      },
      "bus_assigned"
    );
    expect(texts.no).toEqual({
      body: "Hei {fornavn}, du tar {buss}.",
      title: "Din buss",
    });
    expect(texts.en).toEqual({
      body: "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}.",
      title: "Your bus",
    });
    const moved = autoTextsFor(
      {
        auto_texts: JSON.stringify({ bus_moved: { no: { title: "Byttet" } } }),
      },
      "bus_moved"
    );
    expect(moved.no.title).toBe("Byttet");
    expect(moved.no.body).toContain("Du er flyttet til {buss}");
  });

  it("falls back to the defaults when the texts can't be read", () => {
    for (const raw of [null, "{not json", "[1,2]", '{"bus_none":"x"}']) {
      expect(autoTextsFor({ auto_texts: raw }, "bus_none").en.title).toBe(
        "Your bus seat"
      );
    }
  });
});

// ── Scheduled messages ────────────────────────────────────────────────────────

describe("runDueMessages: scheduled messages", () => {
  it("sends messages whose time has come and finishes stalled sends", async () => {
    event();
    bus("bus-1", "Buss 1");
    person("p1", { bus: "bus-1" });
    message("m-due", { scheduled_at: at(-5) });
    message("m-later", { scheduled_at: at(30) });
    message("m-no-status", { scheduled_at: at(-1), status: null });
    message("m-stalled", { $updatedAt: at(-11), status: "sending" });
    message("m-sending", { $updatedAt: at(-2), status: "sending" });
    message("m-failed", { scheduled_at: at(-60), status: "failed" });

    const result = await runAt(0);

    expect(result).toEqual({ busMessages: 0, reminders: 0, scheduled: 3 });
    const statuses = Object.fromEntries(
      messages().map((row) => [row.$id, row.status])
    );
    expect(statuses).toEqual({
      "m-due": "sent",
      "m-failed": "failed",
      "m-later": "scheduled",
      "m-no-status": "sent",
      "m-sending": "sending",
      "m-stalled": "sent",
    });
    expect(recipientsOf("m-due").map((row) => row.participant_id)).toEqual([
      "p1",
    ]);
  });

  it("one message's error doesn't stop the others", async () => {
    event();
    message("m1", { scheduled_at: at(-10) });
    message("m2", { scheduled_at: at(-5) });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {
      // Expected: the failure is logged.
    });
    sendMessage.mockRejectedValueOnce(new Error("Appwrite is down"));

    const result = await runAt(0);

    expect(result.scheduled).toBe(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(messages().find((row) => row.$id === "m2")?.status).toBe("sent");
    expect(String(logged.mock.calls[0])).toContain("m1");
  });
});

// ── Bus messages ──────────────────────────────────────────────────────────────

describe("runDueMessages: bus messages", () => {
  it("moves within the settle time give one message with the latest bus", async () => {
    event();
    bus("bus-1", "Buss 1");
    bus("bus-2", "Buss 2");
    bus("bus-3", "Buss 3");
    person("p1", { bus: "bus-1", notifiedAt: at(-120) });

    move("p1", "bus-2", at(-8));
    await runAt(0);
    expect(automatic()).toHaveLength(0);

    move("p1", "bus-3", at(3));
    await runAt(5);
    expect(automatic()).toHaveLength(0);

    const result = await runAt(13);
    await runAt(20);

    expect(result.busMessages).toBe(1);
    expect(automatic()).toHaveLength(1);
    const [notice] = automatic();
    expect(notice).toMatchObject({
      campus_ids: ["1"],
      created_by: null,
      kind: "bus_moved",
      leg: "out",
      scheduled_at: at(13),
      status: "sent",
      title_no: "Ny buss",
    });
    expect(audienceOf(notice as BigEventMessageRow)).toEqual({
      participantIds: ["p1"],
      type: "people",
    });
    const [copy] = recipientsOf(notice?.$id ?? "");
    expect(copy?.vars).toContain("Buss 3");
    expect(copy?.vars).not.toContain("Buss 2");
    expect(participant("p1")).toMatchObject({
      bus_notice_due_at: null,
      bus_notified_at: at(13),
    });
  });

  it("bus messages wait until the lists are published", async () => {
    event({ bus_lists_published_at: null });
    bus("bus-1", "Buss 1");
    person("p1", { bus: "bus-1", dueAt: at(-60) });

    await runAt(0);
    expect(automatic()).toHaveLength(0);
    expect(participant("p1").bus_notice_due_at).toBe(at(-60));

    const published = db.table(E).get("be1");
    if (published) {
      published.bus_lists_published_at = at(1);
    }
    const result = await runAt(2);

    expect(result.busMessages).toBe(1);
    expect(automatic()[0]).toMatchObject({
      kind: "bus_assigned",
      status: "sent",
    });
    expect(participant("p1").bus_notified_at).toBe(at(2));
  });

  it("switched off bus messages are stamped, not sent", async () => {
    event({ auto_bus_assigned: false, auto_bus_moved: false });
    bus("bus-1", "Buss 1");
    person("p-new", { bus: "bus-1", dueAt: at(-20) });
    person("p-moved", { bus: "bus-1", dueAt: at(-20), notifiedAt: at(-90) });
    person("p-off", { dueAt: at(-20), notifiedAt: at(-90) });

    const result = await runAt(0);

    expect(result.busMessages).toBe(0);
    expect(automatic()).toHaveLength(0);
    expect(sendMessage).not.toHaveBeenCalled();
    for (const id of ["p-new", "p-moved", "p-off"]) {
      expect(participant(id)).toMatchObject({
        bus_notice_due_at: null,
        bus_notified_at: at(0),
      });
    }
  });

  it("someone without a bus gets the no-bus message", async () => {
    event();
    bus("bus-1", "Buss 1");
    bus("bus-oslo", "Buss Oslo", { campus_id: "2" });
    person("p-lost", { dueAt: at(-15), notifiedAt: at(-90) });
    // A seat on another campus's bus is no bus (Stage 2 R19).
    person("p-wrong", { bus: "bus-oslo", dueAt: at(-15) });

    await runAt(0);

    expect(automatic()).toHaveLength(1);
    const [notice] = automatic();
    expect(notice).toMatchObject({
      campus_ids: ["1"],
      kind: "bus_none",
      leg: "out",
      status: "sent",
      title_en: "Your bus seat",
    });
    expect(audienceOf(notice as BigEventMessageRow)).toEqual({
      participantIds: ["p-lost", "p-wrong"],
      type: "people",
    });
    const copies = recipientsOf(notice?.$id ?? "");
    expect(copies.map((row) => row.participant_id).sort()).toEqual([
      "p-lost",
      "p-wrong",
    ]);
    expect(copies.every((row) => !row.vars?.includes("Buss Oslo"))).toBe(true);
  });

  it("the no-bus message follows the moved switch once someone was told", async () => {
    event({ auto_bus_moved: false });
    bus("bus-1", "Buss 1");
    person("p-told", { dueAt: at(-15), notifiedAt: at(-90) });
    person("p-never", { dueAt: at(-15) });
    person("p-moved", { bus: "bus-1", dueAt: at(-15), notifiedAt: at(-90) });

    await runAt(0);

    expect(automatic()).toHaveLength(1);
    expect(automatic()[0]?.kind).toBe("bus_none");
    expect(audienceOf(automatic()[0] as BigEventMessageRow)).toEqual({
      participantIds: ["p-never"],
      type: "people",
    });
    for (const id of ["p-told", "p-never", "p-moved"]) {
      expect(participant(id).bus_notice_due_at).toBeNull();
    }
  });

  it("makes one message per kind and campus, in the big event's own words", async () => {
    event({
      auto_texts: JSON.stringify({
        bus_assigned: {
          en: { body: "You're on {bus}.", title: "Bus" },
          no: { body: "Du skal med {buss}.", title: "Buss" },
        },
      }),
    });
    bus("bus-1", "Buss 1");
    bus("bus-2", "Buss 2", { campus_id: "2" });
    person("p1", { bus: "bus-1", dueAt: at(-30) });
    person("p2", { bus: "bus-1", dueAt: at(-30) });
    person("p3", { bus: "bus-2", campus: "2", dueAt: at(-30) });
    person("p4", { campus: null, dueAt: at(-30) });

    const result = await runAt(0);

    expect(result.busMessages).toBe(3);
    const made = automatic().map((row) => ({
      audience: audienceOf(row),
      campus: row.campus_ids,
      kind: row.kind,
    }));
    expect(made).toEqual(
      expect.arrayContaining([
        {
          audience: { participantIds: ["p1", "p2"], type: "people" },
          campus: ["1"],
          kind: "bus_assigned",
        },
        {
          audience: { participantIds: ["p3"], type: "people" },
          campus: ["2"],
          kind: "bus_assigned",
        },
        {
          audience: { participantIds: ["p4"], type: "people" },
          campus: [],
          kind: "bus_none",
        },
      ])
    );
    const assigned = automatic().find((row) => row.kind === "bus_assigned");
    expect(assigned).toMatchObject({
      body_en: "You're on {bus}.",
      body_no: "Du skal med {buss}.",
      important: false,
      also_sms: false,
      title_no: "Buss",
    });
  });

  it("someone moved again during the run waits for the next run", async () => {
    event();
    bus("bus-1", "Buss 1");
    bus("bus-2", "Buss 2");
    person("p1", { bus: "bus-1", dueAt: at(-20) });
    person("p2", { bus: "bus-1", dueAt: at(-20) });
    let moved = false;
    db.afterList = (table) => {
      if (table === P && !moved) {
        moved = true;
        move("p2", "bus-2", at(0));
      }
    };

    await runAt(0);

    expect(automatic()).toHaveLength(1);
    expect(audienceOf(automatic()[0] as BigEventMessageRow)).toEqual({
      participantIds: ["p1"],
      type: "people",
    });
    expect(participant("p1").bus_notice_due_at).toBeNull();
    expect(participant("p2")).toMatchObject({
      bus_notice_due_at: at(0),
      bus_notified_at: null,
    });

    db.afterList = null;
    await runAt(10);
    expect(automatic()).toHaveLength(2);
    expect(participant("p2").bus_notified_at).toBe(at(10));
  });

  it("splits a large group so every audience fits its column", async () => {
    event();
    bus("bus-1", "Buss 1");
    const ids = Array.from(
      { length: 150 },
      (_, i) => `p${String(i).padStart(35, "0")}`
    );
    for (const id of ids) {
      person(id, { bus: "bus-1", dueAt: at(-30) });
    }
    sendMessage.mockResolvedValue({ error: "busy", ok: false });

    const result = await runAt(0);

    expect(result.busMessages).toBe(2);
    const audiences = automatic().map((row) => audienceOf(row));
    expect(
      audiences.flatMap((audience) => audience.participantIds).sort()
    ).toEqual(ids);
    expect(automatic().every((row) => row.kind === "bus_assigned")).toBe(true);
    expect(ids.every((id) => participant(id).bus_notified_at === at(0))).toBe(
      true
    );
  });

  it("a message made but not sent yet goes out on the next run", async () => {
    event();
    bus("bus-1", "Buss 1", { out_departs_at: at(60) });
    person("p1", { bus: "bus-1", dueAt: at(-30) });

    // Out of time: the messages are made and everyone stamped, nothing sent.
    const first = await runAt(0, { budgetMs: 0 });
    expect(first).toEqual({ busMessages: 1, reminders: 1, scheduled: 0 });
    expect(automatic().map((row) => row.status)).toEqual([
      "scheduled",
      "scheduled",
    ]);
    expect(participant("p1").bus_notice_due_at).toBeNull();
    expect(group("bus-1").out_reminder_sent_at).toBe(at(0));

    const next = await runAt(5);
    expect(next).toEqual({ busMessages: 0, reminders: 0, scheduled: 2 });
    expect(automatic().map((row) => row.status)).toEqual(["sent", "sent"]);
  });

  it("one big event failing doesn't stop the others", async () => {
    event();
    event({}, "be2");
    bus("bus-1", "Buss 1");
    bus("bus-9", "Buss 9", {}, "be2");
    person("p1", { bus: "bus-1", dueAt: at(-30) });
    person("p9", { bigEventId: "be2", bus: "bus-9", dueAt: at(-30) });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {
      // Expected: the failure is logged.
    });
    db.failList = (table, queries) =>
      table === P && queries.some((query) => query.includes('"be1"'));

    const result = await runAt(0);

    expect(result.busMessages).toBe(1);
    expect(automatic()[0]?.big_event_id).toBe("be2");
    expect(participant("p9").bus_notified_at).toBe(at(0));
    expect(String(logged.mock.calls[0])).toContain("be1");
  });
});

// ── Departure reminders ───────────────────────────────────────────────────────

describe("runDueMessages: departure reminders", () => {
  it("one reminder per leg even across late cron runs", async () => {
    const homeAt = 3 * 24 * 60;
    event();
    bus("bus-1", "Buss 1", {
      home_departs_at: at(homeAt),
      out_departs_at: at(120),
    });
    // The cron was late: this one leaves in 45 minutes and wasn't reminded.
    bus("bus-2", "Buss 2", { campus_id: "2", out_departs_at: at(45) });
    person("p1", { bus: "bus-1", notifiedAt: at(-200) });
    person("p2", { bus: "bus-2", campus: "2", notifiedAt: at(-200) });
    person("p3", { notifiedAt: at(-200) });
    seat("p3", "bus-1", "home");

    const first = await runAt(0);
    await runAt(5);
    await runAt(40);

    expect(first.reminders).toBe(2);
    expect(automatic()).toHaveLength(2);
    const out = automatic().find((row) =>
      audienceOf(row).groupIds.includes("bus-1")
    );
    expect(out).toMatchObject({
      campus_ids: ["1"],
      kind: "departure_reminder",
      leg: "out",
      status: "sent",
      title_no: "Bussen går snart",
    });
    expect(audienceOf(out as BigEventMessageRow)).toEqual({
      groupIds: ["bus-1"],
      leg: "out",
      type: "groups",
    });
    expect(
      recipientsOf(out?.$id ?? "").map((row) => row.participant_id)
    ).toEqual(["p1"]);
    expect(group("bus-1").out_reminder_sent_at).toBe(at(0));
    expect(group("bus-1").home_reminder_sent_at).toBeNull();
    expect(group("bus-2").out_reminder_sent_at).toBe(at(0));

    const home = await runAt(homeAt - 100);
    await runAt(homeAt - 95);

    expect(home.reminders).toBe(1);
    expect(automatic()).toHaveLength(3);
    const back = automatic().find((row) => row.leg === "home");
    expect(audienceOf(back as BigEventMessageRow)).toEqual({
      groupIds: ["bus-1"],
      leg: "home",
      type: "groups",
    });
    expect(
      recipientsOf(back?.$id ?? "").map((row) => row.participant_id)
    ).toEqual(["p3"]);
    expect(group("bus-1").home_reminder_sent_at).toBe(at(homeAt - 100));
  });

  it("no reminder for a departure already passed", async () => {
    event();
    bus("bus-gone", "Buss 1", { out_departs_at: at(-10) });
    bus("bus-now", "Buss 2", { out_departs_at: at(0) });
    bus("bus-later", "Buss 3", { out_departs_at: at(121) });
    bus("bus-none", "Buss 4", { out_departs_at: null });

    const result = await runAt(0);

    expect(result.reminders).toBe(0);
    expect(automatic()).toHaveLength(0);
    for (const id of ["bus-gone", "bus-now", "bus-later", "bus-none"]) {
      expect(group(id).out_reminder_sent_at).toBeNull();
    }
  });

  it("reminders wait for the switch, travel and published bus lists", async () => {
    event({ auto_departure_reminder: false });
    event({ bus_lists_published_at: null }, "be2");
    event({ travel_enabled: false }, "be3");
    event({ auto_departure_reminder: null }, "be4");
    bus("bus-1", "Buss 1", { out_departs_at: at(60) });
    bus("bus-2", "Buss 2", { out_departs_at: at(60) }, "be2");
    bus("bus-3", "Buss 3", { out_departs_at: at(60) }, "be3");
    bus("bus-4", "Buss 4", { out_departs_at: at(60) }, "be4");

    const result = await runAt(0);

    expect(result.reminders).toBe(1);
    expect(automatic().map((row) => row.big_event_id)).toEqual(["be4"]);
  });
});
