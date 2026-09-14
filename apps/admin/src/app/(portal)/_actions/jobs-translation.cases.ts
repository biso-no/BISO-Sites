import { beforeEach, describe, expect, test } from "bun:test";
import { JobsStatus } from "@repo/api/types/appwrite";
import type { RecruitmentVacancyUpsertInput } from "@repo/shared/types/recruitment";
import {
  adminDb,
  afterSpy,
  assertRecruitmentVacancyWriteAccessSpy,
  createAdminClientSpy,
  deferredTask,
  resetTranslationHarness,
  scheduleContentTranslationSpy,
  sessionDb,
} from "./jobs-translation-test-harness";

const PRIMARY_FAILED_WITH_REF = /^primary failed \(ref [0-9a-f]{8}\)$/;
const NOTHING_SAVED_WITH_REF = /Nothing was saved.*\(ref [0-9a-f]{8}\)/;

const { createJob, generateJobTranslationDraft, updateJob } = await import(
  "./jobs"
);

const jobValues: RecruitmentVacancyUpsertInput = {
  application_deadline: null,
  audience: "public",
  auto_screen: true,
  auto_translate: false,
  campus_id: "campus-oslo",
  commitment: null,
  company: null,
  contact_email: null,
  contact_name: null,
  contact_role: null,
  cover_image_file_id: null,
  cover_image_url: null,
  cover_pattern: null,
  custom_questions: [],
  cv_required: false,
  department_id: null,
  description_en: "<p>English source</p>",
  description_no: "<p>Norsk kilde</p>",
  employment_type: null,
  interview_template: { rounds: [] },
  location: null,
  newsletter: false,
  paid: false,
  publication_mode: "now",
  push_to_inboxes: false,
  scheduled_publish_at: null,
  screening_rubric: { criteria: [], must_have: [], nice_to_have: [] },
  short_description_en: "English source teaser",
  short_description_no: "Norsk kildeingress",
  slug: "student-role",
  start_date: null,
  status: JobsStatus.DRAFT,
  tags: [],
  term: null,
  title_en: "English source title",
  title_no: "Norsk kildetittel",
};

beforeEach(resetTranslationHarness);

describe("job translation adapter", () => {
  test("denies manual translation outside the editor's vacancy scope", async () => {
    assertRecruitmentVacancyWriteAccessSpy.mockImplementationOnce(() => {
      throw new Error("Unauthorized: no write access to this vacancy");
    });

    const result = await generateJobTranslationDraft({
      campusId: "campus-other",
      description: "<p>Source</p>",
      departmentId: null,
      sourceLocale: "en",
      title: "Source",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this vacancy",
    });
  });

  test("maps every Norwegian source field to an English draft", async () => {
    const result = await generateJobTranslationDraft({
      campusId: "campus-oslo",
      description: "<p>Norsk kilde</p>",
      departmentId: null,
      shortDescription: "Norsk ingress",
      sourceLocale: "no",
      title: "Norsk tittel",
    });

    expect(result).toEqual({
      data: {
        description_en: "<p>English description</p>",
        short_description_en: "English teaser",
        title_en: "English title",
      },
    });
  });

  test("maps every English source field to a Norwegian draft", async () => {
    const result = await generateJobTranslationDraft({
      campusId: "campus-oslo",
      description: "<p>English source</p>",
      departmentId: null,
      shortDescription: "English teaser",
      sourceLocale: "en",
      title: "English title",
    });

    expect(result).toEqual({
      data: {
        description_no: "<p>Norsk beskrivelse</p>",
        short_description_no: "Norsk ingress",
        title_no: "Norsk tittel",
      },
    });
  });
});

