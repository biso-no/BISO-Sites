/**
 * Test harness.
 *
 * A fake `BackendClients` backed by in-memory tables, plus builders for
 * principals and a server wired to it. Provider calls are mocked by default in
 * every test in this package; nothing here can reach a real Appwrite instance.
 *
 * The fake implements enough of the Appwrite query language to make the
 * authorization tests meaningful — in particular `Query.equal` on the scope
 * columns, so a test can assert that a department member's query genuinely
 * excludes another department's rows rather than asserting that the right
 * filter string was built. A test that only checked the filter string would
 * pass even if the filter were never applied.
 */

import type { AppwriteClients } from "@repo/api/runtime";
import type { BackendClients } from "../appwrite/clients";
import type { Principal } from "../identity/principal";
import { ANONYMOUS_PRINCIPAL } from "../identity/principal";
import { unavailable } from "../runtime/errors";
import { createLogger, type Logger } from "../runtime/logger";

export interface FakeRow extends Record<string, unknown> {
  $createdAt?: string;
  $id: string;
  $updatedAt?: string;
}

export interface FakeTables {
  [table: string]: FakeRow[];
}

/** A parsed Appwrite query string. */
interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

function parseQuery(raw: string): ParsedQuery | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const q = parsed as {
        method?: string;
        attribute?: string;
        values?: unknown[];
      };
      return q.method
        ? { method: q.method, attribute: q.attribute, values: q.values }
        : null;
    }
  } catch {
    // Appwrite query strings are JSON; anything else is ignored rather than
    // failing the fake, so an unrecognised helper does not break a test.
  }
  return null;
}

