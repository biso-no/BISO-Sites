import type { TablesDB } from "@repo/api";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { deriveConnectToken, hashConnectToken } from "./connect-token";
import { BIG_EVENT_TABLES } from "./tables";
import type {
  BigEventDeliveryRow,
  BigEventParticipantRow,
  BigEventRow,
} from "./types";

vi.mock("server-only", () => ({}));

const { enqueueConnectEmails, enqueueDueReminders, processDeliveries } =
  await import("./delivery-queue");
type DeliveryDb = import("./delivery-queue").DeliveryDb;

// ── In-memory Appwrite fake: evaluates the JSON query strings ─────────────────

type Data = Record<string, unknown>;
type Row = Data & { $createdAt: string; $id: string };

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

const APPWRITE_DEFAULT_LIMIT = 25;

function compare(value: unknown, target: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value).localeCompare(String(target));
}

function matches(row: Row, query: ParsedQuery): boolean {
  const value = query.attribute ? row[query.attribute] : undefined;
  const target = query.values?.[0];
  switch (query.method) {
    case "equal":
      return (query.values ?? []).includes(value);
    case "isNull":
      return value === null || value === undefined;
    case "isNotNull":
      return value !== null && value !== undefined;
    case "lessThan":
      return (compare(value, target) ?? 0) < 0 && value != null;
    case "lessThanEqual":
      return (compare(value, target) ?? 1) <= 0 && value != null;
    case "greaterThan":
      return (compare(value, target) ?? 0) > 0 && value != null;
    case "or":
      return (query.values as ParsedQuery[]).some((sub) => matches(row, sub));
    default:
      throw new Error(`fake db: unsupported query ${query.method}`);
  }
}

function notFound(): Error {
  return Object.assign(new Error("Row not found"), { code: 404 });
}

const PAGING = new Set(["limit", "cursorAfter", "orderAsc", "orderDesc"]);
/** Appwrite refuses a query with more values than this. */
const MAX_QUERY_VALUES = 100;

class FakeDb {
  readonly tables = new Map<string, Map<string, Row>>();
  /** Runs after each update, so a test can play a competing run. */
  afterUpdate: ((table: string, row: Row) => void) | null = null;
  /** Runs before each read or write; throwing fails that call (a transient error). */
  beforeCall:
    | ((call: "get" | "update", table: string, data?: Data) => void)
    | null = null;
  private seq = 0;

  private fault(
    call: "get" | "update",
    table: string,
    data?: Data
  ): Error | null {
    try {
      this.beforeCall?.(call, table, data);
      return null;
    } catch (error) {
      return error as Error;
    }
  }

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

  seed(name: string, row: Partial<Row> & { $id: string }): void {
    this.seq += 1;
    this.table(name).set(row.$id, {
      $createdAt: new Date(Date.UTC(2027, 0, 1, 0, 0, this.seq)).toISOString(),
      ...row,
    });
  }

  createRow(
    _databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ): Promise<Row> {
    const id = rowId === "unique()" ? `row-${this.seq + 1}` : rowId;
    this.seed(tableId, { $id: id, ...data });
    return Promise.resolve({ ...(this.table(tableId).get(id) as Row) });
  }

  getRow<T>(_databaseId: string, tableId: string, rowId: string): Promise<T> {
    const error = this.fault("get", tableId);
    if (error) {
      return Promise.reject(error);
    }
    const row = this.table(tableId).get(rowId);
    if (!row) {
      return Promise.reject(notFound());
    }
    return Promise.resolve(structuredClone(row) as unknown as T);
  }

  listRows<T>(
    _databaseId: string,
    tableId: string,
    queries: string[] = []
  ): Promise<{ rows: T[]; total: number }> {
    const parsed = queries.map((q) => JSON.parse(q) as ParsedQuery);
    if (parsed.some((q) => (q.values?.length ?? 0) > MAX_QUERY_VALUES)) {
      return Promise.reject(new Error("Query values limit exceeded"));
    }
    let rows = [...this.table(tableId).values()].filter((row) =>
      parsed.every((q) => PAGING.has(q.method) || matches(row, q))
    );
    for (const q of parsed) {
      if (q.method === "orderAsc" || q.method === "orderDesc") {
        const key = q.attribute as string;
        const sign = q.method === "orderAsc" ? 1 : -1;
        rows = rows.sort(
          (a, b) => sign * String(a[key]).localeCompare(String(b[key]))
        );
      }
    }
    const total = rows.length;
    const cursor = parsed.find((q) => q.method === "cursorAfter");
    if (cursor) {
      const index = rows.findIndex((row) => row.$id === cursor.values?.[0]);
      rows = rows.slice(index + 1);
    }
    const limit = parsed.find((q) => q.method === "limit");
    rows = rows.slice(
      0,
      (limit?.values?.[0] as number | undefined) ?? APPWRITE_DEFAULT_LIMIT
    );
    return Promise.resolve({
      rows: structuredClone(rows) as unknown as T[],
      total,
    });
  }

