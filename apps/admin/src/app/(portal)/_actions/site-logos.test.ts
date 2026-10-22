import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

type Row = Record<string, unknown>;

const db = {
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

const campusAdminOf = (campusId: string): UserAuthContext =>
  makeCtx({
    managedCampusIds: [campusId],
    resolvedCampusIds: [campusId],
    roles: ["campusadmin"],
  });

let currentCtx: UserAuthContext = campusAdminOf("2");
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));
const notifyWebsite = mock(async (_tags: string[]) => undefined);
mock.module("@/lib/web-revalidate", () => ({ notifyWebsite }));

const { deleteSiteLogo, loadSiteLogos, reorderSiteLogos, saveSiteLogo } =
  await import("./site-logos");

const editorCtx = (): UserAuthContext => makeCtx({ roles: ["benefitseditor"] });

const logoRow = (id: string, campusId: string, sortOrder: number): Row => ({
  $createdAt: "2026-01-01T00:00:00.000Z",
  $id: id,
  campus_id: campusId,
  image_url: `https://cdn.example.com/${id}.png`,
  name: id,
  sort_order: sortOrder,
  url: null,
});

let rows: Row[] = [];

/** What Appwrite throws for a row that is not there. */
const rowNotFound = () =>
  Object.assign(new Error("Row with the requested ID could not be found."), {
    code: 404,
    type: "row_not_found",
  });

beforeEach(() => {
  currentCtx = campusAdminOf("2");
  logAuditEvent.mockClear();
  notifyWebsite.mockClear();
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  rows = [];
  db.listRows.mockImplementation(async () => ({ rows, total: rows.length }));
  db.getRow.mockImplementation(async (_d: string, _t: string, id: string) =>
    rows.find((row) => row.$id === id)
  );
  db.upsertRow.mockImplementation(
    async (_d: string, _t: string, rowId: string, data: Row) => ({
      $id: rowId,
      ...data,
    })
  );
  db.updateRow.mockImplementation(
    async (_d: string, _t: string, rowId: string, data: Row) => ({
      ...rows.find((row) => row.$id === rowId),
      ...data,
    })
  );
});

describe("loadSiteLogos", () => {
  test("groups visible campuses with Hele BISO first", async () => {
    rows = [logoRow("a", "2", 0), logoRow("b", "5", 0), logoRow("c", "2", 1)];
    const groups = await loadSiteLogos();
    expect(groups.map((g) => g.campusId)).toEqual(["5", "2"]);
    expect(groups.map((g) => g.editable)).toEqual([false, true]);
    expect(groups[1]?.logos.map((l) => l.id)).toEqual(["a", "c"]);
  });

  test("an editor sees every campus, editable", async () => {
    currentCtx = editorCtx();
    const groups = await loadSiteLogos();
    expect(groups.map((g) => g.campusId)).toEqual(["5", "1", "2", "3", "4"]);
    expect(groups.every((g) => g.editable)).toBe(true);
  });
});

