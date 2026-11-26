import type { Messaging, TablesDB } from "@repo/api";
import type { Announcements } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BIG_EVENT_TABLES } from "../tables";
import type {
  BigEventDeliveryRow,
  BigEventMessageRecipientRow,
  BigEventMessageRow,
} from "../types";

vi.mock("server-only", () => ({}));
const { dispatchAnnouncement } = vi.hoisted(() => ({
  dispatchAnnouncement: vi.fn(),
}));
vi.mock("../../utils/push-dispatch", () => ({ dispatchAnnouncement }));

const { sendMessage } = await import("./send");
const { localizedPushContent } = await vi.importActual<
  typeof import("../../utils/push-dispatch")
>("../../utils/push-dispatch");

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
const D = BIG_EVENT_TABLES.deliveries;
const MINUTE = 60_000;

let clock = new Date("2027-01-10T12:00:00.000Z");

function rejectWith(message: string, code: number): Promise<never> {
  return Promise.reject(Object.assign(new Error(message), { code }));
}

function matches(row: Row, query: ParsedQuery): boolean {
  const value = query.attribute ? row[query.attribute] : undefined;
  switch (query.method) {
    case "equal":
      return (query.values ?? []).includes(value);
    case "isNull":
      return value === null || value === undefined;
    case "limit":
    case "cursorAfter":
    case "select":
      return true;
    default:
      throw new Error(`fake db: unsupported query ${query.method}`);
  }
}