  updateRow(
    _databaseId: string,
    tableId: string,
    rowId: string,
    data: Data
  ): Promise<Row> {
    const error = this.fault("update", tableId, data);
    if (error) {
      return Promise.reject(error);
    }
    const row = this.table(tableId).get(rowId);
    if (!row) {
      return Promise.reject(notFound());
    }
    Object.assign(row, data);
    this.afterUpdate?.(tableId, row);
    return Promise.resolve({ ...row });
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2027-01-10T12:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const SECRET = "test-secret";
const WEB_BASE = "https://biso.test";
const CONNECT_URL_RE = /https:\/\/biso\.test\/connect\/[A-Za-z0-9_-]+/g;
const P = BIG_EVENT_TABLES.participants;
const D = BIG_EVENT_TABLES.deliveries;
const E = BIG_EVENT_TABLES.events;

function participant(
  id: string,
  overrides: Partial<BigEventParticipantRow> = {}
): BigEventParticipantRow {
  return {
    $createdAt: NOW.toISOString(),
    $databaseId: "app",
    $id: id,
    $permissions: [],
    $sequence: 0,
    $tableId: P,
    $updatedAt: NOW.toISOString(),
    big_event_id: "be1",
    campus_id: null,
    connect_nonce: null,
    connect_reminded_at: null,
    connect_sent_at: null,
    connect_token_hash: null,
    dismissed_user_id: null,
    first_name: `First-${id}`,
    last_import_id: null,
    last_name: `Last-${id}`,
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
    room_size: null,
    suggested_reason: null,
    suggested_user_id: null,
    ticket_category: null,
    ticket_email: `${id}@example.com`,
    ticket_ref: null,
    user_id: null,
    ...overrides,
  } as BigEventParticipantRow;
}

function bigEvent(id: string, overrides: Partial<BigEventRow> = {}): Row {
  return {
    $createdAt: NOW.toISOString(),
    $id: id,
    campus_id: "1",
    ends_at: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    name_en: "Winter Games EN",
    name_no: "Winter Games",
    starts_at: new Date(NOW.getTime() + 28 * DAY).toISOString(),
    status: "published",
    ...overrides,
  };
}

let db: FakeDb;
let clock: number;
let sendEmail: ReturnType<typeof vi.fn>;
let sleep: ReturnType<typeof vi.fn>;

function seedPeople(people: BigEventParticipantRow[]): void {
  for (const person of people) {
    db.seed(P, person as unknown as Row);
  }
}

function deps() {
  return {
    db: db as unknown as DeliveryDb,
    now: () => new Date(clock),
    secret: SECRET,
    sendEmail: sendEmail as never,
    sleep: sleep as (ms: number) => Promise<void>,
    webBase: WEB_BASE,
  };
}

const RUN = { budgetMs: 45_000, perMinute: 25, runId: "run-1" };

function sentTo(): string[] {
  return sendEmail.mock.calls.map((call) => (call[0] as { to: string }).to);
}

/** The personal connect links in a sent email (each language repeats them). */
function urlsIn(callIndex: number): string[] {
  const { text } = sendEmail.mock.calls[callIndex]?.[0] as { text: string };
  const urls = (text.match(CONNECT_URL_RE) ?? []).filter(
    (url) => url !== `${WEB_BASE}/connect/help`
  );
  return [...new Set(urls)];
}

beforeEach(() => {
  db = new FakeDb();
  clock = NOW.getTime();
  db.seed(E, bigEvent("be1"));
  sendEmail = vi.fn(() =>
    Promise.resolve({ accepted: ["x"], messageId: "m", rejected: [] })
  );
  sleep = vi.fn((ms: number) => {
    clock += ms;
    return Promise.resolve();
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DeliveryDb", () => {
  it("accepts the real Appwrite client", () => {
    expectTypeOf<TablesDB>().toExtend<DeliveryDb>();
  });
});

describe("enqueueConnectEmails", () => {
  it("one email per address for people sharing it", async () => {
    const people = [
      participant("p1", { ticket_email: "family@example.com" }),
      participant("p2", { ticket_email: " Family@Example.com " }),
      participant("p3", { ticket_email: "kari@example.com" }),
    ];
    seedPeople(people);

    const result = await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });

    expect(result).toEqual({ addresses: 2, queued: 3, waiting: 0 });
    const rows = db.rows<BigEventDeliveryRow>(D);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      big_event_id: "be1",
      channel: "email",
      kind: "connect",
      participant_ids: ["p1", "p2"],
      scheduled_for: null,
      status: "pending",
      to_address: "family@example.com",
    });

    await processDeliveries(deps(), RUN);
    expect(sentTo()).toEqual(["family@example.com", "kari@example.com"]);
    expect(urlsIn(0)).toHaveLength(2);
  });

  it("does not queue linked participants", async () => {
    const people = [
      participant("p1", { user_id: "u1" }),
      participant("p2", { ticket_email: null }),
      participant("p3"),
    ];

    const result = await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });

    expect(result).toEqual({ addresses: 1, queued: 1, waiting: 0 });
    expect(db.rows<BigEventDeliveryRow>(D)[0]?.participant_ids).toEqual(["p3"]);
  });

  it("does not queue the same people twice while a send is pending", async () => {
    const people = [participant("p1")];
    const input = {
      bigEventId: "be1",
      kind: "connect" as const,
      participants: people,
    };

    await enqueueConnectEmails(db as unknown as DeliveryDb, input);
    const again = await enqueueConnectEmails(
      db as unknown as DeliveryDb,
      input
    );

    // Nothing new, and the caller can say why: the email is already waiting.
    expect(again).toEqual({ addresses: 0, queued: 0, waiting: 1 });
    expect(db.rows(D)).toHaveLength(1);
  });

  it("a send again for more people only queues the new ones", async () => {
    const ola = participant("p1", { ticket_email: "family@example.com" });
    const kari = participant("p2", { ticket_email: "family@example.com" });
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [ola],
    });

    const again = await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [ola, kari],
    });

    expect(again).toEqual({ addresses: 1, queued: 1, waiting: 1 });
    expect(
      db.rows<BigEventDeliveryRow>(D).map((row) => row.participant_ids)
    ).toEqual([["p1"], ["p2"]]);
  });

  it("queues a corrected address even while the old email waits", async () => {
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [participant("p1", { ticket_email: "typo@exmaple.com" })],
    });
    const fixed = participant("p1", { ticket_email: "p1@example.com" });
    seedPeople([fixed]);

    const again = await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [fixed],
    });
    await processDeliveries(deps(), RUN);

    expect(again).toEqual({ addresses: 1, queued: 1, waiting: 0 });
    expect(sentTo()).toEqual(["p1@example.com"]);
  });

  it("a second request that sees the first one queues nobody twice", async () => {
    const people = [
      participant("p1", { ticket_email: "family@example.com" }),
      participant("p2", { ticket_email: "family@example.com" }),
      participant("p3"),
    ];
    // The organizer sends to everyone, then the family asks for its links
    // again from the help page while that email is still waiting.
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });
    const help = await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people.slice(0, 2),
    });

    expect(help).toEqual({ addresses: 0, queued: 0, waiting: 2 });
    expect(db.rows(D)).toHaveLength(2);
  });
});

