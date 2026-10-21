import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Announcements } from "@repo/api/types/appwrite";
import { resolvePushChannel } from "@repo/shared/utils/notification-topics";
import { ALREADY_SENT_MESSAGE } from "@/lib/announcements/audience-policy";
import type { DispatchAnnouncementResult } from "@/lib/announcements/send";
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
 * anything: the channel the real `resolvePushChannel` resolves from the row's
 * own `audience_type`, `audience_value` and `campus_id`, for a TOPIC or
 * BROADCAST audience only (see `DispatchAnnouncementResult`). The ids these
 * tests expect are produced by that resolution rather than dictated by the
 * stub, so a broken resolver — or a row that reaches dispatch with the wrong
 * audience or campus — fails them. The resolver lives outside the mocked
 * `send` module for this reason.
 */
function resolveLikeDispatch(
  announcement: Announcements
): DispatchAnnouncementResult {
  const channel = resolvePushChannel(
    announcement.audience_type,
    announcement.audience_value,
    announcement.campus_id
  );
  return channel === null
    ? { recipients: 0 }
    : { recipients: 0, topic: channel };
}

const dispatchAnnouncement = mock(
  async (announcement: Announcements): Promise<DispatchAnnouncementResult> =>
    resolveLikeDispatch(announcement)
);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
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

  test.each([
    ["1", "general_oslo"],
    ["5", "general"],
    [null, "general"],
  ])("persists the resolved channel for a broadcast announcement (campus %p)", async (campusId, channel) => {
    mockAnnouncementRow({
      ...baseRow,
      audience_type: "broadcast",
      audience_value: null,
      campus_id: campusId,
    });

    await sendAnnouncement("announcement-1");

    expect(findSentUpdate()).toEqual(
      expect.objectContaining({ audience_value: channel })
    );
  });

  test("does not write audience_value for a users announcement, even when dispatch reports a topic", async () => {
    // The real dispatch never reports a topic for people. This one does, so
    // the only thing keeping it off the row is the audience check where the
    // sent row is written.
    dispatchAnnouncement.mockResolvedValueOnce({
      recipients: 1,
      topic: "general",
    });
    mockAnnouncementRow({
      ...baseRow,
      audience_type: "users",
      audience_value: '["u1"]',
    });

    await sendAnnouncement("announcement-1");

    const sentUpdate = findSentUpdate();
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate).not.toHaveProperty("audience_value");
  });

  test("keeps an already campus-scoped audience_value unchanged on first dispatch", async () => {
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

  test("refuses to re-send a row that is already sent", async () => {
    mockAnnouncementRow({
      ...baseRow,
      audience_value: "events_oslo",
      campus_id: "1",
      status: "sent",
    });

    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: ALREADY_SENT_MESSAGE });
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
    expect(findSentUpdate()).toBeUndefined();
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

  test("Send's save scopes the row, and a re-send is refused", async () => {
    mockAnnouncementRow(sentTopicRow);

    // The composer's Send saves, then sends. With auto-translate on, the send
    // is queued behind a translation that can be dropped as stale, in which
    // case dispatch never runs — so the save alone must leave the row scoped.
    await updateAnnouncement(
      "announcement-1",
      composerValues({ campus_id: "2" })
    );
    expect(storedRow).toMatchObject({ audience_value: "events_bergen" });

    // A sent row is never delivered twice, so the save is what keeps it scoped.
    const result = await sendAnnouncement("announcement-1");

    expect(result).toEqual({ error: ALREADY_SENT_MESSAGE });
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
    expect(storedRow).toMatchObject({
      audience_value: "events_bergen",
      status: "sent",
    });
  });
});

/** A broadcast as dispatch leaves it: sent, its channel resolved. */
const sentBroadcastRow = {
  ...baseRow,
  audience_type: "broadcast",
  audience_value: "general_oslo",
  sent_at: "2026-09-01T00:00:00.000Z",
  status: "sent",
};

// The inbox filters sent broadcasts on the stored channel, so a save from the
// composer — which edits a broadcast with no audience value — must not wipe it.
describe("updateAnnouncement keeps a sent broadcast's channel", () => {
  test("a save with nothing changed keeps the stored channel", async () => {
    mockAnnouncementRow(sentBroadcastRow);

    await updateAnnouncement(
      "announcement-1",
      composerValues({ audience_type: "broadcast", audience_value: null })
    );

    expect(storedRow).toMatchObject({
      audience_type: "broadcast",
      audience_value: "general_oslo",
      status: "sent",
    });
  });

  test.each([
    ["2", "general_bergen"],
    [null, "general"],
  ])("a save that moves it to campus %p stores that campus's channel", async (campusId, channel) => {
    mockAnnouncementRow(sentBroadcastRow);

    await updateAnnouncement(
      "announcement-1",
      composerValues({
        audience_type: "broadcast",
        audience_value: null,
        campus_id: campusId,
      })
    );

    expect(storedRow).toMatchObject({
      audience_value: channel,
      campus_id: campusId,
      status: "sent",
    });
  });

  test("a draft broadcast keeps no stored channel", async () => {
    mockAnnouncementRow({
      ...baseRow,
      audience_type: "broadcast",
      audience_value: null,
    });

    await updateAnnouncement(
      "announcement-1",
      composerValues({ audience_type: "broadcast", audience_value: null })
    );

    expect(storedRow).toMatchObject({
      audience_type: "broadcast",
      audience_value: null,
      status: "draft",
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
