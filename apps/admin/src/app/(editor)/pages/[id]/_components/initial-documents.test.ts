import { describe, expect, test } from "bun:test";
import type {
  PageEditorLoadResult,
  PageTranslationEditorEntry,
} from "@repo/api/page-builder";
import { emptyHeader } from "@repo/editor/templates";
import type { PageDoc } from "@repo/editor/types";
import {
  blankPageDoc,
  buildInitialDocuments,
  hasExistingContent,
  syncSharedMeta,
} from "./initial-documents";

const EDITOR_CAMPUS = "campus-editor";

function translation(
  locale: "no" | "en",
  patch: Partial<PageTranslationEditorEntry> = {}
): PageTranslationEditorEntry {
  return {
    description: "Om fadderuka",
    draftDocument: null,
    isPublished: true,
    locale,
    publishedAt: null,
    publishedDocument: null,
    title: "Fadderullan",
    ...patch,
  };
}

function existingPage(
  patch: Partial<PageEditorLoadResult["page"]> = {},
  translations: PageEditorLoadResult["translations"] = {
    no: translation("no"),
  }
): PageEditorLoadResult {
  return {
    availableLocales: ["no", "en"],
    page: {
      campusId: "campus-page",
      departmentId: "dept-1",
      id: "page-1",
      slug: "fadderullan",
      status: "published",
      visibility: "public",
      ...patch,
    },
    translations,
  } as PageEditorLoadResult;
}

describe("blankPageDoc", () => {
  test("an existing page without a document keeps its live title, description and scope", () => {
    // The editor saves this document on the first edit; placeholders here
    // would overwrite the live title, description and campus.
    const doc = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "no",
      page: existingPage().page,
      translation: translation("no"),
    });

    expect(doc.meta).toEqual({
      campus: "campus-page",
      department: "dept-1",
      description: "Om fadderuka",
      slug: "fadderullan",
      status: "published",
      title: "Fadderullan",
    });
    expect(doc.sections).toEqual([]);
  });

  test("a national page stays national, whatever the editor's campus", () => {
    const doc = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "no",
      page: existingPage({ campusId: null }).page,
      translation: translation("no"),
    });
    expect(doc.meta.campus).toBe("");
  });

  test("a new page gets the placeholder title and the editor's campus", () => {
    expect(
      blankPageDoc({ defaultCampusId: EDITOR_CAMPUS, locale: "no" }).meta
    ).toMatchObject({
      campus: EDITOR_CAMPUS,
      department: "",
      description: "",
      slug: "uten-navn",
      status: "draft",
      title: "Uten navn",
    });
    expect(
      blankPageDoc({ defaultCampusId: EDITOR_CAMPUS, locale: "en" }).meta.title
    ).toBe("Untitled page");
  });

  test("another locale shares the open document's meta and keeps its own title", () => {
    const source: PageDoc = {
      meta: {
        campus: "campus-chosen",
        department: "dept-2",
        slug: "renamed",
        status: "draft",
        title: "Fadderullan",
      },
      sections: [],
      version: 2,
    };
    const doc = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "en",
      page: existingPage().page,
      source,
      translation: translation("en", {
        description: "About freshers' week",
        title: "Buddy week",
      }),
    });
    expect(doc.meta).toEqual({
      campus: "campus-chosen",
      department: "dept-2",
      description: "About freshers' week",
      slug: "renamed",
      status: "draft",
      title: "Buddy week",
    });
  });
});

describe("a blank document starts with a page header", () => {
  test("a new page's header title stays empty while the page title is the placeholder", () => {
    // The site falls back to meta.title for the h1, so the placeholder is not
    // copied in: renaming the page later would otherwise leave "Uten navn".
    const doc = blankPageDoc({ defaultCampusId: EDITOR_CAMPUS, locale: "no" });
    expect(doc.header).toEqual(emptyHeader(""));
    expect(doc.meta.title).toBe("Uten navn");
    expect(doc.sections).toEqual([]);
  });

  test("/pages/new seeds its opening document with the header", () => {
    const docs = buildInitialDocuments(null, "en", EDITOR_CAMPUS);
    expect(docs.en?.header).toEqual(emptyHeader(""));
  });

  test("a blank locale of an existing page gets a header with its own title", () => {
    const doc = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "no",
      page: existingPage().page,
      translation: translation("no"),
    });
    expect(doc.header?.title).toBe("Fadderullan");
    expect(doc.header?.variant).toBe("plain");
  });
});

