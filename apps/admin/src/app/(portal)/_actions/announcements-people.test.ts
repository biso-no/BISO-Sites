import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { AnnouncementFormValues } from "./schemas";

// `announcements.ts` transitively imports `@/lib/announcements/send`, which
// starts with `import "server-only"`.
mock.module("server-only", () => ({}));

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

const dispatchAnnouncement = mock(async () => ({ recipients: 0 }));

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/announcements/send", () => ({
  buildPushData: mock(() => ({})),
  buildDeepLink: mock(() => "biso://announcements/announcement-1"),
  dispatchAnnouncement,
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createAnnouncement, sendAnnouncement, updateAnnouncement } =
  await import("./announcements");

const peopleValues: AnnouncementFormValues = {
  audience_type: "users",
  audience_value: null,
  body_en: "<p>Body</p>",
  body_no: null,
  campus_id: "1",
  category: "general",
  department_id: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "Title",
  title_no: null,
};

const storedPeopleRow = {
  $id: "announcement-1",
  audience_type: "users",
  audience_value: '["u1"]',
  campus: null,
  campus_id: "1",
  category: "general",
  data: null,
  deep_link: null,
  department: null,
  push: true,
  scheduled_at: null,
  status: "draft",
  title_en: "Title",
};

/** The one announcement row the mocked table holds. */
let storedRow: Record<string, unknown> = {};

function writtenAudienceValue(): unknown {
  const created = db.createRow.mock.calls[0]?.[3] as
    | Record<string, unknown>
    | undefined;
  const updated = db.updateRow.mock.calls[0]?.[3] as
    | Record<string, unknown>
    | undefined;
  return (created ?? updated)?.audience_value;
}

beforeEach(() => {
  storedRow = { ...storedPeopleRow };
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  dispatchAnnouncement.mockClear();
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) =>
      tableId === "announcements"
        ? { rows: [{ ...storedRow }], total: 1 }
        : { rows: [], total: 0 }
  );
  db.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      _rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: "announcement-1", ...data })
  );
  db.updateRow.mockImplementation(
    (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      storedRow = { ...storedRow, ...data };
      return Promise.resolve({ $id: rowId, ...storedRow });
    }
  );
});

// The people picker stores its ids as a JSON array; older drafts held
// comma-separated text. Both must land as the same JSON array of ids, or
// dispatch targets ids that don't exist and nobody gets the message.
describe("a Specific people audience stores the picked ids", () => {
  test("createAnnouncement keeps a JSON id array as those ids", async () => {
    const result = await createAnnouncement({
      ...peopleValues,
      audience_value: JSON.stringify(["u1", "u2"]),
    });

    expect(result).toEqual({ data: "announcement-1" });
    expect(writtenAudienceValue()).toBe('["u1","u2"]');
  });

  test("updateAnnouncement keeps a JSON id array as those ids", async () => {
    const result = await updateAnnouncement("announcement-1", {
      ...peopleValues,
      audience_value: JSON.stringify(["u1", "u2"]),
    });

    expect(result).toEqual({ data: "announcement-1" });
    expect(writtenAudienceValue()).toBe('["u1","u2"]');
  });

  test("legacy comma text still stores the ids", async () => {
    await createAnnouncement({ ...peopleValues, audience_value: "u1, u2" });

    expect(writtenAudienceValue()).toBe('["u1","u2"]');
  });

  test("an empty list saves as a draft with no ids", async () => {
    const result = await createAnnouncement({
      ...peopleValues,
      audience_value: "[]",
    });

    expect(result).toEqual({ data: "announcement-1" });
    expect(writtenAudienceValue()).toBe("[]");
  });
});

describe("sending to Specific people with nobody picked", () => {
  test.each([
    ["an empty id list", "[]"],
    ["no value", null],
    ["blank text", "  "],
  ])("is refused for %s", async (_label, audienceValue) => {
    storedRow = { ...storedPeopleRow, audience_value: audienceValue };

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: "Add at least one person." });
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a scheduled send with nobody picked is refused too", async () => {
    storedRow = {
      ...storedPeopleRow,
      audience_value: "[]",
      scheduled_at: "2999-01-01T08:00:00.000Z",
    };

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: "Add at least one person." });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a row with people goes out", async () => {
    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ data: { recipients: 0, status: "sent" } });
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(1);
  });
});
