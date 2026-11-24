import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveConnectToken,
  hashConnectToken,
} from "@repo/shared/big-events/connect-token";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { codeOnly } from "@/test/source";

type Row = Record<string, unknown> & { $id: string };
interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

const tables = vi.hoisted(() => new Map<string, Row[]>());
const pendingAfter = vi.hoisted(() => [] as Promise<unknown>[]);
const getLoggedInUser = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

function parse(queries: string[] = []): ParsedQuery[] {
  return queries.map((query) => JSON.parse(query) as ParsedQuery);
}

/** Honours `equal`, `isNull` and `limit`; other queries match everything. */
function matches(row: Row, query: ParsedQuery): boolean {
  const value = row[query.attribute ?? ""] ?? null;
  if (query.method === "equal") {
    return (query.values ?? []).includes(value);
  }
  if (query.method === "isNull") {
    return value === null;
  }
  return true;
}

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));
vi.mock("@/lib/actions/user", () => ({ getLoggedInUser }));
vi.mock("@/app/actions/locale", () => ({ getLocale: vi.fn(async () => "en") }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    pendingAfter.push(Promise.resolve().then(task));
  },
}));

const { connectTicket, requestConnectLink } = await import(
  "./big-event-connect"
);
const { resolveConnectToken } = await import("@/lib/big-events/connect");

const SECRET = "test-connect-secret";
const API_BASE = "https://api.example.test";
const CRON_SECRET = "cron-secret";
const DAY_MS = 86_400_000;

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
vi.stubGlobal("fetch", fetchMock);

function tokenFor(participantId: string): string {
  return deriveConnectToken(SECRET, participantId, `nonce-${participantId}`);
}

function bigEvent(id: string, overrides: Partial<Row> = {}): Row {
  return {
    $id: id,
    ends_at: new Date(Date.now() + 10 * DAY_MS).toISOString(),
    name_en: "Winter Games",
    name_no: "Vinterlekene",
    slug: "winter-games",
    status: "published",
    ...overrides,
  };
}

function participant(id: string, overrides: Partial<Row> = {}): Row {
  return {
    $id: id,
    big_event_id: "live",
    connect_token_hash: hashConnectToken(tokenFor(id)),
    first_name: "Ola",
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    ticket_email: "ola@example.com",
    user_id: null,
    ...overrides,
  };
}

function rows(table: string): Row[] {
  return tables.get(table) ?? [];
}

function signInAs(userId: string, studentId: string | null) {
  getLoggedInUser.mockResolvedValue({
    profile: { $id: userId, student_id: studentId },
    user: { $id: userId, email: `${userId}@bi.no` },
  });
}

async function flushAfter() {
  await Promise.all(pendingAfter.splice(0));
}

beforeEach(() => {
  tables.clear();
  pendingAfter.length = 0;
  getLoggedInUser.mockReset();
  getLoggedInUser.mockResolvedValue(null);
  revalidatePath.mockReset();
  fetchMock.mockClear();
  process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE;
  process.env.CRON_SECRET = CRON_SECRET;
  db.createRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();

  db.listRows.mockImplementation(
    (_databaseId: string, tableId: string, queries: string[] = []) => {
      const parsed = parse(queries);
      const limit = parsed.find((query) => query.method === "limit");
      const found = rows(tableId).filter((row) =>
        parsed.every((query) => matches(row, query))
      );
      const page = limit ? found.slice(0, Number(limit.values?.[0])) : found;
      return Promise.resolve({ rows: page, total: found.length });
    }
  );
  db.updateRow.mockImplementation(
    (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown> = {}
    ) => {
      const row = rows(tableId).find((candidate) => candidate.$id === rowId);
      if (!row) {
        return Promise.reject(new Error("Row not found"));
      }
      Object.assign(row, data);
      return Promise.resolve(row);
    }
  );
  db.createRow.mockImplementation(
    (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      const row = { ...data, $id: rowId };
      tables.set(tableId, [...rows(tableId), row]);
      return Promise.resolve(row);
    }
  );

  tables.set("big_events", [
    bigEvent("live"),
    bigEvent("draft", { status: "draft" }),
    bigEvent("ended", { ends_at: new Date(Date.now() - DAY_MS).toISOString() }),
  ]);
  tables.set("big_event_participants", [
    participant("p-live"),
    participant("p-draft", { big_event_id: "draft" }),
    participant("p-ended", { big_event_id: "ended" }),
  ]);
  tables.set("user", [
    { $id: "u-bi", email: "u-bi@bi.no", student_id: "1234567" },
    { $id: "u-other", email: "u-other@bi.no", student_id: "7654321" },
    { $id: "u-gmail", email: "u-gmail@gmail.com", student_id: null },
  ]);
  tables.set("big_event_deliveries", []);
});

