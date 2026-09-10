import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Announcements } from "@repo/api/types/appwrite";
import type { DispatchAnnouncementResult } from "@/lib/announcements/send";
import { resolveAnnouncementTopicId } from "@/lib/announcements/topic-id";
import type { UserAuthContext } from "@/lib/authorization";
import type { AnnouncementFormValues } from "./schemas";

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

const { sendAnnouncement, updateAnnouncement } = await import(
  "./announcements"
);

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

/**
 * The one announcement row the mocked table holds. `listRows` returns a copy
 * and `updateRow` merges into it, as Appwrite does, so a send that follows a
 * save reads back what the save wrote.
 */
let storedRow: Record<string, unknown> = {};

function mockAnnouncementRow(row: Record<string, unknown>): void {
  storedRow = { ...row };
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
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) =>
      tableId === "announcements"
        ? { rows: [{ ...storedRow }], total: 1 }
        : { rows: [], total: 0 }
  );
  db.updateRow.mockImplementation(
    (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown> | undefined
    ) => {
      if (data) {
        storedRow = { ...storedRow, ...data };
      }
      return Promise.resolve({ $id: rowId, ...storedRow });
    }
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

/** A topic announcement as dispatch leaves it: sent, its topic resolved. */
const sentTopicRow = {
  ...baseRow,
  audience_value: "events_oslo",
  sent_at: "2026-09-01T00:00:00.000Z",
  status: "sent",
};

/**
 * What the composer submits when it saves one of these rows. It edits a
 * stored "events_oslo" as the logical "events" (`buildInitialValues` applies
 * `logicalTopicFor`), and a save sends the form as it stands.
 */
function composerValues(
  overrides: Partial<AnnouncementFormValues> = {}
): AnnouncementFormValues {
  return {
    audience_type: "topic",
    audience_value: "events",
    body_en: null,
    body_no: null,
    campus_id: "1",
    category: "general",
    department_id: null,
    event_id: null,
    push: true,
    scheduled_at: null,
    title_en: "Title",
    title_no: null,
    ...overrides,
  };
}

// The in-app inbox reads sent rows with no campus filter of its own. It scopes
// a topic row by campus, and honours students' opt-outs, only when
// `audience_value` is campus-scoped; a bare "events" is shown to every campus.
describe("updateAnnouncement keeps a sent topic announcement campus-scoped", () => {
  test("a save with nothing changed keeps the campus-scoped topic id", async () => {
    mockAnnouncementRow(sentTopicRow);

    const result = await updateAnnouncement("announcement-1", composerValues());

    expect(result).toEqual({ data: "announcement-1" });
    expect(storedRow).toMatchObject({
      audience_type: "topic",
      audience_value: "events_oslo",
      campus_id: "1",
      status: "sent",
    });
  });

  test("a save that moves it to another campus scopes the topic to that campus", async () => {
    mockAnnouncementRow(sentTopicRow);

    await updateAnnouncement(
      "announcement-1",
      composerValues({ campus_id: "2" })
    );

    expect(storedRow).toMatchObject({
      audience_value: "events_bergen",
      campus_id: "2",
      status: "sent",
    });
  });

  test("switching a sent broadcast to a topic stores a campus-scoped id", async () => {
    mockAnnouncementRow({
      ...sentTopicRow,
      audience_type: "broadcast",
      audience_value: null,
    });

    await updateAnnouncement(
      "announcement-1",
      composerValues({ audience_value: "jobs" })
    );

    expect(storedRow).toMatchObject({
      audience_type: "topic",
      audience_value: "jobs_oslo",
      status: "sent",
    });
  });

  test("goes by the stored row's status, not one the caller supplies", async () => {
    mockAnnouncementRow(sentTopicRow);

    await updateAnnouncement("announcement-1", {
      ...composerValues({ campus_id: "2" }),
      status: "draft",
    } as AnnouncementFormValues);

    expect(storedRow).toMatchObject({
      audience_value: "events_bergen",
      status: "sent",
    });
  });

  test("Send's save scopes the row before dispatch reads it, and the send keeps it scoped", async () => {
    mockAnnouncementRow(sentTopicRow);

    // The composer's Send saves, then sends. With auto-translate on, the send
    // is queued behind a translation that can be dropped as stale, in which
    // case dispatch never runs — so the save alone must leave the row scoped.
    await updateAnnouncement(
      "announcement-1",
      composerValues({ campus_id: "2" })
    );
    expect(storedRow).toMatchObject({ audience_value: "events_bergen" });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ data: { recipients: 0, status: "sent" } });
    expect(dispatchAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        audience_value: "events_bergen",
        campus_id: "2",
      }),
      expect.anything()
    );
    expect(storedRow).toMatchObject({
      audience_value: "events_bergen",
      status: "sent",
    });
  });
});

describe("updateAnnouncement leaves an unsent topic announcement logical", () => {
  // The inbox never reads these, and dispatch resolves the topic against the
  // campus the row has when it goes out, then writes the scoped id back.
  test.each([
    "draft",
    "scheduled",
  ])("a %s announcement keeps the logical topic", async (status) => {
    mockAnnouncementRow({ ...baseRow, audience_value: "events", status });

    await updateAnnouncement(
      "announcement-1",
      composerValues({ campus_id: "2" })
    );

    expect(storedRow).toMatchObject({
      audience_value: "events",
      campus_id: "2",
      status,
    });
  });
});
