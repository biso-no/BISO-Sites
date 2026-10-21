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
  managedCampusIds: ["2"],
  name: "Oslo Admin",
  resolvedCampusIds: ["2"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

/** Department membership alone grants no benefit access. */
const departmentAuthorContext: UserAuthContext = {
  ...campusAdminContext,
  departmentNames: ["Marketing"],
  departmentTeamIds: ["sg-app-dept-marketing"],
  email: "author@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Marketing Author",
  resolvedDepartmentIds: ["dept-marketing"],
  roles: ["department"],
  userId: "user-2",
};

const requireAuth = mock(async () => campusAdminContext);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
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

const { createBenefit, generateBenefitTranslationDraft, updateBenefit } =
  await import("./benefits");

const norwegianValues: BenefitFormValues = {
  campus_id: "2",
  category: "food_drink",
  description_en: "",
  description_nb: "<p>Norsk beskrivelse</p>",
  image_url: null,
  is_featured: false,
  partner_id: null,
  publish_end: null,
  publish_start: null,
  redemption_type: "none",
  redemption_value: null,
  section: "member",
  status: "draft",
  terms_en: null,
  terms_nb: null,
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

  // The row as a save of `norwegianValues` leaves it: an empty English
  // title falls back to the Norwegian one until the translation lands.
  benefitRow = {
    $id: "benefit-1",
    campus_id: "2",
    description_en: null,
    description_nb: "<p>Norsk beskrivelse</p>",
    section: "member",
    sort_order: 0,
    status: "draft",
    title_en: "Norsk tittel",
    title_nb: "Norsk tittel",
  };
  adminDb.upsertRow.mockImplementation(
    (
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
      campusId: "3",
      description: "<p>Source</p>",
      sourceLocale: "en",
      title: "Source",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("denies Hele BISO to a campus admin", async () => {
    const result = await generateBenefitTranslationDraft({
      campusId: "5",
      description: "<p>Norsk beskrivelse</p>",
      sourceLocale: "no",
      title: "Norsk tittel",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("denies a department member without benefit access", async () => {
    requireAuth.mockImplementationOnce(async () => departmentAuthorContext);

    const result = await generateBenefitTranslationDraft({
      campusId: "2",
      description: "<p>Norsk beskrivelse</p>",
      sourceLocale: "no",
      title: "Norsk tittel",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("maps Norwegian and English drafts in both directions", async () => {
    const english = await generateBenefitTranslationDraft({
      campusId: "2",
      description: "<p>Norsk beskrivelse</p>",
      sourceLocale: "no",
      title: "Norsk tittel",
    });
    const norwegian = await generateBenefitTranslationDraft({
      campusId: "2",
      description: "<p>English description</p>",
      sourceLocale: "en",
      title: "English title",
    });

    expect(english).toEqual({
      data: {
        description: "<p>English description</p>",
        title: "English title",
      },
    });
    expect(norwegian).toEqual({
      data: {
        description: "<p>Norsk beskrivelse</p>",
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
        title: "English title",
      }),
      []
    );
    const mirrored = adminDb.createRow.mock.calls[0]?.[3] as Record<
      string,
      unknown
    >;
    expect("short_description" in mirrored).toBe(false);
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

  test("queues a source that has a title and no description", async () => {
    const result = await createBenefit(
      { ...norwegianValues, description_nb: "" },
      enabledNorwegianTranslation
    );

    expect(result).toEqual({ data: "benefit-1", translationQueued: true });
  });

  test("does not queue incomplete selected source content", async () => {
    const result = await createBenefit(
      { ...norwegianValues, description_en: "English description only" },
      { enabled: true, sourceLocale: "en" }
    );

    expect(scheduleContentTranslation).not.toHaveBeenCalled();
    expect(result).toEqual({ data: "benefit-1" });
  });

  test("skips a destination edited while the translation was running", async () => {
    await updateBenefit(
      "benefit-1",
      norwegianValues,
      enabledNorwegianTranslation
    );
    expect(scheduledTasks).toHaveLength(1);

    // Hand-written English between scheduling and now — newer than this save.
    benefitRow = {
      ...benefitRow,
      description_en: "<p>Hand-written English</p>",
      title_en: "Hand-written English title",
    };
    await scheduledTasks[0]?.();

    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).not.toHaveBeenCalled();
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
