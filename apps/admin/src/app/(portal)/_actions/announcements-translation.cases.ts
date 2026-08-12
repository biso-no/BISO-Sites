import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { AutoTranslationOptions } from "@/lib/content-translation";
import type { AnnouncementFormValues } from "./schemas";

const events: string[] = [];
const db = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const messaging = {};
const users = {};
const scheduledTasks: Array<() => Promise<void>> = [];
const scheduleContentTranslation = mock(
  ({ enabled, task }: { enabled: boolean; task: () => Promise<void> }) => {
    if (!enabled) {
      return false;
    }
    events.push("schedule");
    scheduledTasks.push(task);
    return true;
  }
);
const translateContentFields = mock(
  async ({ targetLocale }: { targetLocale: "en" | "no" }) => ({
    body:
      targetLocale === "en" ? "<p>English body</p>" : "<p>Norsk brødtekst</p>",
    title: targetLocale === "en" ? "English title" : "Norsk tittel",
  })
);
const dispatchAnnouncement = mock(() => {
  events.push("dispatch");
  return { recipients: 4 };
});

const globalAdminContext: UserAuthContext = {
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

const requireAuth = mock(async () => globalAdminContext);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging, users })),
}));

mock.module("@/lib/announcements/send", () => ({
  buildDeepLink: mock(() => "biso://announcements/announcement-1"),
  dispatchAnnouncement,
}));

mock.module("@/lib/authorization", () => ({ requireAuth }));

