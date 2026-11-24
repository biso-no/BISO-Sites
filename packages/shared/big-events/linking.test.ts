import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkingDb } from "./linking";
import type { BigEventParticipantRow } from "./types";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown> & { $id: string };
interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

const tables = new Map<string, Row[]>();

function parse(queries: string[] = []): ParsedQuery[] {
  return queries.map((query) => JSON.parse(query) as ParsedQuery);
}

/** Honours `equal`, `notEqual`, `isNull`, `isNotNull` and `limit`. */
function matches(row: Row, query: ParsedQuery): boolean {
  const value = row[query.attribute ?? ""] ?? null;
  switch (query.method) {
    case "equal":
      return (query.values ?? []).includes(value);
    case "notEqual":
      return !(query.values ?? []).includes(value);
    case "isNull":
      return value === null;
    case "isNotNull":
      return value !== null;
    default:
      return true;
  }
}

const db = {
  listRows: vi.fn(
    (_databaseId: string, tableId: string, queries: string[] = []) => {
      const parsed = parse(queries);
      const limit = parsed.find((query) => query.method === "limit");
      const found = (tables.get(tableId) ?? []).filter((row) =>
        parsed.every((query) => matches(row, query))
      );
      const rows = limit ? found.slice(0, Number(limit.values?.[0])) : found;
      return Promise.resolve({ rows, total: found.length });
    }
  ),
  updateRow: vi.fn(
    (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown> = {}
    ) => {
      const row = (tables.get(tableId) ?? []).find(
        (candidate) => candidate.$id === rowId
      );
      if (!row) {
        return Promise.reject(new Error("Row not found"));
      }
      Object.assign(row, data);
      return Promise.resolve(row);
    }
  ),
};

const { findBiLinkedAccountsByEmail, linkParticipant, unlinkParticipant } =
  await import("./linking");
/** The fake's rows are plain records; the module reads them as table rows. */
const linkingDb = db as unknown as LinkingDb;

function participant(
  overrides: Partial<BigEventParticipantRow> = {}
): BigEventParticipantRow {
  return {
    $collectionId: "big_event_participants",
    $createdAt: "",
    $databaseId: "app",
    $id: "p1",
    $permissions: [],
    $sequence: 1,
    $tableId: "big_event_participants",
    $updatedAt: "",
    big_event_id: "b1",
    campus_id: "2",
    connect_nonce: null,
    connect_reminded_at: null,
    connect_sent_at: null,
    connect_token_hash: null,
    dismissed_user_id: null,
    first_name: "Kari",
    last_import_id: null,
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
    room_size: null,
    suggested_reason: "phone",
    suggested_user_id: "u-bi",
    ticket_category: null,
    ticket_email: "kari@example.com",
    ticket_ref: null,
    user_id: null,
    ...overrides,
  } as BigEventParticipantRow;
}

function seed(rows: BigEventParticipantRow[]): void {
  tables.set(
    "big_event_participants",
    rows.map((row) => ({ ...row }) as unknown as Row)
  );
}

const now = new Date("2026-12-01T10:00:00.000Z");

beforeEach(() => {
  db.listRows.mockClear();
  db.updateRow.mockClear();
  tables.clear();
  tables.set("user", [
    { $id: "u-bi", email: "kari@bi.no", student_id: "1234567" },
    { $id: "u-gmail", email: "kari@gmail.com", student_id: null },
    { $id: "u-blank", email: "blank@bi.no", student_id: "  " },
    { $id: "u-other", email: "ola@bi.no", student_id: "7654321" },
  ]);
});

