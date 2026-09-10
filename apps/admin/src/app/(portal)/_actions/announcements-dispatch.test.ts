import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Announcements } from "@repo/api/types/appwrite";
import type { DispatchAnnouncementResult } from "@/lib/announcements/send";
import { resolveAnnouncementTopicId } from "@/lib/announcements/topic-id";
import type { UserAuthContext } from "@/lib/authorization";

// `announcements.ts` transitively imports `@/lib/announcements/send`, which
// starts with `import "server-only"`. Neutralized here the same way
// `approvals.test.ts` and `announcements-relationships.test.ts` do it.
mock.module("server-only", () => ({}));

const db = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
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

/**
 * What the real `dispatchAnnouncement` reports for a row, without delivering
 * anything: the topic the real `resolveAnnouncementTopicId` resolves from the
 * row's own `audience_value` and `campus_id`, and only for a TOPIC audience
 * (see `DispatchAnnouncementResult`). The ids these tests expect are produced
 * by that resolution rather than dictated by the stub, so a broken resolver —
 * or a row that reaches dispatch with the wrong audience or campus — fails
 * them. The resolver lives outside the mocked `send` module for this reason.
 */
function resolveLikeDispatch(
  announcement: Announcements
): DispatchAnnouncementResult {
  if (announcement.audience_type !== "topic") {
    return { recipients: 0 };
  }
  return {
    recipients: 0,
    topic: resolveAnnouncementTopicId(
      announcement.audience_value,
      announcement.campus_id
    ),
  };
}

const dispatchAnnouncement = mock(
  async (announcement: Announcements): Promise<DispatchAnnouncementResult> =>
    resolveLikeDispatch(announcement)
);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
}));
mock.module("@/lib/announcements/send", () => ({
  buildDeepLink: mock(() => "biso://announcements/announcement-1"),
  dispatchAnnouncement,
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { sendAnnouncement } = await import("./announcements");

const baseRow = {
  $id: "announcement-1",
  audience_type: "topic",
  audience_value: "events",
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

function mockAnnouncementRow(row: Record<string, unknown>): void {
  db.listRows.mockResolvedValue({ rows: [row], total: 1 });
}

/** The `db.updateRow` call that actually flips status to "sent" — a separate
 * call also sets row-level read permissions and carries no `status`. */
function findSentUpdate(): Record<string, unknown> | undefined {
  const call = db.updateRow.mock.calls.find(
    (c) => (c[3] as Record<string, unknown> | undefined)?.status === "sent"
  );
  return call?.[3] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  dispatchAnnouncement.mockReset();
  dispatchAnnouncement.mockImplementation(async (announcement) =>
    resolveLikeDispatch(announcement)
  );
  db.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown> | undefined
    ) => ({ $id: rowId, ...data })
  );
});

describe("dispatchPersistedAnnouncement persists the resolved topic", () => {
  test("persists the campus-scoped topic id for a topic announcement", async () => {
    mockAnnouncementRow({
      ...baseRow,
      audience_value: "events",
      campus_id: "1",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ data: { recipients: 0, status: "sent" } });
    expect(findSentUpdate()).toEqual(
      expect.objectContaining({ audience_value: "events_oslo" })
    );
  });

  test("persists the national scope when campus_id is null", async () => {
    mockAnnouncementRow({
      ...baseRow,
      audience_value: "events",
      campus_id: null,
    });

    await sendAnnouncement("announcement-1");

    expect(findSentUpdate()).toEqual(
      expect.objectContaining({ audience_value: "events_national" })
    );
  });

  test("does not write audience_value for a broadcast announcement, even when dispatch reports a topic", async () => {
    // The real dispatch never reports a topic for a broadcast. This one does,
    // so the only thing keeping it off the row is the `audience_type ===
    // "topic"` check where the sent row is written.
    dispatchAnnouncement.mockResolvedValueOnce({
      recipients: 0,
      topic: "general",
    });
    mockAnnouncementRow({
      ...baseRow,
      audience_type: "broadcast",
      audience_value: null,
    });

    await sendAnnouncement("announcement-1");

    const sentUpdate = findSentUpdate();
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate).not.toHaveProperty("audience_value");
  });

  test("keeps an already campus-scoped audience_value unchanged on re-dispatch", async () => {
    mockAnnouncementRow({
      ...baseRow,
      audience_value: "events_oslo",
      campus_id: "1",
    });

    await sendAnnouncement("announcement-1");

    expect(findSentUpdate()).toEqual(
      expect.objectContaining({ audience_value: "events_oslo" })
    );
  });
});