describe("resolveConnectToken", () => {
  it("an unknown token is invalid", async () => {
    await expect(resolveConnectToken(tokenFor("nobody"))).resolves.toEqual({
      state: "invalid",
    });
    await expect(resolveConnectToken("not a token")).resolves.toEqual({
      state: "invalid",
    });
  });

  it("a draft big event's token is invalid", async () => {
    signInAs("u-bi", "1234567");
    await expect(resolveConnectToken(tokenFor("p-draft"))).resolves.toEqual({
      state: "invalid",
    });
  });

  it("an ended big event's token is ended", async () => {
    signInAs("u-bi", "1234567");
    await expect(resolveConnectToken(tokenFor("p-ended"))).resolves.toEqual({
      state: "ended",
    });
  });

  it("asks a signed-out visitor to sign in", async () => {
    await expect(resolveConnectToken(tokenFor("p-live"))).resolves.toEqual({
      eventName: "Winter Games",
      state: "signed_out",
    });
  });

  it("asks an account without BI to sign in with BI", async () => {
    signInAs("u-gmail", null);
    await expect(resolveConnectToken(tokenFor("p-live"))).resolves.toEqual({
      eventName: "Winter Games",
      state: "needs_bi",
    });
  });

  it("asks a BI account to confirm, and links nothing on the way", async () => {
    signInAs("u-bi", "1234567");
    await expect(resolveConnectToken(tokenFor("p-live"))).resolves.toEqual({
      accountEmail: "u-bi@bi.no",
      eventName: "Winter Games",
      holderName: "Ola Nordmann",
      state: "confirm",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("opens the event for the account the ticket is linked to", async () => {
    signInAs("u-bi", "1234567");
    Object.assign(rows("big_event_participants")[0] ?? {}, {
      user_id: "u-bi",
    });
    await expect(resolveConnectToken(tokenFor("p-live"))).resolves.toEqual({
      eventName: "Winter Games",
      slug: "winter-games",
      state: "connected",
    });
  });

  it("says when the account already holds another ticket for the event", async () => {
    signInAs("u-bi", "1234567");
    rows("big_event_participants").push(
      participant("p-mine", { user_id: "u-bi" })
    );
    await expect(resolveConnectToken(tokenFor("p-live"))).resolves.toEqual({
      eventName: "Winter Games",
      state: "account_has_ticket",
    });
  });
});

describe("connectTicket", () => {
  it("does not link without a signed-in BI account", async () => {
    await expect(connectTicket(tokenFor("p-live"))).resolves.toEqual({
      ok: false,
      reason: "not_bi_linked",
    });

    signInAs("u-gmail", null);
    await expect(connectTicket(tokenFor("p-live"))).resolves.toEqual({
      ok: false,
      reason: "not_bi_linked",
    });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(rows("big_event_participants")[0]?.user_id).toBeNull();
  });

  it("links on confirm", async () => {
    signInAs("u-bi", "1234567");
    const token = tokenFor("p-live");

    await expect(connectTicket(token)).resolves.toEqual({ ok: true });

    expect(rows("big_event_participants")[0]).toMatchObject({
      link_method: "connect",
      user_id: "u-bi",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/connect/${token}`);
  });

  it("reports a ticket linked to someone else", async () => {
    Object.assign(rows("big_event_participants")[0] ?? {}, {
      user_id: "u-other",
    });
    signInAs("u-bi", "1234567");

    await expect(connectTicket(tokenFor("p-live"))).resolves.toEqual({
      ok: false,
      reason: "linked_to_other",
    });
    expect(rows("big_event_participants")[0]?.user_id).toBe("u-other");
  });

  it("refuses an ended big event's link", async () => {
    signInAs("u-bi", "1234567");
    await expect(connectTicket(tokenFor("p-ended"))).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("requestConnectLink", () => {
  it("help answers the same whether or not the address exists", async () => {
    await expect(requestConnectLink("  Ola@Example.com ")).resolves.toEqual({
      ok: true,
    });
    await flushAfter();

    // One email to the address, for the live big event only.
    expect(rows("big_event_deliveries")).toEqual([
      expect.objectContaining({
        big_event_id: "live",
        kind: "connect",
        participant_ids: ["p-live"],
        status: "pending",
        to_address: "ola@example.com",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/cron/big-event-deliveries`,
      expect.objectContaining({
        headers: expect.objectContaining({ "x-cron-secret": CRON_SECRET }),
        method: "POST",
      })
    );

    fetchMock.mockClear();
    await expect(requestConnectLink("nobody@example.com")).resolves.toEqual({
      ok: true,
    });
    await expect(requestConnectLink("not an email")).resolves.toEqual({
      ok: true,
    });
    await flushAfter();
    expect(rows("big_event_deliveries")).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("help is rate limited per address", async () => {
    rows("big_event_participants").push(
      participant("p-kari", { ticket_email: "kari@example.com" })
    );
    const ADDRESS_LIMIT = 3;

    for (const typed of [
      "kari@example.com",
      "KARI@example.com",
      " kari@example.com",
      "Kari@Example.com",
    ]) {
      await expect(requestConnectLink(typed)).resolves.toEqual({ ok: true });
      await flushAfter();
      // Each email goes out before the next request, so only the limit stops a new one.
      for (const delivery of rows("big_event_deliveries")) {
        delivery.status = "sent";
      }
    }

    expect(rows("big_event_deliveries")).toHaveLength(ADDRESS_LIMIT);
  });
});

describe("the connected state", () => {
  it("has no app link until the app knows big events", () => {
    // Ruling R32: /app/big-events/<slug> 404s on the web until Stage 4, and
    // released apps ignore /app/ paths they don't know. Store buttons only.
    const states = codeOnly(
      readFileSync(
        join(
          import.meta.dirname,
          "../(public)/connect/[token]/connect-states.tsx"
        ),
        "utf8"
      )
    );
    expect(states).not.toContain("/app/big-events");
    expect(states).not.toContain("openApp");
    expect(states).toContain("<AppStoreBadge");
  });
});