describe("linkParticipant", () => {
  it("refuses an account without BI", async () => {
    seed([participant()]);
    for (const userId of ["u-gmail", "u-blank", "u-missing"]) {
      const result = await linkParticipant(linkingDb, {
        method: "manual",
        participant: participant(),
        userId,
        now,
      });
      expect(result).toEqual({ ok: false, reason: "not_bi_linked" });
    }
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("refuses a ticket linked to someone else", async () => {
    const linked = participant({ user_id: "u-other" });
    seed([linked]);
    const result = await linkParticipant(linkingDb, {
      method: "connect",
      participant: linked,
      userId: "u-bi",
      now,
    });
    expect(result).toEqual({ ok: false, reason: "linked_to_other" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("refuses a second ticket for the same account in one big event", async () => {
    const first = participant({ $id: "p0", user_id: "u-bi" });
    const second = participant({ $id: "p1", first_name: "Ola" });
    const elsewhere = participant({
      $id: "p9",
      big_event_id: "b2",
      user_id: "u-other",
    });
    seed([first, second, elsewhere]);

    const refused = await linkParticipant(linkingDb, {
      method: "manual",
      participant: second,
      userId: "u-bi",
      now,
    });
    expect(refused).toEqual({ ok: false, reason: "account_has_ticket" });

    // A ticket in another big event doesn't count.
    const allowed = await linkParticipant(linkingDb, {
      method: "manual",
      participant: second,
      userId: "u-other",
      now,
    });
    expect(allowed).toEqual({ ok: true });
  });

  it("linking the same account twice is fine", async () => {
    const linked = participant({ user_id: "u-bi" });
    seed([linked]);
    const result = await linkParticipant(linkingDb, {
      method: "connect",
      participant: linked,
      userId: "u-bi",
      now,
    });
    expect(result).toEqual({ ok: true });
  });

  it("writes the link and clears the suggestion", async () => {
    seed([participant()]);
    const result = await linkParticipant(linkingDb, {
      method: "email",
      participant: participant(),
      userId: "u-bi",
      now,
    });
    expect(result).toEqual({ ok: true });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "big_event_participants",
      "p1",
      {
        link_method: "email",
        linked_at: now.toISOString(),
        suggested_reason: null,
        suggested_user_id: null,
        user_id: "u-bi",
      }
    );
  });
});

describe("unlinkParticipant", () => {
  it("clears the link, the old account's membership and the old connect link", async () => {
    seed([
      participant({
        connect_nonce: "nonce",
        connect_token_hash: "hash",
        link_method: "manual",
        linked_at: now.toISOString(),
        membership_checked_at: now.toISOString(),
        membership_valid: true,
        user_id: "u-bi",
      }),
    ]);
    await unlinkParticipant(linkingDb, "p1");
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "big_event_participants",
      "p1",
      {
        // The link in emails already sent stops working (ruling R36); the
        // next send makes a new one.
        connect_nonce: null,
        connect_token_hash: null,
        link_method: null,
        linked_at: null,
        membership_checked_at: null,
        membership_valid: null,
        user_id: null,
      }
    );
  });
});

describe("findBiLinkedAccountsByEmail", () => {
  it("findBiLinkedAccountsByEmail ignores accounts without a student number", async () => {
    const found = await findBiLinkedAccountsByEmail(linkingDb, [
      "Kari@BI.no",
      "kari@gmail.com",
      "blank@bi.no",
      "nobody@bi.no",
    ]);
    expect([...found.entries()]).toEqual([["kari@bi.no", "u-bi"]]);
  });

  it("asks in chunks of 100 addresses", async () => {
    const emails = Array.from(
      { length: 150 },
      (_, index) => `person${index}@bi.no`
    );
    await findBiLinkedAccountsByEmail(linkingDb, emails);
    const sizes = db.listRows.mock.calls.map((call) => {
      const equal = parse(call[2]).find(
        (query) => query.method === "equal" && query.attribute === "email"
      );
      return equal?.values?.length;
    });
    expect(sizes).toEqual([100, 50]);
  });

  it("asks nothing for an empty list", async () => {
    expect((await findBiLinkedAccountsByEmail(linkingDb, [])).size).toBe(0);
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