/** Read a possibly-nested attribute, so `campus.$id` works like Appwrite's. */
function readAttribute(row: FakeRow, path: string): unknown {
  if (path in row) {
    return row[path];
  }
  const parts = path.split(".");
  let value: unknown = row;
  for (const part of parts) {
    if (value === null || typeof value !== "object") {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function matches(row: FakeRow, query: ParsedQuery): boolean {
  const { method, attribute, values } = query;
  if (!attribute) {
    return true;
  }
  const actual = readAttribute(row, attribute);

  // `isNull`/`isNotNull` carry no `values`. Requiring `values` before the
  // switch made them — and so any `or` containing one — match every row, which
  // is how a filter can silently disappear from a test.
  if (method === "isNull") {
    return actual === null || actual === undefined;
  }
  if (method === "isNotNull") {
    return actual !== null && actual !== undefined;
  }
  if (!values) {
    return true;
  }

  switch (method) {
    case "equal":
      return values.some((value) => {
        if (Array.isArray(actual)) {
          return actual.includes(value);
        }
        return actual === value;
      });
    case "notEqual":
      return !values.includes(actual);
    case "contains":
      return (
        typeof actual === "string" &&
        values.some(
          (value) =>
            typeof value === "string" &&
            actual.toLowerCase().includes(value.toLowerCase())
        )
      );
    case "search":
      return (
        typeof actual === "string" &&
        values.some(
          (value) =>
            typeof value === "string" &&
            actual.toLowerCase().includes(value.toLowerCase())
        )
      );
    case "greaterThanEqual":
      return (
        typeof actual === "string" &&
        typeof values[0] === "string" &&
        actual >= values[0]
      );
    case "lessThanEqual":
      return (
        typeof actual === "string" &&
        typeof values[0] === "string" &&
        actual <= values[0]
      );
    default:
      // Unknown filters are treated as no-ops. `or` is handled separately.
      return true;
  }
}

/**
 * Coerce one nested member of an `or`/`and` into a parsed query.
 *
 * `Query.or` nests **objects**, not JSON strings — `{"method":"or","values":[
 * {"method":"isNull",…}, …]}`. An earlier version of this fake only handled
 * the string form, so every object-nested `or` fell through to "match
 * everything", quietly turning any test that relied on one into a no-op.
 * Both shapes are accepted now, and anything else throws rather than matching,
 * because a filter this fake cannot express must fail a test rather than
 * silently widen its result set.
 */
function coerceNested(value: unknown): ParsedQuery {
  if (typeof value === "string") {
    const parsed = parseQuery(value);
    if (parsed) {
      return parsed;
    }
  } else if (value && typeof value === "object") {
    const q = value as {
      method?: string;
      attribute?: string;
      values?: unknown[];
    };
    if (q.method) {
      return { method: q.method, attribute: q.attribute, values: q.values };
    }
  }
  throw new Error(
    `Fake backend cannot interpret a nested query: ${JSON.stringify(value)}`
  );
}

/**
 * Sort rows the way Appwrite would.
 *
 * Applied rather than ignored: a fake that silently drops `orderAsc`/
 * `orderDesc` cannot tell a correct ordering from a wrong one, which makes
 * every test that depends on "the first N rows" vacuous — the same way
 * ignoring a filter does.
 */
function applyOrder(rows: FakeRow[], parsed: ParsedQuery[]): FakeRow[] {
  const order = parsed.find(
    (query) => query.method === "orderAsc" || query.method === "orderDesc"
  );
  const attribute = order?.attribute;
  if (!attribute) {
    return rows;
  }
  const direction = order.method === "orderAsc" ? 1 : -1;
  return [...rows].sort((left, right) =>
    compareAttribute(
      readAttribute(left, attribute),
      readAttribute(right, attribute),
      direction
    )
  );
}

/** Missing values sort last in either direction, so they never displace a real one. */
function compareAttribute(a: unknown, b: unknown, direction: number): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  if (a === b) {
    return 0;
  }
  return (a < b ? -1 : 1) * direction;
}

function applyGroup(row: FakeRow, query: ParsedQuery): boolean {
  const nested = (query.values ?? []).map(coerceNested);
  if (nested.length === 0) {
    return true;
  }
  const test = (inner: ParsedQuery) =>
    inner.method === "or" || inner.method === "and"
      ? applyGroup(row, inner)
      : matches(row, inner);
  return query.method === "and" ? nested.every(test) : nested.some(test);
}

export interface FakeBackendOptions {
  /** The account `resolvePrincipal` will read; omit to make `account.get()` 401. */
  account?: { $id: string; email?: string; name?: string };
  /** Rows the anonymous client can see, when different from `tables`. */
  anonymousTables?: FakeTables;
  /** Whether a service key is configured. */
  hasElevated?: boolean;
  /** Whether a user credential is configured. */
  hasUserCredential?: boolean;
  /**
   * Called after a write is recorded and before it is applied. Throwing here
   * simulates a backend that received the request and then failed — which is
   * the only way to exercise "the write was dispatched and we do not know what
   * happened to it". The write still appears in `writes`, because it really was
   * sent.
   */
  /**
   * Called at the start of every `listRows`. Throwing here simulates a backend
   * that is partially unavailable — the case where a caller assembles a result
   * from several queries and only some fail, which is the only way to test that
   * it says so rather than reporting the surviving half as the whole.
   */
  onRead?: (table: string) => void;
  onWrite?: (op: "create" | "update" | "upsert", table: string) => void;
  tables?: FakeTables;
  /** Team memberships `resolvePrincipal` will read. */
  teams?: Array<{ $id: string; name: string }>;
}

export interface FakeBackend extends BackendClients {
  /** Reasons passed to `requireElevated`. */
  elevations: string[];
  tables: FakeTables;
  /** Every write the fake received, in order. */
  writes: Array<{
    op: "create" | "update" | "upsert" | "delete";
    table: string;
    id: string;
    data?: Record<string, unknown>;
    permissions?: string[];
    /** Which client performed it. */
    via: "user" | "elevated";
  }>;
}

/**
 * Apply `Query.select` the way Appwrite does: a projected row carries only the
 * attributes that were asked for.
 *
 * The fake used to ignore `select` and hand back whole rows, which made the one
 * mistake a projection can cause invisible — reading a column the query never
 * asked for. That reads as `undefined` against the real backend and as the
 * stored value here, so a test would pass on code that cannot work. It is the
 * same way `or` and `orderAsc` used to fail open, and it hid a real defect:
 * the event quality audit tested `member_price` while the event projection
 * omitted it.
 *
 * Two deliberate simplifications, both narrower than Appwrite rather than
 * wider:
 *
 * - `$`-prefixed system attributes are always kept. Which of them a projection
 *   returns varies by Appwrite version, and none of them is a domain column, so
 *   pruning them would fail tests over something this fake cannot settle.
 * - A nested selection (`translation_refs.title`) keeps the relationship and
 *   prunes it to the selected sub-attributes; `translation_refs.*` keeps it
 *   whole.
 * - A bare `*` keeps every plain column but NOT a relationship, which must be
 *   named. That is what every projection in this repository assumes: writing
 *   `["*", "translation_refs.*"]` — as `NEWS_RELATIONSHIP_SELECT`, `JOB_SELECT`
 *   and `readPageRow` all do — would be redundant if `*` already covered the
 *   relationship. A relationship is recognised by its shape: a row, or an array
 *   of rows, carrying `$id`.
 */
function applySelect(rows: FakeRow[], parsed: ParsedQuery[]): FakeRow[] {
  const paths = parsed
    .filter((query) => query.method === "select")
    .flatMap((query) => (query.values ?? []) as unknown[])
    .filter((value): value is string => typeof value === "string");

  if (paths.length === 0) {
    return rows;
  }

  // A bare `*` selects every top-level attribute; nested paths alongside it
  // still prune their own relationship, exactly as Appwrite does.
  const selectAll = paths.includes("*");
  // `key` -> the sub-attributes selected under it, or null for the whole value.
  const keep = new Map<string, Set<string> | null>();
  for (const path of paths) {
    const [head, ...rest] = path.split(".");
    if (!head || head === "*") {
      continue;
    }
    const nested = rest.join(".");
    if (nested === "" || nested === "*") {
      keep.set(head, null);
      continue;
    }
    const existing = keep.get(head);
    if (existing === null) {
      continue;
    }
    const sub = existing ?? new Set<string>();
    sub.add(nested);
    keep.set(head, sub);
  }

  return rows.map((row) => projectRow(row, keep, selectAll));
}

function projectRow(
  row: FakeRow,
  keep: Map<string, Set<string> | null>,
  selectAll: boolean
): FakeRow {
  const out: FakeRow = { $id: row.$id };
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("$")) {
      out[key] = value;
      continue;
    }
    const selected = keep.has(key);
    if (!(selected || (selectAll && !isRelationship(value)))) {
      continue;
    }
    const sub = selected ? keep.get(key) : null;
    out[key] = sub ? pruneNested(value, sub) : value;
  }
  return out;
}

