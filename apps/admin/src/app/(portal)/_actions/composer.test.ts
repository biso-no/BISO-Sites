import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

mock.module("server-only", () => ({}));

const db = { getRow: mock(), listRows: mock() };
const listSubscribers = mock();
const listSegments = mock();

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({
    db,
    messaging: { listSubscribers },
    users: {},
  })),
}));

const baseCtx: UserAuthContext = {
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
  roles: ["globaladmin"],
  userId: "u1",
};
let currentCtx: UserAuthContext = baseCtx;

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));
mock.module("./event-segments", () => ({ listSegments }));

const {
  getAudienceReach,
  getLinkedContentPrefill,
  listGroupsForEvent,
  searchLinkableContent,
  searchPeople,
} = await import("./composer");
const { reachSentence } = await import("@/lib/announcements/composer-lookups");

const eventRow = {
  $id: "e1",
  status: "draft",
  campus_id: "2",
  start_date: "2026-10-23T16:00:00.000Z",
  image: null,
  translation_refs: [
    { locale: "no", title: "Høstfest" },
    { locale: "en", title: "Autumn party", short_description: "Come along" },
  ],
};

function queriesOf(callIndex = 0): string[] {
  return db.listRows.mock.calls[callIndex][2] as string[];
}

beforeEach(() => {
  currentCtx = baseCtx;
  db.listRows.mockReset();
  db.getRow.mockReset();
  listSubscribers.mockReset();
  listSegments.mockReset();
});

describe("searchLinkableContent", () => {
  test("fulltext-searches translation titles across campuses and maps drafts", async () => {
    db.listRows.mockResolvedValue({ rows: [eventRow] });
    const items = await searchLinkableContent("event", "aut");
    expect(queriesOf().join("|")).toContain("translation_refs.title");
    expect(queriesOf().join("|")).toContain("search");
    expect(items).toEqual([
      {
        id: "e1",
        type: "event",
        title: "Autumn party",
        date: "2026-10-23T16:00:00.000Z",
        dateLabel: "Fri 23 Oct",
        campusId: "2",
        campusName: "Bergen",
        image: null,
        status: "draft",
        linkable: false,
      },
    ]);
  });

  test("an empty query lists the newest on the admin's own campuses", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    db.listRows.mockResolvedValue({ rows: [] });
    await searchLinkableContent("news", "");
    const joined = queriesOf().join("|");
    expect(joined).toContain("campus.$id");
    expect(joined).not.toContain("search");
    expect(joined).toContain("8");
  });

  test("a department ctx gets empty results without a db call", async () => {
    currentCtx = { ...baseCtx, roles: ["department"] };
    expect(await searchLinkableContent("event", "aut")).toEqual([]);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  test("jobs search the translations relationship and label the deadline", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        {
          $id: "j1",
          status: "published",
          campus_id: "2",
          application_deadline: "2026-11-03T10:00:00.000Z",
          translations: [{ locale: "no", title: "Markedsfører" }],
        },
      ],
    });
    const [item] = await searchLinkableContent("job", "mark");
    expect(queriesOf().join("|")).toContain("translations.title");
    expect(item.dateLabel).toBe("Apply by 3 Nov");
    expect(item.title).toBe("Markedsfører");
    expect(item.linkable).toBe(true);
  });
});

describe("getLinkedContentPrefill", () => {
  test("builds titles, bodies, topic and label", async () => {
    db.listRows.mockResolvedValue({ rows: [eventRow] });
    const prefill = await getLinkedContentPrefill("event", "e1");
    expect(prefill).toEqual({
      title_en: "Autumn party",
      title_no: "Høstfest",
      body_en: "<p>Come along</p>",
      body_no: "",
      topic: "events",
      campusId: "2",
      label: "Autumn party (Fri 23 Oct)",
    });
  });

  test("cuts a plain-text description to 300 chars", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        {
          ...eventRow,
          translation_refs: [
            {
              locale: "en",
              title: "T",
              description: `<p>${"a".repeat(500)}</p>`,
            },
          ],
        },
      ],
    });
    const prefill = await getLinkedContentPrefill("event", "e1");
    expect(prefill?.body_en).toBe(`<p>${"a".repeat(300)}</p>`);
  });
});

describe("searchPeople", () => {
  test("a 1-char query returns [] without a db call", async () => {
    expect(await searchPeople("k")).toEqual([]);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  test("maps matches to PersonResult", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "p1", name: "Kari", email: "kari@bi.no", campus_id: "2" }],
    });
    expect(await searchPeople("kari")).toEqual([
      { id: "p1", name: "Kari", email: "kari@bi.no", campusName: "Bergen" },
    ]);
    expect(db.listRows.mock.calls[0][1]).toBe("user");
  });
});

describe("listGroupsForEvent", () => {
  test("maps segments", async () => {
    listSegments.mockResolvedValue([
      { $id: "s1", name: "Volunteers", member_count: 4, campus_id: "2" },
    ]);
    expect(await listGroupsForEvent("e1")).toEqual([
      { id: "s1", name: "Volunteers", memberCount: 4, campusId: "2" },
    ]);
  });
});

describe("getAudienceReach", () => {
  test("topic events at Bergen sums both languages", async () => {
    listSubscribers.mockImplementation(
      async ({ topicId }: { topicId: string }) => ({
        subscribers: [],
        total: topicId === "events_bergen_no" ? 30 : 12,
      })
    );
    const reach = await getAudienceReach({
      audienceType: "topic",
      audienceValue: "events",
      campusId: "2",
    });
    expect(reach).toEqual({
      count: 42,
      sentence: "Bergen students who follow Events.",
    });
  });

  test("a null language count gives an unavailable reach", async () => {
    listSubscribers.mockImplementation(
      async ({ topicId }: { topicId: string }) =>
        topicId.endsWith("_en") ? { subscribers: [] } : { total: 5 }
    );
    const reach = await getAudienceReach({
      audienceType: "broadcast",
      audienceValue: null,
      campusId: "1",
    });
    expect(reach).toEqual({
      count: null,
      sentence: "Reach unavailable right now",
    });
  });
});

describe("reachSentence", () => {
  const base = { audienceValue: null, campusId: null, count: 5 };
  test("every audience shape", () => {
    expect(
      reachSentence({ ...base, audienceType: "broadcast", campusId: "2" })
    ).toBe("Everyone at Bergen.");
    expect(reachSentence({ ...base, audienceType: "broadcast" })).toBe(
      "Everyone, at all campuses."
    );
    expect(
      reachSentence({ ...base, audienceType: "topic", audienceValue: "events" })
    ).toBe("Students who follow Events, at all campuses.");
    expect(
      reachSentence({
        ...base,
        audienceType: "topic",
        audienceValue: "events",
        campusId: "2",
      })
    ).toBe("Bergen students who follow Events.");
    expect(reachSentence({ ...base, audienceType: "users" })).toBe("5 people");
    expect(
      reachSentence({ ...base, audienceType: "segment", groupName: "Crew" })
    ).toBe("5 people in Crew");
    expect(reachSentence({ ...base, audienceType: "topic", count: null })).toBe(
      "Reach unavailable right now"
    );
  });
});
