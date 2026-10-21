import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
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
  getGroupById,
  getPeopleByIds,
  getLinkedContentPrefill,
  listEventsWithGroups,
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
    expect(queriesOf()).toContain(
      Query.search("translation_refs.title", "aut")
    );
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
    expect(queriesOf()).toContain(Query.limit(8));
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
    expect(prefill).toMatchObject({
      title_en: "Autumn party",
      title_no: "Høstfest",
      body_en: "<p>Come along</p>",
      body_no: "",
      topic: "events",
      campusId: "2",
      label: "Autumn party (Fri 23 Oct)",
    });
    expect(prefill?.item).toMatchObject({
      campusName: "Bergen",
      dateLabel: "Fri 23 Oct",
      id: "e1",
      title: "Autumn party",
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

  const mixedGroups = [
    { $id: "bergen", name: "Bergen bus", member_count: 4, campus_id: "2" },
    { $id: "oslo", name: "Oslo bus", member_count: 5, campus_id: "1" },
    { $id: "none", name: "Crew", member_count: 6, campus_id: null },
  ];

  function mockEvent(campusId: string) {
    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve(
        table === "events"
          ? { rows: [{ $id: "e1", campus_id: campusId }], total: 1 }
          : { rows: [], total: 0 }
      )
    );
  }

  test("a campus admin on a National event sees only their campus's groups", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    listSegments.mockResolvedValue(mixedGroups);
    mockEvent("5");
    expect((await listGroupsForEvent("e1")).map((group) => group.id)).toEqual([
      "bergen",
    ]);
  });

  test("a campus-less group on the admin's own campus event is offered", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    listSegments.mockResolvedValue(mixedGroups);
    mockEvent("2");
    expect((await listGroupsForEvent("e1")).map((group) => group.id)).toEqual([
      "bergen",
      "none",
    ]);
  });

  test("a global admin sees every group", async () => {
    listSegments.mockResolvedValue(mixedGroups);
    mockEvent("5");
    expect((await listGroupsForEvent("e1")).map((group) => group.id)).toEqual([
      "bergen",
      "oslo",
      "none",
    ]);
  });
});

describe("listEventsWithGroups", () => {
  function mockEventsWithGroups() {
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "event_segments") {
        return Promise.resolve({
          rows: [
            { $id: "s1", event_id: "national-oslo-only", campus_id: "1" },
            { $id: "s2", event_id: "national-mixed", campus_id: "1" },
            { $id: "s3", event_id: "national-mixed", campus_id: "2" },
            { $id: "s4", event_id: "bergen-event", campus_id: null },
          ],
        });
      }
      return Promise.resolve({
        rows: [
          { $id: "national-oslo-only", campus_id: "5", translation_refs: [] },
          { $id: "national-mixed", campus_id: "5", translation_refs: [] },
          { $id: "bergen-event", campus_id: "2", translation_refs: [] },
        ],
      });
    });
  }

  test("a campus admin is not offered an event with only other campuses' groups", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    mockEventsWithGroups();
    expect((await listEventsWithGroups("")).map((event) => event.id)).toEqual([
      "national-mixed",
      "bergen-event",
    ]);
  });

  test("a global admin is offered every event with groups", async () => {
    mockEventsWithGroups();
    expect((await listEventsWithGroups("")).map((event) => event.id)).toEqual([
      "national-oslo-only",
      "national-mixed",
      "bergen-event",
    ]);
  });
});