mock.module("@/lib/content-translation.server", () => ({
  contentLocaleSchema: {
    safeParse: (value: unknown) => ({
      success: value === "no" || value === "en",
    }),
  },
  parseAutoTranslationOptions: (value: unknown) => value,
  scheduleContentTranslation,
  translateContentFields,
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const {
  createAnnouncement,
  generateAnnouncementTranslationDraft,
  sendAnnouncement,
  updateAnnouncement,
} = await import("./announcements");

const englishValues: AnnouncementFormValues = {
  audience_type: "broadcast",
  audience_value: null,
  body_en: "<p>English body</p>",
  body_no: null,
  campus_id: null,
  category: "general",
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "English title",
  title_no: null,
};

const enabledEnglishTranslation: AutoTranslationOptions = {
  enabled: true,
  sourceLocale: "en",
};

const announcementRow = {
  $id: "announcement-1",
  audience_type: "broadcast",
  audience_value: null,
  body_en: "<p>English body</p>",
  body_no: null,
  campus_id: null,
  category: "general",
  created_by: "user-1",
  data: null,
  deep_link: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  sent_at: null,
  status: "draft",
  title_en: "English title",
  title_no: null,
};

type MutableAnnouncementRow = Omit<
  typeof announcementRow,
  "audience_value" | "data" | "scheduled_at"
> & {
  audience_value: string | null;
  data: string | null;
  scheduled_at: string | null;
};

let currentAnnouncement: MutableAnnouncementRow = { ...announcementRow };

beforeEach(() => {
  events.length = 0;
  scheduledTasks.length = 0;
  requireAuth.mockClear();
  scheduleContentTranslation.mockClear();
  translateContentFields.mockClear();
  dispatchAnnouncement.mockClear();
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  currentAnnouncement = { ...announcementRow };

  db.createRow.mockImplementation(
    (
      _databaseId: string,
      _tableId: string,
      _rowId: string,
      data: Record<string, unknown>
    ) => {
      events.push("create");
      return { $id: "announcement-1", ...data };
    }
  );
  db.listRows.mockImplementation(async () => ({
    rows: [currentAnnouncement],
    total: 1,
  }));
  db.updateRow.mockImplementation(
    (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      if ("title_no" in data || "title_en" in data) {
        events.push("translation-write");
      }
      currentAnnouncement = { ...currentAnnouncement, ...data };
      return { ...currentAnnouncement, $id: rowId };
    }
  );
});

describe("announcement manual translation", () => {
  test("denies app-wide manual translation to non-global editors", async () => {
    requireAuth.mockImplementationOnce(async () => ({
      ...globalAdminContext,
      roles: ["campusadmin"],
    }));

    const result = await generateAnnouncementTranslationDraft({
      body: "<p>Source</p>",
      campusId: null,
      sourceLocale: "en",
      title: "Source",
    });

    expect(result).toEqual({
      error: "A campus is required for non-global admins.",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("allows a department author to translate their own department's announcement", async () => {
    requireAuth.mockImplementationOnce(async () => ({
      ...globalAdminContext,
      campusNames: ["Oslo"],
      departmentNames: ["Marketing"],
      departmentTeamIds: ["sg-app-dept-marketing"],
      resolvedCampusIds: ["campus-oslo"],
      resolvedDepartmentIds: ["dept-marketing"],
      roles: ["department"],
    }));

    const result = await generateAnnouncementTranslationDraft({
      body: "<p>English body</p>",
      campusId: "campus-oslo",
      departmentId: "dept-marketing",
      sourceLocale: "en",
      title: "English title",
    });

    expect(result).toEqual({
      data: { body: "<p>Norsk brødtekst</p>", title: "Norsk tittel" },
    });
  });

  test("denies a department author outside their department", async () => {
    requireAuth.mockImplementationOnce(async () => ({
      ...globalAdminContext,
      campusNames: ["Oslo"],
      departmentNames: ["Marketing"],
      departmentTeamIds: ["sg-app-dept-marketing"],
      resolvedCampusIds: ["campus-oslo"],
      resolvedDepartmentIds: ["dept-marketing"],
      roles: ["department"],
    }));

    const result = await generateAnnouncementTranslationDraft({
      body: "<p>English body</p>",
      campusId: "campus-oslo",
      departmentId: "dept-other",
      sourceLocale: "en",
      title: "English title",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("maps English and Norwegian drafts in both directions", async () => {
    const norwegian = await generateAnnouncementTranslationDraft({
      body: "<p>English body</p>",
      campusId: null,
      sourceLocale: "en",
      title: "English title",
    });
    const english = await generateAnnouncementTranslationDraft({
      body: "<p>Norsk brødtekst</p>",
      campusId: null,
      sourceLocale: "no",
      title: "Norsk tittel",
    });

    expect(norwegian).toEqual({
      data: { body: "<p>Norsk brødtekst</p>", title: "Norsk tittel" },
    });
    expect(english).toEqual({
      data: { body: "<p>English body</p>", title: "English title" },
    });
    expect(translateContentFields.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ sourceLocale: "en", targetLocale: "no" })
    );
    expect(translateContentFields.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ sourceLocale: "no", targetLocale: "en" })
    );
    expect(requireAuth).toHaveBeenCalledTimes(2);
  });
});

describe("announcement automatic translation", () => {
  test("schedules after create and updates only destination columns", async () => {
    const result = await createAnnouncement(
      englishValues,
      enabledEnglishTranslation
    );

    expect(result).toEqual({
      data: "announcement-1",
      translationQueued: true,
    });
    expect(events).toEqual(["create", "schedule"]);

    await scheduledTasks[0]?.();

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      "announcement-1",
      { body_no: "<p>Norsk brødtekst</p>", title_no: "Norsk tittel" }
    );
  });

  test("skips an automatic destination write for stale source content", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ ...announcementRow, title_en: "Changed after save" }],
      total: 1,
    });

    await updateAnnouncement(
      "announcement-1",
      englishValues,
      enabledEnglishTranslation
    );
    expect(scheduledTasks).toHaveLength(1);
    await scheduledTasks[0]?.();

    expect(db.updateRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "announcements",
      "announcement-1",
      expect.objectContaining({ title_no: expect.any(String) })
    );
  });

  test("skips a destination edited while the translation was running", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        {
          ...announcementRow,
          // Hand-written Norwegian between scheduling and now.
          body_no: "<p>Hand-written Norwegian</p>",
          title_no: "Hand-written Norwegian title",
        },
      ],
      total: 1,
    });

    await updateAnnouncement(
      "announcement-1",
      englishValues,
      enabledEnglishTranslation
    );
    expect(scheduledTasks).toHaveLength(1);
    db.updateRow.mockClear();
    await scheduledTasks[0]?.();

    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("does not queue an empty selected source locale", async () => {
    const result = await createAnnouncement(
      {
        ...englishValues,
        body_en: null,
        body_no: "<p>Norsk brødtekst</p>",
        title_en: "",
        title_no: "Norsk tittel",
      },
      enabledEnglishTranslation
    );

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(result).toEqual({ data: "announcement-1" });
  });

  test("does not queue without a title in the selected source locale", async () => {
    const result = await createAnnouncement(
      {
        ...englishValues,
        body_no: "<p>Norsk brødtekst uten tittel</p>",
        title_no: null,
      },
      { enabled: true, sourceLocale: "no" }
    );

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(result).toEqual({ data: "announcement-1" });
  });

  test("translates and persists before dispatch in one queued send callback", async () => {
    const result = await sendAnnouncement(
      "announcement-1",
      enabledEnglishTranslation
    );

    expect(result).toEqual({ data: { status: "queued" } });
    expect(scheduledTasks).toHaveLength(1);
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
    expect(currentAnnouncement.data).toContain("translation_pending");

    await scheduledTasks[0]?.();

    expect(events.indexOf("translation-write")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("translation-write")).toBeLessThan(
      events.indexOf("dispatch")
    );
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenLastCalledWith(
      "app",
      "announcements",
      "announcement-1",
      expect.objectContaining({ status: "sent" })
    );
  });

  test("only the latest queued send claim can dispatch", async () => {
    await sendAnnouncement("announcement-1", enabledEnglishTranslation);
    await sendAnnouncement("announcement-1", enabledEnglishTranslation);

    expect(scheduledTasks).toHaveLength(2);
    await scheduledTasks[0]?.();
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
    await scheduledTasks[1]?.();
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(1);
  });

  test("does not dispatch after delivery-critical fields change", async () => {
    await sendAnnouncement("announcement-1", enabledEnglishTranslation);
    currentAnnouncement = {
      ...currentAnnouncement,
      audience_type: "topic",
      audience_value: "changed-topic",
    };

    await scheduledTasks[0]?.();

    expect(dispatchAnnouncement).not.toHaveBeenCalled();
  });

  test("keeps scheduled delivery pending until translation succeeds", async () => {
    currentAnnouncement = {
      ...currentAnnouncement,
      scheduled_at: new Date(Date.now() + 60_000).toISOString(),
    };

    const result = await sendAnnouncement(
      "announcement-1",
      enabledEnglishTranslation
    );

    expect(result).toEqual({
      data: { status: "scheduled" },
      translationQueued: true,
    });
    expect(currentAnnouncement.status).toBe("scheduled");
    expect(currentAnnouncement.data).toContain("translation_pending");

    await scheduledTasks[0]?.();

    expect(currentAnnouncement.data).toBeNull();
    expect(dispatchAnnouncement).not.toHaveBeenCalled();
  });

  test("keeps the existing synchronous dispatch when auto-translation is off", async () => {
    const result = await sendAnnouncement("announcement-1", {
      enabled: false,
      sourceLocale: "en",
    });

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(dispatchAnnouncement).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: { recipients: 4, status: "sent" } });
  });
});
