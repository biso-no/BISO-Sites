import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import type { BigEventFormValues } from "@/lib/big-events/form-schema";

mock.module("server-only", () => ({}));

interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
}
type ListHandler = (queries: string[]) => ListResult;

const db = { createRow: mock(), listRows: mock(), updateRow: mock() };

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: "a@example.com",
    managedCampuses: [],
    managedCampusIds: [],
    name: "Admin",
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "u1",
    ...overrides,
  };
}

const globalAdmin = makeCtx({ roles: ["globaladmin"] });
const campusAdminOf = (...campusIds: string[]): UserAuthContext =>
  makeCtx({
    managedCampusIds: campusIds,
    resolvedCampusIds: campusIds,
    roles: ["campusadmin"],
  });

let currentCtx: UserAuthContext = globalAdmin;
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const { createBigEvent, listBigEvents, updateBigEvent } = await import(
  "./big-events"
);

const formValues: BigEventFormValues = {
  campus_id: "5",
  department_id: null,
  ends_at: "2027-01-27T17:00:00.000Z",
  group_checkin_enabled: false,
  hero_image_url: "",
  name_en: "",
  name_no: "Winter Games 2027",
  place_address: "",
  place_name: "",
  starts_at: "2027-01-24T07:00:00.000Z",
  travel_enabled: true,
};

function bigEventRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: "b1",
    campus_id: "5",
    created_by: "u0",
    department_id: null,
    ends_at: "2027-01-27T17:00:00.000+00:00",
    group_checkin_enabled: false,
    hero_image_url: null,
    name_en: null,
    name_no: "Winter Games 2027",
    place_address: null,
    place_name: null,
    slug: "winter-games-2027",
    starts_at: "2027-01-24T07:00:00.000+00:00",
    status: "draft",
    travel_enabled: true,
    ...overrides,
  };
}

/** Routes `listRows` by table id; unknown tables return nothing. */
function routeListRows(handlers: Record<string, ListHandler>) {
  db.listRows.mockImplementation(
    async (_database: string, table: string, queries: string[]) =>
      handlers[table]?.(queries) ?? { rows: [], total: 0 }
  );
}

function queriesFor(table: string): string[][] {
  return db.listRows.mock.calls
    .filter((call) => call[1] === table)
    .map((call) => call[2] as string[]);
}

beforeEach(() => {
  currentCtx = globalAdmin;
  db.createRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  logAuditEvent.mockClear();
  routeListRows({});
});