describe("processDeliveries", () => {
  it("a sent row and a failed row both keep their claim time", async () => {
    const people = [participant("p1"), participant("p2")];
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });
    sendEmail
      .mockResolvedValueOnce({ accepted: ["x"], messageId: "m", rejected: [] })
      .mockRejectedValueOnce(new Error("Too many messages"));

    await processDeliveries(deps(), RUN);

    const [first, second] = db.rows<BigEventDeliveryRow>(D);
    expect(first).toMatchObject({ claimed_by: "run-1", status: "sent" });
    expect(first?.claimed_at).toBe(NOW.toISOString());
    expect(second).toMatchObject({ claimed_by: "run-1", status: "pending" });
    // Claimed before the pace wait, so at the same instant as the first.
    expect(second?.claimed_at).toBe(NOW.toISOString());
  });

  it("sends one email with every link when 150 people share an address", async () => {
    const people = Array.from({ length: 150 }, (_, index) =>
      participant(`p${index}`, { ticket_email: "group@example.com" })
    );
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });

    const result = await processDeliveries(deps(), RUN);

    expect(result).toEqual({ failed: 0, remaining: 0, sent: 1 });
    expect(urlsIn(0)).toHaveLength(150);
  });

  it("retries the status write after a send instead of sending again", async () => {
    seedPeople([participant("p1")]);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [participant("p1")],
    });
    let failSentWrite = true;
    db.beforeCall = (call, table, data) => {
      if (
        call === "update" &&
        table === D &&
        data?.status === "sent" &&
        failSentWrite
      ) {
        failSentWrite = false;
        throw new Error("Appwrite hiccup");
      }
    };

    const result = await processDeliveries(deps(), RUN);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ failed: 0, remaining: 0, sent: 1 });
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      attempts: 0,
      status: "sent",
    });
  });

  it("a transient error while claiming skips only that row", async () => {
    const people = [participant("p1"), participant("p2")];
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });
    let failFirstRead = true;
    db.beforeCall = (call, table) => {
      if (call === "get" && table === D && failFirstRead) {
        failFirstRead = false;
        throw new Error("Appwrite hiccup");
      }
    };

    const result = await processDeliveries(deps(), RUN);

    expect(sentTo()).toEqual(["p2@example.com"]);
    expect(result).toEqual({ failed: 0, remaining: 1, sent: 1 });
    expect(db.rows<BigEventDeliveryRow>(D)[0]?.status).toBe("pending");
  });

  it("a claimed row taken by another run is skipped", async () => {
    seedPeople([participant("p1")]);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [participant("p1")],
    });
    db.afterUpdate = (table, row) => {
      if (table === D && row.claimed_by === "run-1") {
        row.claimed_by = "run-2";
      }
    };

    const result = await processDeliveries(deps(), RUN);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      claimed_by: "run-2",
      status: "sending",
    });
  });

  it("a failed send is retried then marked failed after 3 attempts", async () => {
    seedPeople([participant("p1")]);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [participant("p1")],
    });
    sendEmail.mockRejectedValue(new Error(`SMTP down ${"x".repeat(600)}`));

    const first = await processDeliveries(deps(), RUN);
    expect(first).toMatchObject({ failed: 1, remaining: 0, sent: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [row] = db.rows<BigEventDeliveryRow>(D);
    expect(row).toMatchObject({
      attempts: 1,
      claimed_at: NOW.toISOString(),
      claimed_by: "run-1",
      status: "pending",
    });
    expect(row?.last_error?.startsWith("SMTP down")).toBe(true);
    expect(row?.last_error).toHaveLength(500);

    clock += 60 * MINUTE;
    await processDeliveries(deps(), RUN);
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      attempts: 2,
      status: "pending",
    });

    clock += 60 * MINUTE;
    await processDeliveries(deps(), RUN);
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      attempts: 3,
      status: "failed",
    });
    expect(sendEmail).toHaveBeenCalledTimes(3);

    clock += 60 * MINUTE;
    await processDeliveries(deps(), RUN);
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });

  it("respects the per-minute pace", async () => {
    const people = [participant("p1"), participant("p2")];
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });

    const result = await processDeliveries(deps(), RUN);

    expect(result).toEqual({ failed: 0, remaining: 0, sent: 2 });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2400);
  });

  it("stops when the budget is spent and reports what is left", async () => {
    const people = [participant("p1"), participant("p2"), participant("p3")];
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });

    const result = await processDeliveries(deps(), { ...RUN, budgetMs: 3000 });

    expect(result).toEqual({ failed: 0, remaining: 1, sent: 2 });
    expect(
      db.rows<BigEventDeliveryRow>(D).filter((row) => row.status === "pending")
    ).toHaveLength(1);
  });

  it("reminder keeps the original link", async () => {
    seedPeople([participant("p1")]);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: [participant("p1")],
    });
    await processDeliveries(deps(), RUN);

    const [firstUrl] = urlsIn(0);
    const afterFirst = db.rows<BigEventParticipantRow>(P)[0];
    const token = firstUrl?.split("/connect/")[1] ?? "";
    expect(afterFirst?.connect_nonce).toBeTruthy();
    expect(token).toBe(
      deriveConnectToken(SECRET, "p1", afterFirst?.connect_nonce ?? "")
    );
    expect(afterFirst?.connect_token_hash).toBe(hashConnectToken(token));
    expect(afterFirst?.connect_sent_at).toBe(NOW.toISOString());

    clock += 4 * DAY;
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect_reminder",
      participants: db.rows<BigEventParticipantRow>(P),
    });
    await processDeliveries(deps(), RUN);

    const reminder = sendEmail.mock.calls[1]?.[0] as { subject: string };
    expect(reminder.subject.startsWith("Påminnelse: ")).toBe(true);
    expect(urlsIn(1)).toEqual([firstUrl]);
    const afterReminder = db.rows<BigEventParticipantRow>(P)[0];
    expect(afterReminder?.connect_nonce).toBe(afterFirst?.connect_nonce);
    expect(afterReminder?.connect_sent_at).toBe(NOW.toISOString());
    expect(afterReminder?.connect_reminded_at).toBe(
      new Date(clock).toISOString()
    );
  });

  it("stuck sending rows are released after 10 minutes", async () => {
    seedPeople([participant("p1"), participant("p2")]);
    db.seed(D, {
      $id: "stuck",
      attempts: 0,
      big_event_id: "be1",
      channel: "email",
      claimed_at: new Date(clock - 11 * MINUTE).toISOString(),
      claimed_by: "crashed-run",
      kind: "connect",
      participant_ids: ["p1"],
      scheduled_for: null,
      status: "sending",
      to_address: "p1@example.com",
    });
    db.seed(D, {
      $id: "busy",
      attempts: 0,
      big_event_id: "be1",
      channel: "email",
      claimed_at: new Date(clock - 5 * MINUTE).toISOString(),
      claimed_by: "live-run",
      kind: "connect",
      participant_ids: ["p2"],
      scheduled_for: null,
      status: "sending",
      to_address: "p2@example.com",
    });

    await processDeliveries(deps(), RUN);

    expect(sentTo()).toEqual(["p1@example.com"]);
    const rows = db.rows<BigEventDeliveryRow>(D);
    expect(rows.find((row) => row.$id === "stuck")?.status).toBe("sent");
    expect(rows.find((row) => row.$id === "busy")).toMatchObject({
      claimed_by: "live-run",
      status: "sending",
    });
  });

  it("skips a delivery whose people connected or changed address meanwhile", async () => {
    const people = [
      participant("p1", { ticket_email: "family@example.com" }),
      participant("p2", { ticket_email: "family@example.com" }),
    ];
    seedPeople(people);
    await enqueueConnectEmails(db as unknown as DeliveryDb, {
      bigEventId: "be1",
      kind: "connect",
      participants: people,
    });
    await db.updateRow("app", P, "p1", { user_id: "u1" });
    await db.updateRow("app", P, "p2", { ticket_email: "new@example.com" });

    const result = await processDeliveries(deps(), RUN);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ failed: 0, remaining: 0, sent: 0 });
    expect(db.rows<BigEventDeliveryRow>(D)[0]?.status).toBe("skipped");
  });

  it("releases a stuck message row like any other", async () => {
    db.seed(D, {
      $id: "msg",
      attempts: 2,
      big_event_id: "be1",
      channel: "email",
      claimed_at: new Date(clock - 11 * MINUTE).toISOString(),
      claimed_by: "old-run",
      kind: "message",
      message_id: "m1",
      participant_ids: ["p1", "p2"],
      scheduled_for: null,
      status: "sending",
      to_address: "p1@example.com",
    });
    db.seed(MSG, { $id: "m1", failed_count: 1 });

    await processDeliveries(deps(), RUN);

    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      attempts: 3,
      status: "failed",
    });
    expect(db.rows<Data>(MSG)[0]?.failed_count).toBe(3);
  });
});

