import { describe, expect, test } from "bun:test";
import type {
  PageEditorLoadResult,
  PageTranslationEditorEntry,
} from "@repo/api/page-builder";
import { emptyHeader } from "@repo/editor/templates";
import type { PageDoc } from "@repo/editor/types";
import { SHARED_META_FIELDS } from "@/lib/page-shared-meta";
import {
  blankPageDoc,
  buildInitialDocuments,
  hasExistingContent,
  syncSharedMeta,
  withDepartmentTheme,
  withoutDroppedTheme,
  withoutPageTheme,
  withStoredMeta,
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
  test("a department user's new page starts under their unit", () => {
    const unit = { departmentId: "24", unitSlug: "units/oslo/fadderullan" };
    expect(
      blankPageDoc({ defaultCampusId: "1", locale: "no", unit }).meta
    ).toMatchObject({
      campus: "1",
      department: "24",
      slug: "units/oslo/fadderullan/uten-navn",
    });
    expect(buildInitialDocuments(null, "no", "1", unit).no?.meta.slug).toBe(
      "units/oslo/fadderullan/uten-navn"
    );
  });

  test("an existing page keeps its own address and department, unit or not", () => {
    const doc = blankPageDoc({
      defaultCampusId: EDITOR_CAMPUS,
      locale: "no",
      page: existingPage().page,
      translation: translation("no"),
      unit: { departmentId: "24", unitSlug: "units/oslo/fadderullan" },
    });
    expect(doc.meta.slug).toBe("fadderullan");
    expect(doc.meta.department).toBe("dept-1");
  });

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

describe("syncSharedMeta uses the one shared field list", () => {
  test("copies exactly SHARED_META_FIELDS and keeps each locale's own text", () => {
    const no: PageDoc = {
      meta: {
        campus: "campus-no",
        department: "dept-no",
        description: "Norsk",
        slug: "slug-no",
        status: "published",
        theme: { accent: "#c8a2f0", dark: "#3b1c6b" },
        title: "Norsk tittel",
      },
      sections: [],
      version: 2,
    };
    const en: PageDoc = {
      meta: {
        campus: "campus-en",
        department: "dept-en",
        description: "English",
        slug: "slug-en",
        status: "draft",
        title: "English title",
      },
      sections: [],
      version: 2,
    };
    const synced = syncSharedMeta({ en, no }, "no", no).en?.meta;
    for (const field of SHARED_META_FIELDS) {
      expect(synced?.[field]).toEqual(no.meta[field]);
    }
    expect(synced?.title).toBe("English title");
    expect(synced?.description).toBe("English");
  });
});

describe("what the server stored reaches every locale (I3)", () => {
  const docIn = (patch: Partial<PageDoc["meta"]>): PageDoc => ({
    meta: {
      department: "",
      slug: "uten-navn",
      status: "draft",
      title: "T",
      ...patch,
    },
    sections: [],
    version: 2,
  });

  test("the bound department and stored slug replace what was sent, in every locale", () => {
    const docs = withStoredMeta(
      { en: docIn({ title: "E" }), no: docIn({ title: "N" }) },
      { department: "", slug: "uten-navn" },
      { department: "dept-1", slug: "uten-navn-2" }
    );
    for (const locale of ["no", "en"] as const) {
      expect(docs[locale]?.meta.department).toBe("dept-1");
      expect(docs[locale]?.meta.slug).toBe("uten-navn-2");
    }
    expect(docs.en?.meta.title).toBe("E");
  });

  test("a value changed since the save was sent is kept", () => {
    const docs = withStoredMeta(
      { no: docIn({ department: "dept-2" }) },
      { department: "" },
      { department: "dept-1" }
    );
    expect(docs.no?.meta.department).toBe("dept-2");
  });

  test("nothing stored differently leaves the documents as they are", () => {
    const current = { no: docIn({}) };
    expect(
      withStoredMeta(current, { department: "" }, { department: "" })
    ).toBe(current);
  });
});

describe("after a publish copied the theme (I1)", () => {
  test("every locale's document follows the department again", () => {
    const theme = { accent: "#c8a2f0", dark: "#3b1c6b" };
    const docOf = (title: string, t: PageDoc["meta"]["theme"]): PageDoc => ({
      meta: { department: "d", slug: "s", status: "draft", theme: t, title },
      sections: [],
      version: 2,
    });
    const docs = withoutPageTheme({
      en: docOf("E", null),
      no: docOf("N", theme),
    });
    expect("theme" in (docs.no?.meta ?? {})).toBe(false);
    expect("theme" in (docs.en?.meta ?? {})).toBe(false);
    expect(docs.no?.meta.title).toBe("N");
  });

  test("the department list takes the theme the department now has", () => {
    const theme = { accent: "#c8a2f0", dark: "#3b1c6b" };
    const list = [
      { campusId: "c", id: "d-1", name: "One", theme: null },
      { campusId: "c", id: "d-2", name: "Two", theme: null },
    ];
    const next = withDepartmentTheme(list, { id: "d-1", theme });
    expect(next[0]?.theme).toEqual(theme);
    expect(next[1]).toBe(list[1]);
    expect(withDepartmentTheme(list, null)).toBe(list);
  });
});

describe("after a save the server stored without its theme", () => {
  const T = { accent: "#fecd45", dark: "#2a0a4a" };
  const U = { accent: "#fecd45", dark: "#0b3d2e" };
  const docOf = (t: PageDoc["meta"]["theme"]): PageDoc => ({
    meta: { department: "d", slug: "s", status: "draft", theme: t, title: "T" },
    sections: [],
    version: 2,
  });

  test("drops that theme from every locale that holds it", () => {
    const docs = withoutDroppedTheme(
      { en: docOf({ ...T, dark: T.dark.toUpperCase() }), no: docOf(T) },
      "no",
      T
    );
    expect("theme" in (docs.no?.meta ?? {})).toBe(false);
    expect("theme" in (docs.en?.meta ?? {})).toBe(false);
  });

  test("keeps a theme picked since the save went out", () => {
    const docs = { en: docOf(U), no: docOf(U) };
    expect(withoutDroppedTheme(docs, "no", T)).toBe(docs);
  });

  test("leaves a locale holding another theme as it is", () => {
    const docs = withoutDroppedTheme({ en: docOf(U), no: docOf(T) }, "no", T);
    expect("theme" in (docs.no?.meta ?? {})).toBe(false);
    expect(docs.en?.meta.theme).toEqual(U);
  });
});