/** A related row, or a list of them: an object carrying `$id`. */
function isRelationship(value: unknown): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "$id" in (candidate as Record<string, unknown>)
  );
}

function pruneNested(value: unknown, sub: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => pruneNested(item, sub));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$") || sub.has(key)) {
      out[key] = nested;
    }
  }
  return out;
}

function buildDb(
  tables: FakeTables,
  record: (entry: FakeBackend["writes"][number]) => void,
  via: "user" | "elevated",
  onWrite?: FakeBackendOptions["onWrite"],
  onRead?: FakeBackendOptions["onRead"]
): AppwriteClients["db"] {
  const listRows = (
    _databaseId: string,
    tableId: string,
    queries?: string[]
  ) => {
    onRead?.(tableId);
    const all = tables[tableId] ?? [];
    const parsed = (queries ?? [])
      .map(parseQuery)
      .filter((value): value is ParsedQuery => value !== null);

    const filters = parsed.filter(
      (query) =>
        query.method !== "limit" &&
        query.method !== "offset" &&
        query.method !== "select" &&
        query.method !== "orderAsc" &&
        query.method !== "orderDesc" &&
        query.method !== "cursorAfter"
    );

    let rows = all.filter((row) =>
      filters.every((query) =>
        query.method === "or" || query.method === "and"
          ? applyGroup(row, query)
          : matches(row, query)
      )
    );

    rows = applyOrder(rows, parsed);

    const total = rows.length;
    const offset = parsed.find((q) => q.method === "offset")?.values?.[0];
    const limit = parsed.find((q) => q.method === "limit")?.values?.[0];
    if (typeof offset === "number") {
      rows = rows.slice(offset);
    }
    if (typeof limit === "number") {
      rows = rows.slice(0, limit);
    }
    return Promise.resolve({
      rows: applySelect(structuredClone(rows), parsed),
      total,
    });
  };

  const getRow = (
    _databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ) => {
    const row = (tables[tableId] ?? []).find((item) => item.$id === rowId);
    if (!row) {
      const error = new Error(`Row ${rowId} not found`) as Error & {
        code: number;
        type: string;
      };
      error.code = 404;
      error.type = "row_not_found";
      throw error;
    }
    // A single-row read projects like a listing does. It used to ignore its
    // queries entirely, which is the same failing-open shape as `listRows`
    // before it honoured `select`.
    const parsed = (queries ?? [])
      .map(parseQuery)
      .filter((value): value is ParsedQuery => value !== null);
    return Promise.resolve(applySelect([structuredClone(row)], parsed)[0]);
  };

  const write =
    (op: "create" | "upsert" | "update") =>
    (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>,
      permissions?: string[]
    ) => {
      record({ op, table: tableId, id: rowId, data, permissions, via });
      onWrite?.(op, tableId);
      if (!tables[tableId]) {
        tables[tableId] = [];
      }
      const list = tables[tableId];
      const existing = list.findIndex((item) => item.$id === rowId);
      const now = new Date().toISOString();
      if (existing >= 0 && op !== "create") {
        list[existing] = {
          ...list[existing],
          ...data,
          $updatedAt: now,
        } as FakeRow;
        return Promise.resolve(structuredClone(list[existing]));
      }
      const created: FakeRow = {
        $id: rowId,
        $createdAt: now,
        $updatedAt: now,
        ...data,
      };
      list.push(created);
      return Promise.resolve(structuredClone(created));
    };

  return {
    listRows,
    getRow,
    createRow: write("create"),
    updateRow: write("update"),
    upsertRow: write("upsert"),
    deleteRow: (_d: string, tableId: string, rowId: string) => {
      record({ op: "delete", table: tableId, id: rowId, via });
      const list = tables[tableId] ?? [];
      const index = list.findIndex((item) => item.$id === rowId);
      if (index >= 0) {
        list.splice(index, 1);
      }
      return Promise.resolve({});
    },
  } as unknown as AppwriteClients["db"];
}