// ── Message rows ──────────────────────────────────────────────────────────────

const MSG = BIG_EVENT_TABLES.messages;
const RCP = BIG_EVENT_TABLES.messageRecipients;

function seedMessage(): void {
  db.seed(MSG, {
    $id: "m1",
    body_en: "Hi {first name}, the bus leaves at {departure}.\n\nSee you.",
    body_no: "Hei {fornavn}, bussen går {avgang}.\n\nVi ssees.",
    failed_count: 0,
    title_en: "Bus news",
    title_no: "Bussnytt",
  });
}

function seedRecipient(
  id: string,
  overrides: Record<string, unknown> = {}
): void {
  db.seed(RCP, {
    $id: `r-${id}`,
    message_id: "m1",
    participant_id: id,
    user_id: null,
    vars: JSON.stringify({
      en: { departure: "Fri 24 Jan, 14:00", first_name: `First-${id}` },
      no: {
        avgang: "",
        departure: "fre. 24. jan. kl. 14:00",
        first_name: `First-${id}`,
      },
    }),
    ...overrides,
  });
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: "d1",
    attempts: 0,
    big_event_id: "be1",
    channel: "email",
    kind: "message",
    message_id: "m1",
    participant_ids: ["p1"],
    scheduled_for: null,
    status: "pending",
    to_address: "p1@example.com",
    ...overrides,
  };
}