class FakeDb {
  readonly tables = new Map<string, Map<string, Row>>();
  /** Runs after each update, so a test can play a competing run. */
  afterUpdate: ((table: string, row: Row) => void) | null = null;
  /** Return true to fail that create (a transient error). */
  failCreate: ((table: string, data: Row) => boolean) | null = null;

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
    const at = clock.toISOString();
    this.table(name).set(row.$id, {
      $createdAt: at,
      $updatedAt: at,
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
    const parsed = queries.map((q) => JSON.parse(q) as ParsedQuery);
    if (parsed.some((q) => (q.values?.length ?? 0) > 100)) {
      return Promise.reject(new Error("Query values limit exceeded"));
    }
    let rows = [...this.table(table).values()].filter((row) =>
      parsed.every((q) => matches(row, q))
    );
    const total = rows.length;
    const cursor = parsed.find((q) => q.method === "cursorAfter");
    if (cursor) {
      const index = rows.findIndex((row) => row.$id === cursor.values?.[0]);
      rows = rows.slice(index + 1);
    }
    const limit = parsed.find((q) => q.method === "limit");
    rows = rows.slice(0, (limit?.values?.[0] as number | undefined) ?? 25);
    return Promise.resolve({
      rows: structuredClone(rows) as unknown as T[],
      total,
    });
  }

  createRow(
    _db: string,
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Row> {
    if (this.failCreate?.(table, { $id: id, ...data })) {
      return Promise.reject(new Error("Appwrite is down"));
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
    const written = structuredClone(row);
    this.afterUpdate?.(table, row);
    return Promise.resolve(written);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let db: FakeDb;
let pushTargets: Set<string>;
let smsSwitch: boolean;
/** User ids per push that went out (dispatch didn't throw). */
let pushed: string[][];

function deps() {
  return {
    db: db as unknown as TablesDB,
    isSmsEnabled: () => Promise.resolve(smsSwitch),
    messaging: {} as Messaging,
    now: () => clock,
    users: {
      get: ({ userId }: { userId: string }) =>
        Promise.resolve({
          targets: pushTargets.has(userId) ? [{ providerType: "push" }] : [],
        }),
    },
    webBase: "https://biso.test",
  };
}

function bus(id: string, name: string, outDepartsAt: string): void {
  db.seed(G, {
    $id: id,
    big_event_id: "be1",
    campus_id: "1",
    contact_name: null,
    contact_phone: null,
    home_departs_at: null,
    home_meeting_point: null,
    kind: "bus",
    name,
    out_departs_at: outDepartsAt,
    out_meeting_point: "Nydalen T",
    room_number: null,
  });
}

interface PersonFields {
  account?: { email?: string | null; locale?: "no" | "en" | null };
  bus?: string;
  phone?: string | null;
  push?: boolean;
  ticketEmail?: string | null;
}

/** A participant; `account` links them to a user, `push` gives it a device. */
function person(id: string, fields: PersonFields = {}): void {
  const userId = fields.account ? `u-${id}` : null;
  db.seed(P, {
    $id: id,
    big_event_id: "be1",
    campus_id: "1",
    first_name: `Name-${id}`,
    last_name: null,
    phone: fields.phone ?? null,
    ticket_email: fields.ticketEmail ?? null,
    user_id: userId,
  });
  if (userId) {
    db.seed("user", {
      $id: userId,
      email: fields.account?.email ?? null,
      locale: fields.account?.locale ?? null,
    });
    if (fields.push) {
      pushTargets.add(userId);
    }
  }
  if (fields.bus) {
    db.seed(GM, {
      $id: `seat-${id}`,
      big_event_id: "be1",
      group_id: fields.bus,
      leg: "out",
      participant_id: id,
    });
  }
}

function message(fields: Partial<BigEventMessageRow> = {}): void {
  db.seed(M, {
    $id: "m1",
    also_sms: false,
    audience: JSON.stringify({ type: "everyone" }),
    big_event_id: "be1",
    body_en: "Hi {first name}! {bus} leaves {departure}.",
    body_no: "Hei {fornavn}! {buss} går {avgang}.",
    campus_ids: [],
    email_count: 0,
    important: false,
    kind: "manual",
    leg: null,
    push_count: 0,
    recipients: 0,
    sent_at: null,
    sms_count: 0,
    status: "scheduled",
    title_en: "Your bus",
    title_no: "Bussen din",
    ...fields,
  } as Row);
}

/** Plays "Try again" (back to scheduled) or another run holding the message. */
function setStatus(status: "scheduled" | "sending"): void {
  const row = db.table(M).get("m1");
  if (row) {
    row.status = status;
  }
}

function messageRow(): BigEventMessageRow {
  return db.rows<BigEventMessageRow>(M)[0] as BigEventMessageRow;
}

function emailRows(): BigEventDeliveryRow[] {
  return db
    .rows<BigEventDeliveryRow>(D)
    .filter((row) => row.channel === "email");
}

function idsOf(rows: BigEventDeliveryRow[]): string[] {
  return rows.flatMap((row) => row.participant_ids ?? []).sort();
}

beforeEach(() => {
  clock = new Date("2027-01-10T12:00:00.000Z");
  db = new FakeDb();
  pushTargets = new Set();
  smsSwitch = false;
  pushed = [];
  dispatchAnnouncement.mockReset();
  dispatchAnnouncement.mockImplementation((announcement: Announcements) => {
    pushed.push(JSON.parse(announcement.audience_value ?? "[]"));
    return Promise.resolve({ recipients: 0 });
  });
  db.seed(E, {
    $id: "be1",
    campus_id: "1",
    ends_at: "2027-01-27T12:00:00.000Z",
    name_no: "Winter Games",
    slug: "winter-games",
    status: "published",
  });
  // Friday 22 January 2027, 14:00 and 15:00 in Oslo.
  bus("bus-1", "Buss 1", "2027-01-22T13:00:00.000Z");
  bus("bus-2", "Buss 2", "2027-01-22T14:00:00.000Z");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sendMessage", () => {
  it("a retried send pushes and emails nobody twice", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    person("p2", { account: { locale: "en" }, bus: "bus-1", push: true });
    person("p3", { account: {}, bus: "bus-2", push: true });
    person("p4", { bus: "bus-1", ticketEmail: "p4@example.com" });
    person("p5", { bus: "bus-2", ticketEmail: "p5@example.com" });
    person("p6", { account: { email: "p6@example.com" }, bus: "bus-2" });
    message();

    // Run 1: the second push fails.
    dispatchAnnouncement.mockImplementationOnce((a: Announcements) => {
      pushed.push(JSON.parse(a.audience_value ?? "[]"));
      return Promise.resolve({ recipients: 0 });
    });
    dispatchAnnouncement.mockImplementationOnce(() =>
      Promise.reject(new Error("push service down"))
    );
    await expect(sendMessage(deps(), "m1")).rejects.toThrow(
      "push service down"
    );
    expect(messageRow()).toMatchObject({ push_count: 2, status: "failed" });

    // "Try again"; run 2: the second email fails to queue.
    setStatus("scheduled");
    let emailCreates = 0;
    db.failCreate = (table) => table === D && ++emailCreates === 2;
    await expect(sendMessage(deps(), "m1")).rejects.toThrow();
    expect(messageRow().status).toBe("failed");

    // "Try again"; run 3 goes through.
    setStatus("scheduled");
    db.failCreate = null;
    const result = await sendMessage(deps(), "m1");

    expect(result).toEqual({
      counts: { email: 3, push: 3, recipients: 6, sms: 0 },
      ok: true,
    });
    expect(pushed.flat().sort()).toEqual(["u-p1", "u-p2", "u-p3"]);
    expect(idsOf(emailRows())).toEqual(["p4", "p5", "p6"]);
    expect(db.rows(R)).toHaveLength(6);
    expect(messageRow()).toMatchObject({
      email_count: 3,
      push_count: 3,
      recipients: 6,
      sent_at: clock.toISOString(),
      sms_count: 0,
      status: "sent",
    });
  });

  it("pushes group by identical text, at most 100 people per push", async () => {
    for (let index = 0; index < 230; index += 1) {
      person(`a${String(index).padStart(3, "0")}`, {
        account: { locale: index % 2 === 0 ? "no" : "en" },
        bus: "bus-1",
        push: true,
      });
    }
    for (const id of ["b1", "b2", "b3", "b4", "b5"]) {
      person(id, { account: { locale: "no" }, bus: "bus-2", push: true });
    }
    message();

    const result = await sendMessage(deps(), "m1");

    expect(result).toMatchObject({ counts: { push: 235, recipients: 235 } });
    expect(pushed.map((ids) => ids.length).sort((a, b) => a - b)).toEqual([
      5, 30, 100, 100,
    ]);
    const sent = dispatchAnnouncement.mock.calls.map(
      ([announcement]) => announcement as Announcements
    );
    // One text per bus, in both languages, without the first name.
    expect(new Set(sent.map((a) => a.body_no))).toEqual(
      new Set([
        "<p>Hei! Buss 1 går fre. 22. jan. kl. 14:00.</p>",
        "<p>Hei! Buss 2 går fre. 22. jan. kl. 15:00.</p>",
      ])
    );
    expect(sent.find((a) => a.body_no?.includes("Buss 2"))).toMatchObject({
      audience_type: "users",
      body_en: "<p>Hi! Buss 2 leaves Fri 22 Jan, 15:00.</p>",
      category: "trip",
      deep_link: "biso://big-event?slug=winter-games",
      push: true,
      source: "manual",
      status: "sent",
      title_en: "Your bus",
      title_no: "Bussen din",
    });
    expect(emailRows()).toHaveLength(0);
    // Every recipient row is stamped, with their details in both languages.
    const rows = db.rows<BigEventMessageRecipientRow>(R);
    expect(rows.every((row) => row.pushed_at && row.push)).toBe(true);
    const b1 = rows.find((row) => row.participant_id === "b1");
    expect(JSON.parse(b1?.vars ?? "null")).toMatchObject({
      en: { departure: "Fri 22 Jan, 15:00", first_name: "Name-b1" },
      no: { departure: "fre. 22. jan. kl. 15:00", first_name: "Name-b1" },
    });
  });

  it("important sends push and email", async () => {
    person("p-app", {
      account: { email: "app@example.com", locale: "no" },
      bus: "bus-1",
      push: true,
      ticketEmail: "ticket@example.com",
    });
    person("p-mail", { bus: "bus-1", ticketEmail: "mail@example.com" });
    message({ important: true, kind: "bus_moved" });

    const result = await sendMessage(deps(), "m1");

    expect(result).toEqual({
      counts: { email: 2, push: 1, recipients: 2, sms: 0 },
      ok: true,
    });
    expect(pushed).toEqual([["u-p-app"]]);
    expect(dispatchAnnouncement.mock.calls[0]?.[0]).toMatchObject({
      category: "urgent",
      source: "auto",
    });
    expect(
      emailRows()
        .map((row) => [row.to_address, row.participant_ids])
        .sort()
    ).toEqual([
      ["mail@example.com", ["p-mail"]],
      ["ticket@example.com", ["p-app"]],
    ]);
    expect(emailRows()[0]).toMatchObject({
      big_event_id: "be1",
      kind: "message",
      message_id: "m1",
      status: "pending",
    });
  });

  it("a sent message can't be sent again", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    message({ status: "sent" });
    expect(await sendMessage(deps(), "m1")).toEqual({
      error: "already_sent",
      ok: false,
    });
    expect(await sendMessage(deps(), "nope")).toEqual({
      error: "not_found",
      ok: false,
    });

    // Another run is sending it: left alone until it has been quiet 10 minutes.
    setStatus("sending");
    clock = new Date(clock.getTime() + 9 * MINUTE);
    expect(await sendMessage(deps(), "m1")).toEqual({
      error: "busy",
      ok: false,
    });
    clock = new Date(clock.getTime() + 2 * MINUTE);
    expect(await sendMessage(deps(), "m1")).toMatchObject({ ok: true });
    expect(await sendMessage(deps(), "m1")).toEqual({
      error: "already_sent",
      ok: false,
    });
    expect(pushed).toEqual([["u-p1"]]);
  });

  it("a run that loses the claim sends nothing", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    message();
    // Another run claims it right after this one, before the read-back.
    db.afterUpdate = (table, row) => {
      if (table === M && row.status === "sending") {
        row.sent_at = new Date(clock.getTime() + 1).toISOString();
        db.afterUpdate = null;
      }
    };

    expect(await sendMessage(deps(), "m1")).toEqual({
      error: "busy",
      ok: false,
    });
    expect(pushed).toEqual([]);
    expect(db.rows(R)).toHaveLength(0);
    expect(messageRow().status).toBe("sending");
  });

  it("sms rows only when the switch is on", async () => {
    person("p1", {
      account: { locale: "no" },
      bus: "bus-1",
      phone: "912 34 567",
      push: true,
    });
    person("p2", { bus: "bus-1", phone: null, ticketEmail: "p2@example.com" });
    message({ also_sms: true });

    await sendMessage(deps(), "m1");
    expect(db.rows<BigEventDeliveryRow>(D).map((r) => r.channel)).toEqual([
      "email",
    ]);

    smsSwitch = true;
    setStatus("scheduled");
    const result = await sendMessage(deps(), "m1");
    expect(result).toMatchObject({ counts: { sms: 1 } });
    const sms = db
      .rows<BigEventDeliveryRow>(D)
      .filter((row) => row.channel === "sms");
    expect(sms).toEqual([
      expect.objectContaining({
        kind: "message",
        message_id: "m1",
        participant_ids: ["p1"],
        status: "pending",
        to_address: "+4791234567",
      }),
    ]);
  });

  it("one email to a shared address when the text is the same", async () => {
    person("p1", { bus: "bus-1", ticketEmail: "Family@example.com" });
    person("p2", { bus: "bus-1", ticketEmail: "family@example.com " });
    person("p3", { bus: "bus-2", ticketEmail: "family@example.com" });
    person("p4", { bus: "bus-1", ticketEmail: "other@example.com" });
    message({
      body_en: "{bus} leaves {departure}.",
      body_no: "{buss} går {avgang}.",
    });

    await sendMessage(deps(), "m1");

    expect(
      emailRows()
        .map((row) => row.participant_ids)
        .sort()
    ).toEqual([["p1", "p2"], ["p3"], ["p4"]]);
  });

  it("the first name keeps shared-address emails apart", async () => {
    person("p1", { bus: "bus-1", ticketEmail: "family@example.com" });
    person("p2", { bus: "bus-1", ticketEmail: "family@example.com" });
    message();

    await sendMessage(deps(), "m1");

    expect(
      emailRows()
        .map((row) => row.participant_ids)
        .sort()
    ).toEqual([["p1"], ["p2"]]);
  });

  it("pushes group by the trip home too, still without the first name", async () => {
    for (const id of ["p1", "p2", "p3"]) {
      person(id, { account: { locale: "no" }, bus: "bus-1", push: true });
    }
    const home = (id: string, busId: string) =>
      db.seed(GM, {
        $id: `home-${id}`,
        big_event_id: "be1",
        group_id: busId,
        leg: "home",
        participant_id: id,
      });
    home("p1", "bus-1");
    home("p2", "bus-2");
    home("p3", "bus-2");
    message({
      body_en: "Hi {first name}! {bus}. {trip home}",
      body_no: "Hei {fornavn}! {buss}. {hjemreise}",
      leg: "out",
    });

    await sendMessage(deps(), "m1");

    const sent = dispatchAnnouncement.mock.calls.map(
      ([announcement]) => announcement as Announcements
    );
    expect(
      sent.map((a) => [a.body_no, JSON.parse(a.audience_value ?? "[]")])
    ).toEqual([
      ["<p>Hei! Buss 1.</p>", ["u-p1"]],
      ["<p>Hei! Buss 1. Hjem: Buss 2.</p>", ["u-p2", "u-p3"]],
    ]);
  });

  it("the app gets the push text as HTML that keeps its line breaks", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    message({
      body_en: "Hi {first name}!\nLine two\n\nTom & <Jerry> \"x\" 'y'",
      body_no: "Hei {fornavn}!\r\nLinje to\n \nAvsnitt",
    });

    await sendMessage(deps(), "m1");

    const [announcement] = dispatchAnnouncement.mock.calls.map(
      ([row]) => row as Announcements
    );
    expect(announcement).toMatchObject({
      body_en:
        "<p>Hi!<br>Line two</p><p>Tom &amp; &lt;Jerry&gt; &quot;x&quot; &#39;y&#39;</p>",
      body_no: "<p>Hei!<br>Linje to</p><p>Avsnitt</p>",
    });
    // The push itself is clean text.
    expect(localizedPushContent(announcement as Announcements).en.body).toBe(
      "Hi! Line two Tom & <Jerry> \"x\" 'y'"
    );
    expect(localizedPushContent(announcement as Announcements).no.body).toBe(
      "Hei! Linje to Avsnitt"
    );
  });

  it("push groups go out four at a time", async () => {
    for (let index = 3; index <= 8; index += 1) {
      bus(`bus-${index}`, `Buss ${index}`, "2027-01-22T13:00:00.000Z");
      person(`p${index}`, {
        account: { locale: "no" },
        bus: `bus-${index}`,
        push: true,
      });
    }
    message({ body_en: "{bus}", body_no: "{buss}" });
    let inFlight = 0;
    let most = 0;
    dispatchAnnouncement.mockImplementation(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { recipients: 1 };
    });

    const result = await sendMessage(deps(), "m1");

    expect(result).toMatchObject({ counts: { push: 6 }, ok: true });
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(6);
    expect(most).toBe(4);
    expect(
      db.rows<BigEventMessageRecipientRow>(R).every((row) => row.pushed_at)
    ).toBe(true);
  });

  it("a failed push stops the pushes: nothing starts after it (R39)", async () => {
    for (let index = 3; index <= 8; index += 1) {
      bus(`bus-${index}`, `Buss ${index}`, "2027-01-22T13:00:00.000Z");
      person(`p${index}`, {
        account: { locale: "no" },
        bus: `bus-${index}`,
        push: true,
      });
    }
    message({ body_en: "{bus}", body_no: "{buss}" });
    const events: string[] = [];
    let calls = 0;
    let inFlight = 0;
    // The first push fails quickly; the other three in flight finish later.
    dispatchAnnouncement.mockImplementation(async () => {
      calls += 1;
      const call = calls;
      events.push(`start ${call}`);
      inFlight += 1;
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, call === 1 ? 5 : 20)
        );
        if (call === 1) {
          events.push("rejected");
          throw new Error("push service down");
        }
        return { recipients: 1 };
      } finally {
        inFlight -= 1;
      }
    });
    db.afterUpdate = (table, row) => {
      if (table === M) {
        events.push(row.status === "failed" ? "marked failed" : "progress");
      }
    };

