import { expect, mock } from "bun:test";

export const sessionDb = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

export const adminDb = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

export const createAdminClientSpy = mock(async () => ({ db: adminDb }));
export const assertRecruitmentVacancyWriteAccessSpy = mock(() => undefined);
export const assertWriteAccessSpy = mock(() => undefined);

export const translateContentFieldsSpy = mock(
  async ({ sourceLocale }: { sourceLocale: "en" | "no" }) =>
    sourceLocale === "no"
      ? {
          description: "<p>English description</p>",
          short_description: "English teaser",
          title: "English title",
        }
      : {
          description: "<p>Norsk beskrivelse</p>",
          short_description: "Norsk ingress",
          title: "Norsk tittel",
        }
);

export let deferredTask: (() => Promise<void>) | undefined;
export let primaryWriteCompleted = false;

export const scheduleContentTranslationSpy = mock(
  ({ enabled, task }: { enabled: boolean; task: () => Promise<void> }) => {
    expect(primaryWriteCompleted).toBeTrue();
    if (enabled) {
      deferredTask = task;
    }
    return enabled;
  }
);

mock.module("@repo/api/server", () => ({
  createAdminClient: createAdminClientSpy,
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({ userId: "editor-1" })),
}));

mock.module("@/lib/recruitment", () => ({
  assertRecruitmentApplicationReviewAccess: mock(() => undefined),
  assertRecruitmentVacancyWriteAccess: assertRecruitmentVacancyWriteAccessSpy,
  buildJobRowPermissions: mock(() => ['read("any")']),
  buildRecruitmentApplicationRecord: mock((value: unknown) => value),
  canReviewRecruitmentVacancy: mock(() => true),
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
  toRecruitmentAdminScope: mock(() => ({})),
}));

mock.module("@/lib/utils/authorization", () => ({
  applyScopeQueries: mock(() => []),
  assertPublishAccess: mock(() => undefined),
  assertWriteAccess: assertWriteAccessSpy,
  hasRowAccess: mock(() => true),
}));

mock.module("@/lib/content-translation.server", () => ({
  parseAutoTranslationOptions: (value: unknown) => value,
  scheduleContentTranslation: scheduleContentTranslationSpy,
  translateContentFields: translateContentFieldsSpy,
}));

mock.module("@/lib/announcements/send", () => ({
  dispatchAnnouncement: mock(async () => undefined),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

export const resetTranslationHarness = (): void => {
  deferredTask = undefined;
  primaryWriteCompleted = false;
  for (const db of [sessionDb, adminDb]) {
    db.createRow.mockReset();
    db.deleteRow.mockReset();
    db.listRows.mockReset();
    db.updateRow.mockReset();
    db.upsertRow.mockReset();
  }
  adminDb.getRow.mockReset();
  sessionDb.listRows.mockImplementation(async () => ({ rows: [], total: 0 }));
  adminDb.upsertRow.mockImplementation(() => {
    primaryWriteCompleted = true;
    return { $id: "job-1" };
  });
  adminDb.getRow.mockImplementation(
    async (_databaseId: string, tableId: string) =>
      tableId === "events"
        ? {
            campus_id: "campus-oslo",
            department_id: null,
            member_only: false,
            status: "draft",
          }
        : {
            campus_id: "campus-oslo",
            department_id: null,
            metadata: JSON.stringify({ audience: "public" }),
            status: "draft",
          }
  );
  sessionDb.createRow.mockImplementation(
    (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      if (tableId === "events") {
        primaryWriteCompleted = true;
        return { $id: "event-1", ...data };
      }
      return { $id: rowId, ...data };
    }
  );
  createAdminClientSpy.mockClear();
  assertRecruitmentVacancyWriteAccessSpy.mockReset();
  assertRecruitmentVacancyWriteAccessSpy.mockImplementation(() => undefined);
  assertWriteAccessSpy.mockReset();
  assertWriteAccessSpy.mockImplementation(() => undefined);
  scheduleContentTranslationSpy.mockClear();
  translateContentFieldsSpy.mockClear();
};