interface Sent {
  html: string;
  subject: string;
  text: string;
  to: string;
}
const lastSent = () => sendEmail.mock.calls.at(-1)?.[0] as Sent;

describe("message deliveries", () => {
  beforeEach(() => {
    seedMessage();
    seedPeople([participant("p1"), participant("p2")]);
  });

  it("sends a message email in the person's language", async () => {
    db.seed("user", { $id: "u1", locale: "no" });
    seedRecipient("p1", { user_id: "u1" });
    db.seed(D, messageRow());

    const result = await processDeliveries(deps(), RUN);

    expect(result.sent).toBe(1);
    const mail = lastSent();
    expect(mail.to).toBe("p1@example.com");
    expect(mail.subject).toBe("Bussnytt");
    expect(mail.text).toContain(
      "Hei First-p1, bussen går fre. 24. jan. kl. 14:00"
    );
    expect(mail.text).not.toContain("Bus news");
    expect(mail.text).toContain(
      "Du får denne fordi du er med på Winter Games i BISO."
    );
    expect(mail.text).not.toContain("Til:");
    expect(db.rows<BigEventDeliveryRow>(D)[0]?.status).toBe("sent");
  });

  it("uses English for a linked person with another locale", async () => {
    db.seed("user", { $id: "u1", locale: "sv" });
    seedRecipient("p1", { user_id: "u1" });
    db.seed(D, messageRow());

    await processDeliveries(deps(), RUN);

    expect(lastSent().subject).toBe("Bus news");
    expect(lastSent().text).toContain(
      "You get this because you're on Winter Games EN in BISO."
    );
  });

  it("unlinked people get both languages", async () => {
    seedRecipient("p1");
    db.seed(D, messageRow());

    await processDeliveries(deps(), RUN);

    const mail = lastSent();
    expect(mail.subject).toBe("Bussnytt · Bus news");
    expect(mail.text.indexOf("Hei First-p1")).toBeLessThan(
      mail.text.indexOf("Hi First-p1")
    );
    expect(mail.text).toContain("Du får denne fordi");
    expect(mail.text).toContain("You get this because");
  });

  it("names the people when one row covers several", async () => {
    seedRecipient("p1");
    seedRecipient("p2");
    db.seed(D, messageRow({ participant_ids: ["p1", "p2"] }));

    await processDeliveries(deps(), RUN);

    expect(lastSent().text).toContain(
      "Til: First-p1 Last-p1, First-p2 Last-p2"
    );
    expect(lastSent().text).toContain(
      "For: First-p1 Last-p1, First-p2 Last-p2"
    );
  });

  it("names the person when the address has two rows for this message", async () => {
    seedRecipient("p1");
    seedRecipient("p2");
    db.seed(
      D,
      messageRow({
        $id: "d1",
        participant_ids: ["p1"],
        to_address: "same@example.com",
      })
    );
    db.seed(
      D,
      messageRow({
        $id: "d2",
        participant_ids: ["p2"],
        to_address: "same@example.com",
      })
    );

    await processDeliveries(deps(), RUN);

    expect(sendEmail.mock.calls[0]?.[0].text).toContain(
      "Til: First-p1 Last-p1"
    );
    expect(sendEmail.mock.calls[1]?.[0].text).toContain(
      "Til: First-p2 Last-p2"
    );
  });

  it("names both people when the addresses differ only in case", async () => {
    seedRecipient("p1");
    seedRecipient("p2");
    db.seed(
      D,
      messageRow({
        $id: "d1",
        participant_ids: ["p1"],
        to_address: "Kari@x.no",
      })
    );
    db.seed(
      D,
      messageRow({
        $id: "d2",
        participant_ids: ["p2"],
        to_address: " kari@x.no",
      })
    );

    await processDeliveries(deps(), RUN);

    expect(sendEmail.mock.calls[0]?.[0].text).toContain(
      "Til: First-p1 Last-p1"
    );
    expect(sendEmail.mock.calls[1]?.[0].text).toContain(
      "Til: First-p2 Last-p2"
    );
  });

  it("sms rows are skipped with a reason", async () => {
    seedRecipient("p1");
    db.seed(D, messageRow({ channel: "sms", to_address: "+4799999999" }));

    const result = await processDeliveries(deps(), RUN);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ failed: 0, remaining: 0, sent: 0 });
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      last_error: "No SMS provider",
      status: "skipped",
    });
  });

  it("skips a row whose message is gone", async () => {
    db.table(MSG).clear();
    seedRecipient("p1");
    db.seed(D, messageRow());

    await processDeliveries(deps(), RUN);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      last_error: "The message no longer exists.",
      status: "skipped",
    });
  });

  it("skips a row whose recipient is gone", async () => {
    db.seed(D, messageRow());

    await processDeliveries(deps(), RUN);

    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      last_error: "The recipient no longer exists.",
      status: "skipped",
    });
  });

  it("counts a final failure on the message", async () => {
    seedRecipient("p1");
    db.seed(D, messageRow({ attempts: 2 }));
    sendEmail.mockRejectedValueOnce(new Error("Mailbox full"));

    const result = await processDeliveries(deps(), RUN);

    expect(result.failed).toBe(1);
    expect(db.rows<BigEventDeliveryRow>(D)[0]).toMatchObject({
      last_error: "Mailbox full",
      status: "failed",
    });
    expect(db.rows<Data>(MSG)[0]?.failed_count).toBe(1);
  });

  it("does not count a failure that will be retried", async () => {
    seedRecipient("p1");
    db.seed(D, messageRow());
    sendEmail.mockRejectedValueOnce(new Error("Busy"));

    await processDeliveries(deps(), RUN);

    expect(db.rows<BigEventDeliveryRow>(D)[0]?.status).toBe("pending");
    expect(db.rows<Data>(MSG)[0]?.failed_count).toBe(0);
  });
});