describe("getGroupById", () => {
  function mockGroup(eventCampus: string, groupCampus: string | null = null) {
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "event_segments") {
        return Promise.resolve({
          rows: [{ $id: "s1", event_id: "e1", campus_id: groupCampus }],
        });
      }
      if (table === "segment_members") {
        return Promise.resolve({ rows: [], total: 34 });
      }
      return Promise.resolve({
        rows: [
          {
            $id: "e1",
            campus_id: eventCampus,
            translation_refs: [{ locale: "en", title: "Trondheim trip" }],
          },
        ],
      });
    });
    db.getRow.mockResolvedValue({
      $id: "s1",
      campus_id: groupCampus,
      event_id: "e1",
      name: "Bus 2",
    });
  }

  test("names the group and its event, with the event's campus", async () => {
    mockGroup("3");
    expect(await getGroupById("s1")).toEqual({
      campusId: "3",
      eventId: "e1",
      eventTitle: "Trondheim trip",
      groupId: "s1",
      groupName: "Bus 2",
      memberCount: 34,
    });
  });

  test("a group on another campus's event is out of scope", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    mockGroup("1");
    expect(await getGroupById("s1")).toBeNull();
  });

  test("a campus admin cannot read a group whose own campus is another one", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    mockGroup("2", "1");
    expect(await getGroupById("s1")).toBeNull();
  });

  test("a campus admin cannot read a group on a National event", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    mockGroup("5");
    expect(await getGroupById("s1")).toBeNull();
  });

  test("a campus admin can read a group on their own campus", async () => {
    currentCtx = {
      ...baseCtx,
      roles: ["campusadmin"],
      managedCampusIds: ["2"],
    };
    mockGroup("2");
    expect((await getGroupById("s1"))?.groupName).toBe("Bus 2");
  });

  test("a global admin reads groups on any campus or National events", async () => {
    mockGroup("2", "1");
    expect((await getGroupById("s1"))?.campusId).toBe("1");
    mockGroup("5");
    expect((await getGroupById("s1"))?.campusId).toBe("5");
  });

  test("a missing group is null", async () => {
    db.listRows.mockResolvedValue({ rows: [] });
    expect(await getGroupById("nope")).toBeNull();
  });

  test("a department user gets null", async () => {
    currentCtx = { ...baseCtx, roles: ["department"] };
    expect(await getGroupById("s1")).toBeNull();
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

describe("getPeopleByIds", () => {
  test("an empty list makes no db call", async () => {
    expect(await getPeopleByIds([])).toEqual([]);
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

describe("getAudienceReach audience checks", () => {
  const campusAdmin = (): UserAuthContext => ({
    ...baseCtx,
    roles: ["campusadmin"],
    managedCampusIds: ["2"],
  });

  test("users reach counts the ids", async () => {
    const reach = await getAudienceReach({
      audienceType: "users",
      audienceValue: null,
      campusId: null,
      userIds: ["a", "b", "c"],
    });
    expect(reach).toEqual({ count: 3, sentence: "3 people" });
  });

  test("broadcast to another campus is unavailable for a campus admin", async () => {
    currentCtx = campusAdmin();
    const reach = await getAudienceReach({
      audienceType: "broadcast",
      audienceValue: null,
      campusId: "1",
    });
    expect(reach.count).toBeNull();
    expect(listSubscribers).not.toHaveBeenCalled();
  });

  function mockSegment(eventCampus: string) {
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "event_segments") {
        return Promise.resolve({
          rows: [{ $id: "s1", event_id: "e1", campus_id: null }],
        });
      }
      if (table === "events") {
        return Promise.resolve({
          rows: [{ $id: "e1", campus_id: eventCampus }],
        });
      }
      return Promise.resolve({ rows: [], total: 7 });
    });
    db.getRow.mockResolvedValue({ $id: "s1", name: "Crew" });
  }
  const segmentReq = {
    audienceType: "segment" as const,
    audienceValue: "s1",
    campusId: null,
  };

  test("a campus-less group uses its event's campus", async () => {
    currentCtx = campusAdmin();
    mockSegment("2");
    expect(await getAudienceReach(segmentReq)).toEqual({
      count: 7,
      sentence: "7 people in Crew",
    });
  });

  test("a campus-less group on another campus's event is refused", async () => {
    currentCtx = campusAdmin();
    mockSegment("1");
    expect((await getAudienceReach(segmentReq)).count).toBeNull();
  });

  test("a missing segment is unavailable", async () => {
    db.listRows.mockResolvedValue({ rows: [] });
    expect((await getAudienceReach(segmentReq)).count).toBeNull();
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
