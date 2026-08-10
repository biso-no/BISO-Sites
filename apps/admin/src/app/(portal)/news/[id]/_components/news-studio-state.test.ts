import { describe, expect, test } from "bun:test";
import { type NewsFormValues, newsSchema } from "../../../_actions/schemas";
import {
  createNewsStudioDefaults,
  getNewsArticleEditorState,
  getNewsSavedValues,
  getNewsStepCompletion,
  getNewsTranslationInputs,
} from "./news-studio-state";

const createValues = (): NewsFormValues => ({
  author: null,
  campus_id: "campus-oslo",
  category: null,
  department_id: null,
  description_en: "",
  description_no: "Norsk brødtekst",
  image: "",
  slug: "student-news",
  status: "draft",
  sticky: false,
  title_en: "",
  title_no: "Norsk tittel",
});

describe("news studio state", () => {
  test("maps translations by locale rather than row order", () => {
    const article = {
      $id: "news-1",
      author: "BISO",
      campus_id: "campus-oslo",
      department_id: null,
      image: null,
      slug: "student-news",
      status: "draft",
      sticky: false,
      translation_refs: [
        {
          additional_fields: JSON.stringify({ category: "general" }),
          description: "English body",
          locale: "en",
          title: "English title",
        },
        {
          additional_fields: JSON.stringify({ category: "general" }),
          description: "Norsk brødtekst",
          locale: "no",
          title: "Norsk tittel",
        },
      ],
    };

    const values = createNewsStudioDefaults(
      article as never,
      [{ $id: "campus-oslo", name: "Oslo" }] as never,
      "campus-oslo"
    );

    expect(values.title_no).toBe("Norsk tittel");
    expect(values.title_en).toBe("English title");
    expect(values.description_no).toBe("Norsk brødtekst");
    expect(values.description_en).toBe("English body");
  });

  test("keeps a missing locale empty for a legacy article", () => {
    const values = createNewsStudioDefaults(
      {
        campus_id: "campus-oslo",
        translation_refs: [{ locale: "no", title: "Bare norsk" }],
      } as never,
      [] as never,
      "campus-oslo"
    );

    expect(values.title_no).toBe("Bare norsk");
    expect(values.title_en).toBe("");
    expect(getNewsTranslationInputs(values)).toEqual([
      {
        description: "",
        locale: "no",
        title: "Bare norsk",
      },
    ]);
  });

  test("requires a headline in at least one locale", () => {
    const result = newsSchema.safeParse({
      author: null,
      campus_id: "campus-oslo",
      category: null,
      department_id: null,
      description_en: "",
      description_no: "",
      image: "",
      slug: "student-news",
      status: "draft",
      sticky: false,
      title_en: "",
      title_no: "",
    });

    expect(result.success).toBeFalse();
  });

  test("requires a headline for every populated locale when publishing", () => {
    const values = {
      ...createValues(),
      description_en: "English body without a title",
      status: "published" as const,
    };

    const publishedResult = newsSchema.safeParse(values);
    const draftResult = newsSchema.safeParse({ ...values, status: "draft" });

    expect(publishedResult.success).toBeFalse();
    if (!publishedResult.success) {
      expect(publishedResult.error.flatten().fieldErrors.title_en).toEqual([
        "An English headline is required when English content is provided",
      ]);
    }
    expect(draftResult.success).toBeTrue();
  });

  test("uses category metadata from the locale that defines it", () => {
    const values = createNewsStudioDefaults(
      {
        campus_id: "campus-oslo",
        translation_refs: [
          {
            additional_fields: JSON.stringify({}),
            locale: "no",
            title: "Norsk tittel",
          },
          {
            additional_fields: JSON.stringify({ category: "press" }),
            locale: "en",
            title: "English title",
          },
        ],
      } as never,
      [] as never,
      "campus-oslo"
    );

    expect(values.category).toBe("press");
  });

  test("synchronizes local status with the successful submission", () => {
    const values = createValues();

    expect(getNewsSavedValues(values, "published")).toEqual({
      ...values,
      status: "published",
    });
    expect(values.status).toBe("draft");
  });

  test("switching to a missing locale creates a fresh empty editor state", () => {
    const values = createValues();

    expect(getNewsArticleEditorState(values, "no")).toEqual({
      editorKey: "no",
      value: "Norsk brødtekst",
    });
    expect(getNewsArticleEditorState(values, "en")).toEqual({
      editorKey: "en",
      value: "",
    });
  });

  test("derives step completion from content rather than visited steps", () => {
    const values = createValues();

    expect(getNewsStepCompletion(values, "no")).toEqual([
      true,
      true,
      false,
      false,
    ]);

    values.image = "https://example.com/cover.jpg";
    expect(getNewsStepCompletion(values, "no")).toEqual([
      true,
      true,
      true,
      true,
    ]);

    expect(getNewsStepCompletion(values, "en")).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
});
