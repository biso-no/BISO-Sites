import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { AnnouncementFormValues } from "./schemas";

const db = {
  createRow: mock(),
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

const departmentCtx = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});
const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});
const globalAdminCtx = makeCtx({ roles: ["globaladmin"] });

let currentCtx: UserAuthContext = departmentCtx;

const departmentValues: AnnouncementFormValues = {
  audience_type: "broadcast",
  audience_value: null,
  body_en: "<p>English body</p>",
  body_no: null,
  campus_id: "campus-oslo",
  category: "general",
  department_id: "dept-1",
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "English title",
  title_no: null,
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/announcements/send", () => ({
  buildDeepLink: mock(() => "biso://announcements/announcement-1"),
  dispatchAnnouncement: mock(async () => ({ recipients: 0 })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createAnnouncement, getAnnouncement, sendAnnouncement } = await import(
  "./announcements"
);

function mockAnnouncementRow(row: Record<string, unknown> | null): void {
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => {
      if (tableId === "announcements") {
        return { rows: row ? [row] : [], total: row ? 1 : 0 };
      }
      return { rows: [], total: 0 };
    }
  );
}

beforeEach(() => {
  currentCtx = departmentCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockImplementation(
    async (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
  );
  db.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId === "unique()" ? "announcement-1" : rowId, ...data })
  );
  db.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("announcement ownership persistence", () => {
  test("createAnnouncement persists both ownership relationships", async () => {
    const result = await createAnnouncement(departmentValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        campus_id: "campus-oslo",
        department: "dept-1",
        status: "draft",
      })
    );
  });

  test("department author keeps their own department", async () => {
    const result = await createAnnouncement({
      ...departmentValues,
      department_id: "dept-other",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("campus author may create campus-wide announcements", async () => {
    currentCtx = campusAdminCtx;

    const result = await createAnnouncement({
      ...departmentValues,
      department_id: null,
    });

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      expect.any(String),
      expect.objectContaining({ campus: "campus-oslo", department: null })
    );
  });

  test("only global authors may use a null campus", async () => {
    currentCtx = campusAdminCtx;
    const denied = await createAnnouncement({
      ...departmentValues,
      campus_id: null,
      department_id: null,
    });
    expect(denied).toEqual({
      error: "Unauthorized: campus is required for this content",
    });

    currentCtx = globalAdminCtx;
    const allowed = await createAnnouncement({
      ...departmentValues,
      campus_id: null,
      department_id: null,
    });
    expect(allowed).toEqual({ data: expect.any(String) });
  });

  test("getAnnouncement hides rows outside the relationship scope", async () => {
    mockAnnouncementRow({
      $id: "announcement-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "draft",
    });

    await expect(getAnnouncement("announcement-1")).resolves.toBeNull();
  });
});

describe("announcement dispatch authorization", () => {
  test("sending requires scope over the announcement's ownership", async () => {
    mockAnnouncementRow({
      $id: "announcement-1",
      audience_type: "broadcast",
      audience_value: null,
      campus: { $id: "campus-bergen" },
      category: "general",
      data: null,
      department: { $id: "dept-9" },
      push: true,
      scheduled_at: null,
      status: "draft",
      title_en: "English title",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({
      error: "Unauthorized: no access to this campus",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a department author can send their own department's announcement", async () => {
    mockAnnouncementRow({
      $id: "announcement-1",
      audience_type: "broadcast",
      audience_value: null,
      campus: { $id: "campus-oslo" },
      category: "general",
      data: null,
      department: { $id: "dept-1" },
      push: true,
      scheduled_at: null,
      status: "draft",
      title_en: "English title",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ data: { recipients: 0, status: "sent" } });
  });
});