function fakeClients(
  db: AppwriteClients["db"],
  kind: AppwriteClients["credentialKind"],
  account?: { $id: string; email?: string; name?: string },
  teams?: Array<{ $id: string; name: string }>
): AppwriteClients {
  return {
    db,
    account: {
      get: () => {
        if (!account) {
          const error = new Error("Unauthorized") as Error & { code: number };
          error.code = 401;
          throw error;
        }
        return Promise.resolve(account);
      },
    },
    teams: {
      list: () =>
        Promise.resolve({ teams: teams ?? [], total: (teams ?? []).length }),
    },
    storage: {},
    functions: {},
    messaging: {},
    users: kind === "apiKey" ? {} : null,
    credentialKind: kind,
  } as unknown as AppwriteClients;
}

export function createFakeBackend(
  options: FakeBackendOptions = {}
): FakeBackend {
  const tables = options.tables ?? {};
  const writes: FakeBackend["writes"] = [];
  const elevations: string[] = [];
  const record = (entry: FakeBackend["writes"][number]) => writes.push(entry);

  const userDb = buildDb(
    tables,
    record,
    "user",
    options.onWrite,
    options.onRead
  );
  const elevatedDb = buildDb(
    tables,
    record,
    "elevated",
    options.onWrite,
    options.onRead
  );
  const anonDb = buildDb(
    options.anonymousTables ?? tables,
    record,
    "user",
    options.onWrite,
    options.onRead
  );

  const hasElevated = options.hasElevated ?? true;

  return {
    user: fakeClients(userDb, "jwt", options.account, options.teams),
    anonymous: fakeClients(anonDb, "anonymous"),
    hasUserCredential: options.hasUserCredential ?? true,
    hasElevated,
    requireElevated(reason: string) {
      elevations.push(reason);
      if (!hasElevated) {
        throw unavailable(
          "This operation needs the service-key client, which is not configured.",
          { reason }
        );
      }
      return fakeClients(elevatedDb, "apiKey");
    },
    tables,
    writes,
    elevations,
  };
}

