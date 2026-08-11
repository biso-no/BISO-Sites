import { beforeEach, describe, expect, test } from "bun:test";
import {
  EventsCoverPattern,
  EventsLocationMode,
  EventsPricingMode,
  EventsPublishMode,
  EventsStatus,
} from "@repo/api/types/appwrite";
import type { EventUpsertInput } from "@repo/shared/types/events";
import {
  adminDb,
  assertWriteAccessSpy,
  deferredTask,
  resetTranslationHarness,
  scheduleContentTranslationSpy,
  sessionDb,
} from "./jobs-translation-test-harness";

const { createEvent, generateEventTranslationDraft } = await import("./events");

const eventValues: EventUpsertInput = {
  campus_id: "campus-oslo",
  capacity: 100,
  category: null,
  contact_email: null,
  contact_name: null,
  contact_role: null,
  cover_pattern: EventsCoverPattern.DOTTED,
  department_id: null,
  description_en: "<p>English source</p>",
  description_no: "<p>Norsk kilde</p>",
  end_date: null,
  image: null,
  is_collection: false,
  location: null,
  location_mode: EventsLocationMode.PHYSICAL,
  member_only: false,
  member_price: null,
  notify_push: false,
  online_url: null,
  price: null,
  pricing_mode: EventsPricingMode.FREE,
  publish_mode: EventsPublishMode.NOW,
  registration_deadline: null,
  scheduled_publish_at: null,
  short_description_en: "English source teaser",
  short_description_no: "Norsk kildeingress",
  slug: "student-event",
  start_date: null,
  status: EventsStatus.DRAFT,
  tags: [],
  ticket_url: null,
  title_en: "English source title",
  title_no: "Norsk kildetittel",
  waitlist: false,
};

beforeEach(resetTranslationHarness);

describe("event translation adapter", () => {
  test("denies manual translation outside the editor's event scope", async () => {
    assertWriteAccessSpy.mockImplementationOnce(() => {
      throw new Error("Unauthorized: no write access to this campus");
    });

    const result = await generateEventTranslationDraft({
      campusId: "campus-other",
      description: "<p>Source</p>",
      departmentId: null,
      sourceLocale: "en",
      title: "Source",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
  });

  test("maps every Norwegian source field to an English draft", async () => {
    const result = await generateEventTranslationDraft({
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
    const result = await generateEventTranslationDraft({
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

describe("event auto-translation scheduling", () => {
  test("honors publish status when creating an event", async () => {
    await createEvent(
      { ...eventValues, status: EventsStatus.PUBLISHED },
      { enabled: false, sourceLocale: "en" }
    );

    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "events",
      expect.any(String),
      expect.objectContaining({ status: EventsStatus.PUBLISHED }),
      expect.any(Array)
    );
  });

  test("persists ownership and both nested locales in one write", async () => {
    await createEvent(eventValues, { enabled: false, sourceLocale: "en" });

    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "events",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        department: null,
        translation_refs: expect.arrayContaining([
          expect.objectContaining({
            $permissions: expect.any(Array),
            content_type: "event",
            locale: "no",
            title: "Norsk kildetittel",
          }),
          expect.objectContaining({
            content_type: "event",
            locale: "en",
            title: "English source title",
          }),
        ]),
      }),
      expect.any(Array)
    );
    expect(sessionDb.createRow).not.toHaveBeenCalled();
  });

  test("does not schedule when auto-translation is disabled", async () => {
    const result = await createEvent(eventValues, {
      enabled: false,
      sourceLocale: "en",
    });

    expect(result).toEqual({ data: "event-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("does not schedule from an empty selected source locale", async () => {
    const result = await createEvent(
      {
        ...eventValues,
        description_en: "",
        short_description_en: "",
        title_en: "",
      },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "event-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("does not schedule without a title in the selected source locale", async () => {
    const result = await createEvent(
      { ...eventValues, title_en: "" },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "event-1" });
    expect(deferredTask).toBeUndefined();
  });

  test("schedules after persistence and links only the destination locale", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      department_id: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "source-en",
          description: "<p>English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
      ],
    });
    adminDb.createRow.mockImplementation(async () => ({
      $id: "translation-no",
    }));

    const result = await createEvent(eventValues, {
      enabled: true,
      sourceLocale: "en",
    });
    expect(result).toEqual({ data: "event-1", translationQueued: true });
    expect(deferredTask).toBeDefined();
    await deferredTask?.();

    expect(adminDb.createRow).toHaveBeenCalledTimes(1);
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      expect.any(String),
      expect.objectContaining({
        content_id: "event-1",
        content_type: "event",
        description: "<p>Norsk beskrivelse</p>",
        event_ref: "event-1",
        locale: "no",
        short_description: "Norsk ingress",
        title: "Norsk tittel",
      }),
      expect.any(Array)
    );
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("updates an already linked destination without relinking it", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      department_id: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "source-en",
          description: "<p>English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
        {
          $id: "target-no",
          description: "<p>Gammel norsk</p>",
          locale: "no",
          short_description: "Gammel ingress",
          title: "Gammel tittel",
        },
      ],
    });

    await createEvent(eventValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "target-no",
      expect.objectContaining({ locale: "no", title: "Norsk tittel" }),
      expect.any(Array)
    );
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("skips the destination write when the submitted source is stale", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      department_id: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "source-en",
          description: "<p>Newer English source</p>",
          locale: "en",
          short_description: "English source teaser",
          title: "English source title",
        },
      ],
    });

    await createEvent(eventValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips the destination write when event visibility changes", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      department_id: null,
      member_only: true,
      status: "draft",
    });

    await createEvent(eventValues, { enabled: true, sourceLocale: "en" });
    await deferredTask?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("does not schedule when the primary write fails", async () => {
    adminDb.upsertRow.mockImplementationOnce(() => {
      throw new Error("primary failed");
    });

    const result = await createEvent(eventValues, {
      enabled: true,
      sourceLocale: "en",
    });

    expect(result).toEqual({ error: "primary failed" });
    expect(scheduleContentTranslationSpy).not.toHaveBeenCalled();
  });
});