describe("buildInitialDocuments", () => {
  test("opening a page whose translation has no document seeds it from the translation", () => {
    const docs = buildInitialDocuments(existingPage(), "no", EDITOR_CAMPUS);
    expect(docs.no?.meta.title).toBe("Fadderullan");
    expect(docs.no?.meta.description).toBe("Om fadderuka");
    expect(docs.no?.meta.campus).toBe("campus-page");
    expect(docs.en).toBeUndefined();
  });

  test("a stored document without a campus gets the page's own campus", () => {
    const stored: PageDoc = {
      meta: {
        department: "dept-1",
        slug: "fadderullan",
        status: "published",
        title: "Fadderullan",
      },
      sections: [],
      version: 2,
    };
    const docs = buildInitialDocuments(
      existingPage(
        { campusId: null },
        { no: translation("no", { draftDocument: stored }) }
      ),
      "no",
      EDITOR_CAMPUS
    );
    expect(docs.no?.meta.campus).toBe("");
  });
});

describe("hasExistingContent", () => {
  const empty = (): PageDoc => ({
    meta: {
      department: "",
      slug: "x",
      status: "draft",
      title: "",
    },
    sections: [],
    version: 2,
  });

  test("a missing or blank document has nothing to overwrite", () => {
    expect(hasExistingContent(undefined)).toBe(false);
    expect(hasExistingContent(empty())).toBe(false);
  });

  test("a page header alone is content a translation would overwrite", () => {
    expect(
      hasExistingContent({
        ...empty(),
        header: {
          buttons: [],
          crumbs: [],
          eyebrow: "",
          lede: "",
          title: "",
          variant: "plain",
        },
      })
    ).toBe(true);
  });

  test("sections or a title are content too", () => {
    const withTitle = empty();
    withTitle.meta.title = "Om oss";
    expect(hasExistingContent(withTitle)).toBe(true);
    expect(
      hasExistingContent({
        ...empty(),
        sections: [
          {
            columns: [],
            id: "s-1",
            layout: {
              align: "top",
              background: "white",
              columns: "1",
              hideOnPhone: false,
              phoneReverse: false,
              spacing: "normal",
              tablet: "row",
            },
          },
        ],
      })
    ).toBe(true);
  });
});

describe("syncSharedMeta and the theme", () => {
  const THEME = { accent: "#c8a2f0", dark: "#3b1c6b" };
  const docWith = (
    title: string,
    theme?: PageDoc["meta"]["theme"]
  ): PageDoc => ({
    meta: {
      department: "d",
      slug: "s",
      status: "draft",
      title,
      ...(theme === undefined ? {} : { theme }),
    },
    sections: [],
    version: 2,
  });

  test("a theme set in one locale appears in the other", () => {
    const no = docWith("Norsk", THEME);
    const synced = syncSharedMeta({ en: docWith("English"), no }, "no", no);
    expect(synced.en?.meta.theme).toEqual(THEME);
    expect(synced.en?.meta.title).toBe("English");
  });

  test("a reset to BISO (null) carries over too", () => {
    const no = docWith("Norsk", null);
    const synced = syncSharedMeta(
      { en: docWith("English", THEME), no },
      "no",
      no
    );
    expect(synced.en?.meta.theme).toBeNull();
  });

  test("a blank document follows the open document's theme", () => {
    const blank = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "en",
      source: docWith("Norsk", THEME),
    });
    expect(blank.meta.theme).toEqual(THEME);
  });
});