describe("createBigEvent", () => {
  test("campus admin cannot create a national big event", async () => {
    currentCtx = campusAdminOf("2");
    await expect(
      createBigEvent({ ...formValues, campus_id: "5" })
    ).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("creating picks a free slug", async () => {
    routeListRows({
      big_events: () => ({
        rows: [{ $id: "old", slug: "winter-games-2027" }],
        total: 1,
      }),
    });
    db.createRow.mockResolvedValue({ $id: "new1" });

    const result = await createBigEvent(formValues);

    expect(result).toEqual({ id: "new1" });
    expect(db.createRow).toHaveBeenCalledTimes(1);
    const [, table, , data] = db.createRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(table).toBe("big_events");
    expect(data).toMatchObject({
      created_by: "u1",
      name_no: "Winter Games 2027",
      slug: "winter-games-2027-2",
      status: "draft",
    });
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.create");
  });

  test("a board from another campus is refused", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({ departments: () => ({ rows: [], total: 0 }) });
    await expect(
      createBigEvent({ ...formValues, campus_id: "2", department_id: "d9" })
    ).rejects.toThrow();
    expect(queriesFor("departments")[0]).toContain(
      Query.equal("campus_id", ["2"])
    );
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("an end before the start is refused", async () => {
    await expect(
      createBigEvent({
        ...formValues,
        ends_at: "2027-01-23T07:00:00.000Z",
      })
    ).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("listBigEvents", () => {
  test("department member sees only their board's big events", async () => {
    currentCtx = makeCtx({
      departmentTeamIds: ["sg-app-dept-wintergames"],
      resolvedDepartmentIds: ["d1"],
      roles: ["department"],
    });
    routeListRows({
      big_event_participants: (queries) => ({
        rows: [],
        total: queries.some((q) => q.includes("isNotNull")) ? 37 : 142,
      }),
      big_events: () => ({
        rows: [
          bigEventRow({ $id: "b1", department_id: "d1" }),
          bigEventRow({ $id: "b2", department_id: "d2" }),
        ],
        total: 2,
      }),
    });

    const items = await listBigEvents();

    expect(queriesFor("big_events")[0]).toContain(
      Query.equal("department_id", ["d1"])
    );
    expect(queriesFor("big_events")[0]).toContain(Query.orderDesc("starts_at"));
    expect(items.map((item) => item.$id)).toEqual(["b1"]);
    expect(items[0]).toMatchObject({
      access: "full",
      linkedCount: 37,
      participantCount: 142,
    });
  });

  test("campus-level counts only include the admin's campuses", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_events: () => ({ rows: [bigEventRow()], total: 1 }),
    });

    const [item] = await listBigEvents();

    expect(item?.access).toBe("campus");
    const participantQueries = queriesFor("big_event_participants");
    expect(participantQueries).toHaveLength(2);
    for (const queries of participantQueries) {
      expect(queries).toContain(Query.equal("big_event_id", ["b1"]));
      expect(queries).toContain(Query.equal("campus_id", ["2"]));
    }
    expect(participantQueries[1]).toContain(Query.isNotNull("user_id"));
  });
});

describe("updateBigEvent", () => {
  test("update refuses campus-level access", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_events: () => ({ rows: [bigEventRow({ campus_id: "5" })], total: 1 }),
    });
    await expect(
      updateBigEvent("b1", { ...formValues, status: "published" })
    ).rejects.toThrow();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("campus change needs a global admin", async () => {
    currentCtx = campusAdminOf("2", "3");
    routeListRows({
      big_events: () => ({ rows: [bigEventRow({ campus_id: "2" })], total: 1 }),
    });
    await expect(
      updateBigEvent("b1", { ...formValues, campus_id: "3", status: "draft" })
    ).rejects.toThrow();
    expect(db.updateRow).not.toHaveBeenCalled();

    currentCtx = globalAdmin;
    db.updateRow.mockResolvedValue({ $id: "b1" });
    await updateBigEvent("b1", {
      ...formValues,
      campus_id: "3",
      status: "draft",
    });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    const [, , id, data] = db.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("b1");
    expect(data).toMatchObject({ campus_id: "3", status: "draft" });
    expect(data).not.toHaveProperty("slug");
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.update");
  });

  test("the owning board may edit settings on its own campus", async () => {
    currentCtx = makeCtx({
      resolvedDepartmentIds: ["d1"],
      roles: ["department"],
    });
    routeListRows({
      big_events: () => ({
        rows: [bigEventRow({ department_id: "d1" })],
        total: 1,
      }),
      departments: () => ({ rows: [{ $id: "d1", campus_id: "5" }], total: 1 }),
    });
    db.updateRow.mockResolvedValue({ $id: "b1" });

    await updateBigEvent("b1", {
      ...formValues,
      department_id: "d1",
      name_en: "Winter Games",
      status: "published",
    });

    const [, , , data] = db.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(data).toMatchObject({
      department_id: "d1",
      hero_image_url: null,
      name_en: "Winter Games",
      place_name: null,
      status: "published",
    });
    // Stored dates come back as `+00:00`; the same instant is not a change.
    expect(logAuditEvent.mock.calls[0]?.[2]).toMatchObject({
      payload: { changed: ["name_en", "status"] },
    });
  });

  test("an image link must be a web address", async () => {
    await expect(
      createBigEvent({ ...formValues, hero_image_url: "javascript:alert(1)" })
    ).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});
