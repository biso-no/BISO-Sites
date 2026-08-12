import { beforeEach, describe, expect, test } from "bun:test";
import { JobsStatus } from "@repo/api/types/appwrite";
import type { RecruitmentVacancyUpsertInput } from "@repo/shared/types/recruitment";
import {
  adminDb,
  assertRecruitmentVacancyWriteAccessSpy,
  createAdminClientSpy,
  deferredTask,
  resetTranslationHarness,
  scheduleContentTranslationSpy,
} from "./jobs-translation-test-harness";

const { createJob, generateJobTranslationDraft } = await import("./jobs");

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
    expect(adminDb.upsertRow).toHaveBeenLastCalledWith("app", "jobs", "job-1", {
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
    expect(adminDb.updateRow).not.toHaveBeenCalled();
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

    expect(adminDb.upsertRow).toHaveBeenLastCalledWith("app", "jobs", "job-1", {
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

    expect(result).toEqual({ error: "primary failed" });
    expect(scheduleContentTranslationSpy).not.toHaveBeenCalled();
  });
});