describe("enqueueDueReminders", () => {
  const sentAgo = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("enqueueDueReminders waits 4 days", async () => {
    seedPeople([
      participant("due", { connect_sent_at: sentAgo(4 * DAY + MINUTE) }),
      participant("early", { connect_sent_at: sentAgo(4 * DAY - MINUTE) }),
      participant("reminded", {
        connect_reminded_at: sentAgo(DAY),
        connect_sent_at: sentAgo(5 * DAY),
      }),
      participant("linked", {
        connect_sent_at: sentAgo(5 * DAY),
        user_id: "u1",
      }),
      participant("never"),
    ]);

    expect(await enqueueDueReminders(db as unknown as DeliveryDb, NOW)).toBe(1);
    const rows = db.rows<BigEventDeliveryRow>(D);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "connect_reminder",
      participant_ids: ["due"],
    });

    expect(await enqueueDueReminders(db as unknown as DeliveryDb, NOW)).toBe(0);
  });

  it("skips draft and ended big events", async () => {
    db.seed(E, bigEvent("draft", { status: "draft" }));
    db.seed(
      E,
      bigEvent("ended", {
        ends_at: new Date(NOW.getTime() - DAY).toISOString(),
      })
    );
    seedPeople([
      participant("d1", {
        big_event_id: "draft",
        connect_sent_at: sentAgo(5 * DAY),
      }),
      participant("e1", {
        big_event_id: "ended",
        connect_sent_at: sentAgo(5 * DAY),
      }),
    ]);

    expect(await enqueueDueReminders(db as unknown as DeliveryDb, NOW)).toBe(0);
    expect(db.rows(D)).toHaveLength(0);
  });

  it("does not queue a reminder again after it failed for good", async () => {
    seedPeople([participant("p1", { connect_sent_at: sentAgo(5 * DAY) })]);
    db.seed(D, {
      $id: "old",
      attempts: 3,
      big_event_id: "be1",
      channel: "email",
      kind: "connect_reminder",
      participant_ids: ["p1"],
      status: "failed",
      to_address: "p1@example.com",
    });

    expect(await enqueueDueReminders(db as unknown as DeliveryDb, NOW)).toBe(0);
  });
});
