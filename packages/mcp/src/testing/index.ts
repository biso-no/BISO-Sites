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
  if (!(attribute && values)) {
    return true;
  }
  const actual = readAttribute(row, attribute);

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
    case "isNull":
      return actual === null || actual === undefined;
    case "isNotNull":
      return actual !== null && actual !== undefined;
    default:
      // Unknown filters are treated as no-ops. `or` is handled separately.
      return true;
  }
}

function applyOr(row: FakeRow, query: ParsedQuery): boolean {
  const nested = (query.values ?? [])
    .map((value) => (typeof value === "string" ? parseQuery(value) : null))
    .filter((value): value is ParsedQuery => value !== null);
  if (nested.length === 0) {
    return true;
  }
  return nested.some((inner) => matches(row, inner));
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

function buildDb(
  tables: FakeTables,
  record: (entry: FakeBackend["writes"][number]) => void,
  via: "user" | "elevated"
): AppwriteClients["db"] {
  const listRows = (
    _databaseId: string,
    tableId: string,
    queries?: string[]
  ) => {
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
        query.method === "or" ? applyOr(row, query) : matches(row, query)
      )
    );

    const total = rows.length;
    const offset = parsed.find((q) => q.method === "offset")?.values?.[0];
    const limit = parsed.find((q) => q.method === "limit")?.values?.[0];
    if (typeof offset === "number") {
      rows = rows.slice(offset);
    }
    if (typeof limit === "number") {
      rows = rows.slice(0, limit);
    }
    return Promise.resolve({ rows: structuredClone(rows), total });
  };

  const getRow = (_databaseId: string, tableId: string, rowId: string) => {
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
    return Promise.resolve(structuredClone(row));
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

  const userDb = buildDb(tables, record, "user");
  const elevatedDb = buildDb(tables, record, "elevated");
  const anonDb = buildDb(options.anonymousTables ?? tables, record, "user");

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
