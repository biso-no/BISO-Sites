import { describe, expect, test } from "bun:test";
import { type NewsFormValues, newsSchema } from "../../../_actions/schemas";
import {
  applyNewsTranslationDraft,
  createNewsStudioDefaults,
  getNewsArticleEditorState,
  getNewsEditorInteractionProps,
  getNewsSavedValues,
  getNewsStepCompletion,
  getNewsTranslationDraftSource,
  getNewsTranslationInputs,
  reconcileNewsSavedState,
  refreshNewsDepartments,
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
  test("extracts the active locale as the manual translation source", () => {
    const values = {
      ...createValues(),
      description_en: "English body",
      title_en: "English title",
    };

    expect(getNewsTranslationDraftSource(values, "no")).toEqual({
      description: "Norsk brødtekst",
      title: "Norsk tittel",
    });
    expect(getNewsTranslationDraftSource(values, "en")).toEqual({
      description: "English body",
      title: "English title",
    });
  });

  test("applies a manual draft only to the destination locale", () => {
    const values = createValues();

    expect(
      applyNewsTranslationDraft(values, "no", {
        description: "English body",
        title: "English title",
      })
    ).toEqual({
      ...values,
      description_en: "English body",
      title_en: "English title",
    });
    expect(
      applyNewsTranslationDraft(values, "en", {
        description: "Norsk oversettelse",
        title: "Norsk overskrift",
      })
    ).toEqual({
      ...values,
      description_no: "Norsk oversettelse",
      title_no: "Norsk overskrift",
    });
  });

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

  test("treats an empty editor document as an empty optional locale", () => {
    const values = {
      ...createValues(),
      description_en: JSON.stringify([{ children: [{ text: "" }], type: "p" }]),
      status: "published" as const,
    };

    expect(newsSchema.safeParse(values).success).toBeTrue();
    expect(getNewsTranslationInputs(values)).toEqual([
      {
        description: "Norsk brødtekst",
        locale: "no",
        title: "Norsk tittel",
      },
    ]);
  });

  test("keeps a media-only locale in translation inputs", () => {
    const values = {
      ...createValues(),
      description_en: JSON.stringify([
        {
          children: [{ text: "" }],
          type: "img",
          url: "https://example.com/image.jpg",
        },
      ]),
    };

    expect(getNewsTranslationInputs(values)).toEqual([
      {
        description: "Norsk brødtekst",
        locale: "no",
        title: "Norsk tittel",
      },
      {
        description: JSON.stringify([
          {
            children: [{ text: "" }],
            type: "img",
            url: "https://example.com/image.jpg",
          },
        ]),
        locale: "en",
        title: "",
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

  test("preserves edits made after a save starts", () => {
    const submittedValues = createValues();
    const currentValues = {
      ...submittedValues,
      title_no: "Edited while saving",
    };

    expect(
      reconcileNewsSavedState({
        currentValues,
        hasConcurrentEdits: true,
        status: "published",
        submittedValues,
      })
    ).toEqual({
      dirty: true,
      values: {
        ...currentValues,
        status: "published",
      },
    });
  });

  test("locks the editing surface only while creating an article", () => {
    expect(getNewsEditorInteractionProps(true, "draft")).toEqual({
      "aria-busy": true,
      inert: true,
    });
    expect(getNewsEditorInteractionProps(false, "draft")).toEqual({
      "aria-busy": false,
      inert: false,
    });
    expect(getNewsEditorInteractionProps(true, null)).toEqual({
      "aria-busy": false,
      inert: false,
    });
  });

  test("clears dirty state when no edits happened during save", () => {
    const submittedValues = createValues();

    expect(
      reconcileNewsSavedState({
        currentValues: submittedValues,
        hasConcurrentEdits: false,
        status: "published",
        submittedValues,
      })
    ).toEqual({
      dirty: false,
      values: {
        ...submittedValues,
        status: "published",
      },
    });
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

  test("does not complete the article step for an empty editor document", () => {
    const values = {
      ...createValues(),
      description_no: JSON.stringify([
        { children: [{ text: "  " }], type: "p" },
      ]),
    };

    expect(getNewsStepCompletion(values, "no")).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  test("ignores departments returned by an earlier campus lookup", async () => {
    let resolveOslo: (departments: string[]) => void = () => undefined;
    let resolveBergen: (departments: string[]) => void = () => undefined;
    const oslo = new Promise<string[]>((resolve) => {
      resolveOslo = resolve;
    });
    const bergen = new Promise<string[]>((resolve) => {
      resolveBergen = resolve;
    });
    const requestSequence = { current: 0 };
    const appliedDepartments: string[][] = [];
    const loadDepartments = (campusId: string): Promise<string[]> =>
      campusId === "campus-oslo" ? oslo : bergen;
    const setDepartments = (departments: string[]): void => {
      appliedDepartments.push(departments);
    };

    const osloRequest = refreshNewsDepartments({
      campusId: "campus-oslo",
      loadDepartments,
      requestSequence,
      setDepartments,
    });
    const bergenRequest = refreshNewsDepartments({
      campusId: "campus-bergen",
      loadDepartments,
      requestSequence,
      setDepartments,
    });
    resolveBergen(["bergen-department"]);
    await bergenRequest;
    resolveOslo(["oslo-department"]);
    await osloRequest;

    expect(appliedDepartments).toEqual([[], [], ["bergen-department"]]);
  });

  test("clears stale departments when the current lookup fails", async () => {
    let departments = ["old-department"];
    const requestSequence = { current: 0 };
    let rejectLookup: (error: Error) => void = () => undefined;
    const lookup = new Promise<string[]>((_resolve, reject) => {
      rejectLookup = reject;
    });

    const request = refreshNewsDepartments({
      campusId: "campus-bergen",
      loadDepartments: () => lookup,
      requestSequence,
      setDepartments: (nextDepartments) => {
        departments = nextDepartments;
      },
    });

    expect(departments).toEqual([]);
    rejectLookup(new Error("Lookup failed"));
    await request;
    expect(departments).toEqual([]);
  });
});