describe("saveSiteLogo create", () => {
  test("a campus logo gets level campus, campus ids and goes last", async () => {
    rows = [logoRow("a", "2", 3)];
    const result = await saveSiteLogo({
      campus_id: "2",
      image_url: "https://cdn.example.com/n.png",
      name: " Nytt ",
    });
    expect("data" in result).toBe(true);
    const [, table, , data] = db.upsertRow.mock.calls[0] as [
      string,
      string,
      string,
      Row,
    ];
    expect(table).toBe("partners");
    expect(data).toMatchObject({
      campus: "2",
      campus_id: "2",
      level: "campus",
      name: "Nytt",
      sort_order: 4,
      url: null,
    });
    expect(db.upsertRow.mock.calls[0]).toHaveLength(4);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(notifyWebsite.mock.calls).toEqual([[["partners"]]]);
  });

  test("a Hele BISO logo gets level national", async () => {
    currentCtx = editorCtx();
    await saveSiteLogo({
      campus_id: "5",
      image_url: "https://cdn.example.com/n.png",
      name: "Nasjonal",
    });
    expect(db.upsertRow.mock.calls[0]?.[3]).toMatchObject({
      level: "national",
      sort_order: 0,
    });
  });

  test("validates image, link and name", async () => {
    const base = {
      campus_id: "2",
      image_url: "https://cdn.example.com/n.png",
      name: "Ok",
    };
    expect(await saveSiteLogo({ ...base, image_url: "" })).toEqual({
      error: "Upload a logo",
    });
    expect(await saveSiteLogo({ ...base, url: "http://x.no" })).toEqual({
      error: "The link must start with https://",
    });
    expect(await saveSiteLogo({ ...base, name: "  " })).toEqual({
      error: "Add the company's name",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a campus the caller cannot write", async () => {
    expect(
      await saveSiteLogo({
        campus_id: "5",
        image_url: "https://cdn.example.com/n.png",
        name: "X",
      })
    ).toEqual({ error: "Unauthorized: no write access to this campus" });
  });
});

describe("saveSiteLogo update", () => {
  test("keeps the order when the campus stays", async () => {
    rows = [logoRow("a", "2", 3)];
    await saveSiteLogo({
      campus_id: "2",
      id: "a",
      image_url: "https://cdn.example.com/a2.png",
      name: "A2",
      url: "https://a.no",
    });
    const patch = db.updateRow.mock.calls[0]?.[3] as Row;
    expect(patch).toMatchObject({ name: "A2", url: "https://a.no" });
    expect(patch).not.toHaveProperty("sort_order");
  });

  test("moving campus puts the logo last in the new group", async () => {
    currentCtx = editorCtx();
    rows = [logoRow("a", "2", 3)];
    await saveSiteLogo({
      campus_id: "3",
      id: "a",
      image_url: "https://cdn.example.com/a.png",
      name: "A",
    });
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      campus: "3",
      campus_id: "3",
      level: "campus",
      sort_order: 4,
    });
  });

  test("a logo removed meanwhile is not found, and nothing is written", async () => {
    db.getRow.mockImplementationOnce(() => Promise.reject(rowNotFound()));
    expect(
      await saveSiteLogo({
        campus_id: "2",
        id: "gone",
        image_url: "https://cdn.example.com/a.png",
        name: "A",
      })
    ).toEqual({ error: "Logo not found" });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a stored campus the caller cannot write", async () => {
    rows = [logoRow("a", "5", 0)];
    expect(
      await saveSiteLogo({
        campus_id: "2",
        id: "a",
        image_url: "https://cdn.example.com/a.png",
        name: "A",
      })
    ).toEqual({ error: "Unauthorized: no write access to this campus" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("deleteSiteLogo", () => {
  test("deletes and audits", async () => {
    rows = [logoRow("a", "2", 0)];
    expect(await deleteSiteLogo("a")).toEqual({ data: true });
    expect(db.deleteRow).toHaveBeenCalledTimes(1);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("site_logo_deleted");
    expect(notifyWebsite.mock.calls).toEqual([[["partners"]]]);
  });

  test("a logo removed meanwhile is not found", async () => {
    db.getRow.mockImplementationOnce(() => Promise.reject(rowNotFound()));
    expect(await deleteSiteLogo("gone")).toEqual({ error: "Logo not found" });
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("refuses a campus the caller cannot write", async () => {
    rows = [logoRow("a", "5", 0)];
    expect(await deleteSiteLogo("a")).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});

describe("reorderSiteLogos", () => {
  test("writes only the changed sort orders", async () => {
    rows = [logoRow("a", "2", 0), logoRow("b", "2", 1), logoRow("c", "2", 2)];
    expect(await reorderSiteLogos("2", ["a", "c", "b"])).toEqual({
      data: true,
    });
    expect(db.updateRow).toHaveBeenCalledTimes(2);
    const written = db.updateRow.mock.calls.map((call) => [
      call[2],
      (call[3] as Row).sort_order,
    ]);
    expect(written).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
    expect(notifyWebsite.mock.calls).toEqual([[["partners"]]]);
  });

  test("refuses a stale list", async () => {
    rows = [logoRow("a", "2", 0), logoRow("b", "2", 1)];
    expect(await reorderSiteLogos("2", ["a"])).toEqual({
      error: "Reorder list is out of date",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses a campus the caller cannot write", async () => {
    expect(await reorderSiteLogos("5", [])).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(notifyWebsite).not.toHaveBeenCalled();
  });
});
