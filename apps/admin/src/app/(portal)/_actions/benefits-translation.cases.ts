import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { AutoTranslationOptions } from "@/lib/content-translation";
import type { BenefitFormValues } from "./schemas";

const events: string[] = [];
const sessionDb = {
  createRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const adminDb = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

// Mutable current benefit row served for campus_benefits lookups.
let benefitRow: Record<string, unknown>;
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
    description:
      targetLocale === "en"
        ? "<p>English description</p>"
        : "<p>Norsk beskrivelse</p>",
    teaser: targetLocale === "en" ? "English teaser" : "Norsk ingress",
    title: targetLocale === "en" ? "English title" : "Norsk tittel",
  })
);

const campusAdminContext: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Oslo Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

const requireAuth = mock(async () => campusAdminContext);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));

mock.module("@/lib/authorization", () => ({ requireAuth }));

mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
}));

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

const { createBenefit, generateBenefitTranslationDraft, updateBenefit } =
  await import("./benefits");

const norwegianValues: BenefitFormValues = {
  campus_id: "campus-oslo",
  category: "Career",
  description_en: "",
  description_nb: "<p>Norsk beskrivelse</p>",
  image_url: null,
  is_featured: false,
  is_member_only: true,
  kind: "offer",
  partner_name: null,
  publish_end: null,
  publish_start: null,
  redemption_type: "none",
  redemption_value: null,
  sort_order: 0,
  status: "draft",
  teaser_en: null,
  teaser_nb: "Norsk ingress",
  title_en: "",
  title_nb: "Norsk tittel",
};

const enabledNorwegianTranslation: AutoTranslationOptions = {
  enabled: true,
  sourceLocale: "no",
};

beforeEach(() => {
  events.length = 0;
  scheduledTasks.length = 0;
  requireAuth.mockClear();
  scheduleContentTranslation.mockClear();
  translateContentFields.mockClear();
  sessionDb.createRow.mockReset();
  sessionDb.listRows.mockReset();
  sessionDb.updateRow.mockReset();
  adminDb.createRow.mockReset();
  adminDb.deleteRow.mockReset();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.upsertRow.mockReset();

  benefitRow = {
    $id: "benefit-1",
    campus_id: "campus-oslo",
    description_en: "",
    description_nb: "<p>Norsk beskrivelse</p>",
    is_member_only: true,
    status: "draft",
    teaser_en: null,
    teaser_nb: "Norsk ingress",
    title_en: "",
    title_nb: "Norsk tittel",
  };
  adminDb.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      _rowId: string,
      data: Record<string, unknown>
    ) => {
      events.push("create");
      return { $id: "benefit-1", ...data };
    }
  );
  adminDb.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) =>
      tableId === "campus_benefits"
        ? { rows: [benefitRow], total: 1 }
        : { rows: [], total: 0 }
  );
  adminDb.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.updateRow.mockResolvedValue({ $id: "benefit-1" });
});

describe("benefit manual translation", () => {
  test("denies manual translation outside the editor's benefit scope", async () => {
    const result = await generateBenefitTranslationDraft({
      campusId: "campus-other",
      description: "<p>Source</p>",
      sourceLocale: "en",
      teaser: "Source teaser",
      title: "Source",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("maps Norwegian and English drafts in both directions", async () => {
    const english = await generateBenefitTranslationDraft({
      campusId: "campus-oslo",
      description: "<p>Norsk beskrivelse</p>",
      sourceLocale: "no",
      teaser: "Norsk ingress",
      title: "Norsk tittel",
    });
    const norwegian = await generateBenefitTranslationDraft({
      campusId: "campus-oslo",
      description: "<p>English description</p>",
      sourceLocale: "en",
      teaser: "English teaser",
      title: "English title",
    });

    expect(english).toEqual({
      data: {
        description: "<p>English description</p>",
        teaser: "English teaser",
        title: "English title",
      },
    });
    expect(norwegian).toEqual({
      data: {
        description: "<p>Norsk beskrivelse</p>",
        teaser: "Norsk ingress",
        title: "Norsk tittel",
      },
    });
    expect(translateContentFields.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ sourceLocale: "no", targetLocale: "en" })
    );
    expect(translateContentFields.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ sourceLocale: "en", targetLocale: "no" })
    );
    expect(requireAuth).toHaveBeenCalledTimes(2);
  });
});

describe("benefit automatic translation", () => {
  test("honors publish status when creating a benefit", async () => {
    await createBenefit(
      { ...norwegianValues, status: "published" },
      { enabled: false, sourceLocale: "no" }
    );

    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.any(String),
      expect.objectContaining({ status: "published" }),
      expect.any(Array)
    );
  });

  test("schedules only after a successful create and writes destination columns", async () => {
    const result = await createBenefit(
      norwegianValues,
      enabledNorwegianTranslation
    );

    expect(result).toEqual({ data: "benefit-1", translationQueued: true });
    expect(events).toEqual(["create", "schedule"]);
    expect(scheduledTasks).toHaveLength(1);

    await scheduledTasks[0]?.();

    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      "benefit-1",
      {
        description_en: "<p>English description</p>",
        teaser_en: "English teaser",
        title_en: "English title",
      }
    );
    // The destination is mirrored into a linked content_translations child.
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      expect.any(String),
      expect.objectContaining({
        content_id: "benefit-1",
        content_type: "memberBenefit",
        locale: "en",
        memberBenefit: "benefit-1",
        short_description: "English teaser",
        title: "English title",
      }),
      expect.any(Array)
    );
  });

  test("does not schedule when automatic translation is disabled", async () => {
    await createBenefit(norwegianValues, {
      enabled: false,
      sourceLocale: "no",
    });

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
  });

  test("does not queue an empty selected source locale", async () => {
    const result = await createBenefit(norwegianValues, {
      enabled: true,
      sourceLocale: "en",
    });

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(result).toEqual({ data: "benefit-1" });
  });

  test("does not queue incomplete selected source content", async () => {
    const result = await createBenefit(
      { ...norwegianValues, description_en: "English description only" },
      { enabled: true, sourceLocale: "en" }
    );

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(result).toEqual({ data: "benefit-1" });
  });

  test("skips the destination write when the submitted source is stale", async () => {
    await updateBenefit(
      "benefit-1",
      norwegianValues,
      enabledNorwegianTranslation
    );
    expect(scheduledTasks).toHaveLength(1);

    benefitRow = {
      ...benefitRow,
      description_nb: "<p>Changed after save</p>",
    };
    await scheduledTasks[0]?.();

    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });
});
