import { describe, expect, test } from "bun:test";
import { newsSchema } from "../../../_actions/schemas";
import {
  createNewsStudioDefaults,
  getNewsTranslationInputs,
} from "./news-studio-state";

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
});