/** Build a principal for a test. Defaults to a plain department member. */
export function makePrincipal(overrides: Partial<Principal> = {}): Principal {
  return {
    ...ANONYMOUS_PRINCIPAL,
    userId: "user-1",
    email: "test@biso.no",
    name: "Test User",
    profile: "staff",
    ...overrides,
  } as Principal;
}

export const GLOBAL_ADMIN = (): Principal =>
  makePrincipal({
    userId: "global-1",
    roles: ["globaladmin"],
    campusNames: ["National"],
    departmentNames: ["Operations Unit"],
    departmentTeamIds: ["sg-app-dept-operationsunit"],
    resolvedCampusIds: ["5"],
    resolvedDepartmentIds: ["dept-ops"],
    profile: "it-operator",
  });

export const CAMPUS_ADMIN = (campus = "Oslo", campusId = "1"): Principal =>
  makePrincipal({
    userId: "campus-1",
    roles: ["campusadmin"],
    campusNames: [campus],
    departmentNames: [`Ledelsen ${campus}`],
    departmentTeamIds: [`sg-app-dept-ledelsen${campus.toLowerCase()}`],
    managedCampuses: [campus],
    managedCampusIds: [campusId],
    resolvedCampusIds: [campusId],
    resolvedDepartmentIds: [`dept-ledelsen-${campus.toLowerCase()}`],
    profile: "staff",
  });

export const DEPARTMENT_MEMBER = (
  departmentId = "dept-esn-oslo",
  campusId = "1"
): Principal =>
  makePrincipal({
    userId: "dept-1",
    roles: [],
    campusNames: ["Oslo"],
    departmentNames: ["ESN Oslo"],
    departmentTeamIds: ["sg-app-dept-esnoslo"],
    resolvedCampusIds: [campusId],
    resolvedDepartmentIds: [departmentId],
    profile: "staff",
  });

export const HR_MEMBER = (campus = "Oslo", campusId = "1"): Principal =>
  makePrincipal({
    userId: "hr-1",
    roles: ["hr"],
    campusNames: [campus],
    departmentNames: ["HR"],
    departmentTeamIds: ["sg-app-dept-hr"],
    resolvedCampusIds: [campusId],
    resolvedDepartmentIds: ["dept-hr"],
    profile: "staff",
  });

export const MEMBER_ONLY = (): Principal =>
  makePrincipal({
    userId: "member-1",
    roles: [],
    campusNames: [],
    departmentNames: [],
    profile: "member",
  });

export const ANONYMOUS = (): Principal => ANONYMOUS_PRINCIPAL;

/** A logger that collects lines, so a test can assert on redaction. */
export function collectingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger = createLogger({
    level: "debug",
    write: (line) => lines.push(line),
  });
  return { logger, lines };
}