    const outcome = await sendMessage(deps(), "m1").then(
      () => ({ inFlight, rejected: false }),
      () => ({ inFlight, rejected: true })
    );

    // It fails only once the pushes already going have finished.
    expect(outcome).toEqual({ inFlight: 0, rejected: true });
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(4);
    const after = events.slice(events.indexOf("rejected") + 1);
    expect(after.some((event) => event.startsWith("start"))).toBe(false);
    // No progress is written after the failure, only the failed mark.
    expect(after).toEqual(["marked failed"]);
    // The failed mark counts the three pushes that went out.
    expect(messageRow()).toMatchObject({ push_count: 3, status: "failed" });
    // The three that went out are stamped, so "Try again" skips them.
    expect(
      db
        .rows<BigEventMessageRecipientRow>(R)
        .filter((row) => row.pushed_at !== null)
    ).toHaveLength(3);
  });

  it("a push that fails leaves its announcement marked failed", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    message();
    dispatchAnnouncement.mockImplementationOnce(() =>
      Promise.reject(new Error("push service down"))
    );

    await expect(sendMessage(deps(), "m1")).rejects.toThrow(
      "push service down"
    );

    expect(db.rows<Row>("announcements").map((row) => row.status)).toEqual([
      "failed",
    ]);
  });

  it("a send already claimed by the caller goes on from that claim", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    const claimedAt = new Date(clock.getTime() - 1000).toISOString();
    message({ sent_at: claimedAt, status: "sending" });

    // Someone else's claim is left alone.
    expect(
      await sendMessage(deps(), "m1", {
        claimedAt: new Date(clock.getTime() - 2000).toISOString(),
      })
    ).toEqual({ error: "busy", ok: false });
    expect(await sendMessage(deps(), "m1")).toEqual({
      error: "busy",
      ok: false,
    });
    expect(pushed).toEqual([]);

    const result = await sendMessage(deps(), "m1", { claimedAt });

    expect(result).toMatchObject({ counts: { push: 1 }, ok: true });
    expect(messageRow().status).toBe("sent");
    expect(
      await sendMessage(deps(), "m1", { claimedAt: clock.toISOString() })
    ).toEqual({ error: "already_sent", ok: false });
  });

  it("only a recently failed automatic message is claimed again (R33)", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    const failed = (fields: Partial<BigEventMessageRow>) => {
      db.table(M).clear();
      message({
        $updatedAt: new Date(clock.getTime() - 11 * MINUTE).toISOString(),
        kind: "bus_assigned",
        scheduled_at: new Date(clock.getTime() - 30 * MINUTE).toISOString(),
        status: "failed",
        ...fields,
      });
    };
    const busy = { error: "busy", ok: false };

    failed({ kind: "manual" });
    expect(await sendMessage(deps(), "m1")).toEqual(busy);
    failed({
      $updatedAt: new Date(clock.getTime() - 5 * MINUTE).toISOString(),
    });
    expect(await sendMessage(deps(), "m1")).toEqual(busy);
    failed({
      scheduled_at: new Date(clock.getTime() - 121 * MINUTE).toISOString(),
    });
    expect(await sendMessage(deps(), "m1")).toEqual(busy);
    expect(pushed).toEqual([]);

    failed({});
    expect(await sendMessage(deps(), "m1")).toMatchObject({ ok: true });
    expect(pushed).toEqual([["u-p1"]]);
  });

  it("the audience and the details use one leg", async () => {
    person("p-out", { bus: "bus-1", ticketEmail: "out@example.com" });
    person("p-home", { ticketEmail: "home@example.com" });
    db.seed(GM, {
      $id: "seat-p-home-home",
      big_event_id: "be1",
      group_id: "bus-1",
      leg: "home",
      participant_id: "p-home",
    });
    const bus1 = db.table(G).get("bus-1");
    if (bus1) {
      bus1.home_meeting_point = "Hotellet";
    }
    // The leg is on the audience only.
    message({
      audience: JSON.stringify({
        groupIds: ["bus-1"],
        leg: "home",
        type: "groups",
      }),
      leg: null,
    });

    await sendMessage(deps(), "m1");

    const rows = db.rows<BigEventMessageRecipientRow>(R);
    expect(rows.map((row) => row.participant_id)).toEqual(["p-home"]);
    expect(JSON.parse(rows[0]?.vars ?? "null")).toMatchObject({
      no: { bus: "Buss 1", meeting_point: "Hotellet" },
    });

    // The leg is on the message only.
    db.table(M).clear();
    db.table(R).clear();
    db.table(D).clear();
    message({
      audience: JSON.stringify({ groupIds: ["bus-1"], type: "groups" }),
      leg: "home",
    });

    await sendMessage(deps(), "m1");

    expect(
      db.rows<BigEventMessageRecipientRow>(R).map((row) => row.participant_id)
    ).toEqual(["p-home"]);
  });

  it("pushes that differ only in English stay apart", async () => {
    person("p1", { account: { locale: "no" }, bus: "bus-1", push: true });
    person("p2", { account: { locale: "no" }, bus: "bus-2", push: true });
    message({ body_en: "{bus} leaves soon.", body_no: "Bussen går snart." });

    await sendMessage(deps(), "m1");

    expect(pushed).toEqual([["u-p1"], ["u-p2"]]);
  });

  it("someone already pushed isn't emailed on a retry", async () => {
    person("p1", {
      account: { locale: "no" },
      bus: "bus-1",
      push: true,
      ticketEmail: "p1@example.com",
    });
    person("p2", { bus: "bus-1", ticketEmail: "p2@example.com" });
    message();
    db.failCreate = (table) => table === D;
    await expect(sendMessage(deps(), "m1")).rejects.toThrow();

    // The app was removed before "Try again": the push is out already.
    pushTargets.clear();
    db.failCreate = null;
    setStatus("scheduled");
    const result = await sendMessage(deps(), "m1");

    expect(pushed).toEqual([["u-p1"]]);
    expect(idsOf(emailRows())).toEqual(["p2"]);
    expect(result).toMatchObject({ counts: { email: 1, push: 1 } });
  });

  it("reaches only the message's campuses, with the bus for its leg", async () => {
    person("p-oslo", { bus: "bus-1", ticketEmail: "oslo@example.com" });
    db.seed(GM, {
      $id: "seat-p-oslo-home",
      big_event_id: "be1",
      group_id: "bus-2",
      leg: "home",
      participant_id: "p-oslo",
    });
    person("p-bergen", { ticketEmail: "bergen@example.com" });
    const bergen = db.table(P).get("p-bergen");
    if (bergen) {
      bergen.campus_id = "2";
    }
    message({ campus_ids: ["1"], leg: "home" });

    const result = await sendMessage(deps(), "m1");

    expect(result).toMatchObject({ counts: { email: 1, recipients: 1 } });
    const [row] = db.rows<BigEventMessageRecipientRow>(R);
    expect(row?.participant_id).toBe("p-oslo");
    expect(JSON.parse(row?.vars ?? "null")).toMatchObject({
      en: { bus: "Buss 2" },
      no: { bus: "Buss 2" },
    });
  });
});