describe("job auto-translation scheduling", () => {
  test("does not schedule when auto-translation is disabled", async () => {
    const result = await createJob(jobValues, {
      enabled: false,
      sourceLocale: "en",
    });

    expect(result).toEqual({ data: "job-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("does not schedule from an empty selected source locale", async () => {
    const result = await createJob(
      {
        ...jobValues,
        description_en: "",
        short_description_en: "",
        title_en: "",
      },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "job-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("does not schedule from an incomplete selected source locale", async () => {
    const result = await createJob(
      {
        ...jobValues,
        description_en: "",
        short_description_en: "English teaser only",
      },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "job-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("keeps the deferred destination inside the one-way parent relation", async () => {
    adminDb.listRows.mockImplementationOnce(async () => ({
      rows: [
        {
          $id: "source-en",
          description: "<p>English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
      ],
      total: 1,
    }));

    const result = await createJob(
      {
        ...jobValues,
        description_no: "",
        short_description_no: "",
        title_no: "",
      },
      {
        enabled: true,
        sourceLocale: "en",
      }
    );
    expect(result).toEqual({ data: "job-1", translationQueued: true });
    expect(deferredTask).toBeDefined();
    await deferredTask?.();

    expect(createAdminClientSpy).toHaveBeenCalledTimes(2);
    // The deferred write patches only `translations` on an existing job, so
    // it must go through updateRow (partial patch) — upsertRow validates as
    // a full-document replace and would reject this for a missing `slug`.
    expect(adminDb.updateRow).toHaveBeenLastCalledWith("app", "jobs", "job-1", {
      translations: [
        "source-en",
        expect.objectContaining({
          content_id: "job-1",
          content_type: "job",
          description: "<p>Norsk beskrivelse</p>",
          locale: "no",
          short_description: "Norsk ingress",
          title: "Norsk tittel",
        }),
      ],
    });
    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.upsertRow).toHaveBeenCalledTimes(1);
  });

  test("updates an existing destination in place through the parent relation", async () => {
    adminDb.listRows.mockImplementationOnce(async () => ({
      rows: [
        {
          $id: "source-en",
          description: "<p>English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
        {
          $id: "target-no",
          description: "<p>Norsk kilde</p>",
          locale: "no",
          short_description: "Norsk kildeingress",
          title: "Norsk kildetittel",
        },
      ],
      total: 2,
    }));

    await createJob(jobValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.updateRow).toHaveBeenLastCalledWith("app", "jobs", "job-1", {
      translations: [
        "source-en",
        expect.objectContaining({ $id: "target-no", locale: "no" }),
      ],
    });
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("skips a destination edited while the translation was running", async () => {
    adminDb.listRows.mockImplementationOnce(async () => ({
      rows: [
        {
          $id: "source-en",
          description: "<p>English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
        {
          // Hand-written between scheduling and now — newer than this save.
          $id: "target-no",
          description: "<p>Manuelt oversatt</p>",
          locale: "no",
          short_description: "Manuell ingress",
          title: "Manuell tittel",
        },
      ],
      total: 2,
    }));

    await createJob(jobValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips the destination write when the submitted source is stale", async () => {
    adminDb.listRows.mockImplementationOnce(async () => ({
      rows: [
        {
          $id: "source-en",
          description: "<p>Newer English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
      ],
      total: 1,
    }));

    await createJob(jobValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips the destination write when vacancy scope changes", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      department_id: null,
      metadata: JSON.stringify({ audience: "members" }),
      status: "draft",
    });

    await createJob(jobValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("does not schedule when the primary write fails", async () => {
    adminDb.upsertRow.mockImplementationOnce(() => {
      throw new Error("primary failed");
    });

    const result = await createJob(jobValues, {
      enabled: true,
      sourceLocale: "en",
    });

    expect(result).toEqual({
      error: expect.stringMatching(PRIMARY_FAILED_WITH_REF),
    });
    expect(scheduleContentTranslationSpy).not.toHaveBeenCalled();
  });
});

describe("job writes", () => {
  const storedQuestions = [
    {
      help_text: null,
      id: "q1",
      label: "Why BISO?",
      options: [],
      required: true,
      type: "long_text",
    },
  ];
  const storedTemplate = {
    rounds: [
      {
        agenda: null,
        default_duration_minutes: 45,
        default_panel_user_ids: [],
        id: "r1",
        title: "First interview",
      },
    ],
  };

  const stubStoredVacancy = () => {
    sessionDb.getRow.mockImplementation(async () => ({
      $createdAt: "2026-09-01T00:00:00.000Z",
      $id: "job-1",
      $updatedAt: "2026-09-01T00:00:00.000Z",
      application_deadline: null,
      auto_screen: true,
      campus_id: "campus-oslo",
      custom_questions: JSON.stringify(storedQuestions),
      department_id: null,
      interview_template: JSON.stringify(storedTemplate),
      metadata: JSON.stringify({ audience: "public" }),
      screening_rubric: null,
      slug: "student-role",
      status: "draft",
      translations: [],
    }));
  };

  const editorValues = () => {
    const {
      custom_questions: _customQuestions,
      interview_template: _interviewTemplate,
      ...rest
    } = jobValues;
    return rest;
  };

  test("keeps stored questions and interview rounds when the editor omits them", async () => {
    stubStoredVacancy();

    const result = await updateJob(
      "job-1",
      { ...editorValues(), title_en: "Renamed" },
      { enabled: false, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "job-1" });
    const payload = adminDb.upsertRow.mock.calls.at(-1)?.[3] as Record<
      string,
      unknown
    >;
    expect(JSON.parse(payload.custom_questions as string)).toEqual(
      storedQuestions
    );
    expect(JSON.parse(payload.interview_template as string)).toEqual(
      storedTemplate
    );
  });

  test("still writes questions when a caller sends them explicitly", async () => {
    stubStoredVacancy();

    await updateJob("job-1", jobValues, {
      enabled: false,
      sourceLocale: "en",
    });

    const payload = adminDb.upsertRow.mock.calls.at(-1)?.[3] as Record<
      string,
      unknown
    >;
    expect(JSON.parse(payload.custom_questions as string)).toEqual([]);
  });

  test("stores a date-only deadline as end of day in Oslo", async () => {
    await createJob(
      { ...jobValues, application_deadline: "2026-09-14" },
      { enabled: false, sourceLocale: "en" }
    );

    const payload = adminDb.upsertRow.mock.calls.at(-1)?.[3] as Record<
      string,
      unknown
    >;
    expect(payload.application_deadline).toBe("2026-09-14T21:59:59.999Z");
  });

  test("returns a named validation error instead of a generic one", async () => {
    const result = await createJob(
      { ...jobValues, short_description_en: "x".repeat(281) },
      { enabled: false, sourceLocale: "en" }
    );

    expect(result.error).toStartWith("short_description_en:");
    expect(adminDb.upsertRow).not.toHaveBeenCalled();
  });

  test("returns an error instead of rejecting when an Appwrite read times out", async () => {
    sessionDb.getRow.mockImplementation(() => {
      throw Object.assign(
        new Error("Appwrite request timed out after 8000ms"),
        {
          type: "appwrite_timeout",
        }
      );
    });

    const result = await updateJob("job-1", jobValues, {
      enabled: false,
      sourceLocale: "en",
    });

    expect(result.error).toMatch(NOTHING_SAVED_WITH_REF);
    expect(adminDb.upsertRow).not.toHaveBeenCalled();
  });

  test("records the audit event after the response", async () => {
    await createJob(jobValues, { enabled: false, sourceLocale: "en" });

    expect(afterSpy).toHaveBeenCalledTimes(1);
  });
});
