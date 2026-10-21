import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  ALREADY_SENT_MESSAGE,
  AUDIENCE_FORBIDDEN_MESSAGE,
  SEND_FORBIDDEN_MESSAGE,
} from "@/lib/announcements/audience-policy";
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
const bergenAdminCtx = makeCtx({
  managedCampusIds: ["2"],
  resolvedCampusIds: ["2"],
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
  buildPushData: mock(() => ({})),
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

const {
  createAnnouncement,
  getAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
} = await import("./announcements");

function mockAnnouncementRow(row: Record<string, unknown> | null): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    if (tableId === "announcements") {
      return { rows: row ? [row] : [], total: row ? 1 : 0 };
    }
    return { rows: [], total: 0 };
  });
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
    (_databaseId: string, tableId: string, rowId: string) => {
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
    currentCtx = campusAdminCtx;
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

  test("an event-linked announcement records the event as its content", async () => {
    currentCtx = campusAdminCtx;
    db.listRows.mockImplementation((_d: string, tableId: string) => ({
      rows:
        tableId === "events"
          ? [{ $id: "event-1", status: "published", campus_id: "campus-oslo" }]
          : [],
      total: 0,
    }));
    await createAnnouncement({ ...departmentValues, event_id: "event-1" });

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      expect.any(String),
      expect.objectContaining({
        content_id: "event-1",
        content_type: "event",
        event_id: "event-1",
      })
    );
  });

  test("a draft link returns an error and writes no row", async () => {
    currentCtx = campusAdminCtx;
    db.listRows.mockImplementation((_d: string, tableId: string) => ({
      rows: tableId === "news" ? [{ $id: "n1", status: "draft" }] : [],
      total: 0,
    }));
    const result = await createAnnouncement({
      ...departmentValues,
      content_id: "n1",
      content_type: "news",
    });

    expect(result).toEqual({ error: "Only published content can be linked." });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("a half-filled link returns a validation error", async () => {
    currentCtx = campusAdminCtx;
    const result = await createAnnouncement({
      ...departmentValues,
      content_id: "",
      content_type: "news",
    });

    expect(result).toEqual({ error: "Pick the content to link." });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("an unchanged link to now-unpublished content doesn't block an edit", async () => {
    currentCtx = campusAdminCtx;
    const stored = {
      $id: "announcement-1",
      campus_id: "campus-oslo",
      content_id: "n1",
      content_type: "news",
      status: "draft",
    };
    db.listRows.mockImplementation((_d: string, tableId: string) => ({
      rows:
        tableId === "announcements"
          ? [stored]
          : [{ $id: "n1", status: "draft" }],
      total: 1,
    }));
    const result = await updateAnnouncement("announcement-1", {
      ...departmentValues,
      content_id: "n1",
      content_type: "news",
      title_en: "New title",
    });

    expect(result).toEqual({ data: "announcement-1" });
    const written = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(written.title_en).toBe("New title");
    for (const key of [
      "content_type",
      "content_id",
      "event_id",
      "deep_link",
      "image",
      "items",
    ]) {
      expect(key in written).toBe(false);
    }
  });

  test("an announcement with no event records no content", async () => {
    currentCtx = campusAdminCtx;
    await createAnnouncement(departmentValues);

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      expect.any(String),
      expect.objectContaining({ content_id: null, content_type: null })
    );
  });

  test("department members can't create announcements", async () => {
    const result = await createAnnouncement(departmentValues);

    expect(result).toEqual({ error: SEND_FORBIDDEN_MESSAGE });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("a campus admin can't broadcast to all campuses", async () => {
    currentCtx = campusAdminCtx;
    const result = await createAnnouncement({
      ...departmentValues,
      campus_id: null,
      department_id: null,
    });

    expect(result).toEqual({
      error: "Unauthorized: campus is required for this content",
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("a campus admin can't send a topic to a campus they don't manage", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "topic",
      audience_value: "events",
      campus_id: "1",
      department_id: null,
    });

    expect(result).toEqual({ error: expect.any(String) });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test.each([
    ["general"],
    ["events_national"],
    ["events_oslo"],
    ["news_oslo"],
  ])("a Bergen campus admin can't create a topic announcement with value %p", async (value) => {
    currentCtx = bergenAdminCtx;
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "topic",
      audience_value: value,
      campus_id: "2",
      department_id: null,
    });

    expect(result).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test.each([
    ["events"],
    ["events_bergen"],
  ])("a Bergen campus admin may create a topic announcement with value %p", async (value) => {
    currentCtx = bergenAdminCtx;
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "topic",
      audience_value: value,
      campus_id: "2",
      department_id: null,
    });

    expect(result).toEqual({ data: expect.any(String) });
  });

  test("global admin: bare topic with no campus is fine, general as a topic is not", async () => {
    currentCtx = globalAdminCtx;
    const ok = await createAnnouncement({
      ...departmentValues,
      audience_type: "topic",
      audience_value: "events",
      campus_id: null,
      department_id: null,
    });
    expect(ok).toEqual({ data: expect.any(String) });
    const bad = await createAnnouncement({
      ...departmentValues,
      audience_type: "topic",
      audience_value: "general",
      campus_id: null,
      department_id: null,
    });
    expect(bad).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
  });

  test("a campus admin who owns the campus can't broadcast to all campuses (policy)", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["campus-oslo", "5"],
      resolvedCampusIds: ["campus-oslo"],
      roles: ["campusadmin"],
    });
    const result = await createAnnouncement({
      ...departmentValues,
      campus_id: "5",
      department_id: null,
    });

    expect(result).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("a campus admin can't message a group from a campus they don't manage", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    db.listRows.mockImplementation((_d: string, tableId: string) => {
      if (tableId === "event_segments") {
        return {
          rows: [{ $id: "seg-1", campus_id: "1", event_id: "event-1" }],
          total: 1,
        };
      }
      if (tableId === "events") {
        return { rows: [{ $id: "event-1", campus_id: "5" }], total: 1 };
      }
      return { rows: [], total: 0 };
    });
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "segment",
      audience_value: "seg-1",
      campus_id: "2",
      department_id: null,
    });

    expect(result).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("a campus admin can message their own campus's group on a National event", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["1"],
      resolvedCampusIds: ["1"],
      roles: ["campusadmin"],
    });
    db.listRows.mockImplementation((_d: string, tableId: string) => {
      if (tableId === "event_segments") {
        return {
          rows: [{ $id: "seg-1", campus_id: "1", event_id: "event-1" }],
          total: 1,
        };
      }
      if (tableId === "events") {
        return { rows: [{ $id: "event-1", campus_id: "5" }], total: 1 };
      }
      return { rows: [], total: 0 };
    });
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "segment",
      audience_value: "seg-1",
      campus_id: "1",
      department_id: null,
    });

    expect(result).toEqual({ data: expect.any(String) });
  });

  test("a segment announcement needs an existing segment", async () => {
    currentCtx = globalAdminCtx;
    const result = await createAnnouncement({
      ...departmentValues,
      audience_type: "segment",
      audience_value: "missing",
      campus_id: null,
      department_id: null,
    });

    expect(result).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
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
    currentCtx = campusAdminCtx;
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
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("department members can't send", async () => {
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

    expect(result).toEqual({ error: SEND_FORBIDDEN_MESSAGE });
  });

  test("a sent announcement can't be sent again", async () => {
    currentCtx = globalAdminCtx;
    mockAnnouncementRow({
      $id: "announcement-1",
      audience_type: "broadcast",
      audience_value: null,
      campus_id: "1",
      category: "general",
      data: null,
      push: true,
      scheduled_at: null,
      status: "sent",
      title_en: "English title",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: ALREADY_SENT_MESSAGE });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test.each([
    ["general"],
    ["events_national"],
    ["events_oslo"],
  ])("sending a stored topic row with value %p is refused for a Bergen admin", async (value) => {
    currentCtx = bergenAdminCtx;
    mockAnnouncementRow({
      $id: "announcement-1",
      audience_type: "topic",
      audience_value: value,
      campus_id: "2",
      category: "general",
      data: null,
      push: true,
      scheduled_at: null,
      status: "draft",
      title_en: "English title",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: AUDIENCE_FORBIDDEN_MESSAGE });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a campus admin can send their own campus's announcement", async () => {
    currentCtx = campusAdminCtx;
    mockAnnouncementRow({
      $id: "announcement-1",
      audience_type: "broadcast",
      audience_value: null,
      campus: { $id: "campus-oslo" },
      campus_id: "campus-oslo",
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
