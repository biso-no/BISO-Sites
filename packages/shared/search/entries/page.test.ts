import { PagesStatus, PagesVisibility } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { ctx } from "./fixtures";
import {
  hasPublishedContent,
  type PageTranslationText,
  pageEntries,
  pageOwner,
} from "./page";

type Row = Parameters<typeof pageEntries>[0];

const validDoc = JSON.stringify({
  version: 2,
  meta: {},
  sections: [
    { id: "s", blocks: [{ type: "text", text: "<p>Pakkeliste</p>" }] },
  ],
});
const emptyDoc = JSON.stringify({ version: 2, meta: {}, sections: [] });

function page(overrides: Partial<Row> = {}): Row {
  return {
    $id: "p1",
    slug: "om-oss",
    status: PagesStatus.PUBLISHED,
    visibility: PagesVisibility.PUBLIC,
    campus_id: null,
    ...overrides,
  };
}

function tr(overrides: Partial<PageTranslationText> = {}): PageTranslationText {
  return {
    locale: "no",
    title: "Om oss",
    description: "<p>Hvem vi er</p>",
    is_published: true,
    published_doc: validDoc,
    ...overrides,
  };
}

describe("pageOwner", () => {
  it("classifies slugs", () => {
    expect(pageOwner("om-oss")).toEqual({ kind: "standalone" });
    expect(pageOwner("units/oslo/fadderullan")).toEqual({
      kind: "unit",
      unitSlug: "units/oslo/fadderullan",
    });
    expect(pageOwner("units/oslo/fadderullan/program")).toEqual({
      kind: "unitSubPage",
      unitSlug: "units/oslo/fadderullan",
    });
    expect(pageOwner("units/oslo")).toEqual({ kind: "reserved" });
    expect(pageOwner("units/oslo/a/b/c")).toEqual({ kind: "reserved" });
    expect(pageOwner("projects/winter-games")).toEqual({
      kind: "project",
      project: "winter-games",
    });
    expect(pageOwner("projects/unknown")).toEqual({ kind: "reserved" });
    expect(pageOwner("projects")).toEqual({ kind: "standalone" });
  });
});

describe("hasPublishedContent", () => {
  it("needs a published, non-empty document", () => {
    expect(hasPublishedContent(tr({ published_doc: emptyDoc }))).toBe(false);
    expect(hasPublishedContent(tr({ published_doc: "" }))).toBe(false);
    expect(hasPublishedContent(tr({ published_doc: "{nope" }))).toBe(false);
    expect(hasPublishedContent(tr({ published_doc: null }))).toBe(false);
    expect(hasPublishedContent(tr({ is_published: false }))).toBe(false);
    expect(hasPublishedContent(tr())).toBe(true);
  });

  it("counts a header alone as content", () => {
    const doc = JSON.stringify({
      version: 2,
      meta: {},
      sections: [],
      header: { title: "Hei" },
    });
    expect(hasPublishedContent(tr({ published_doc: doc }))).toBe(true);
  });

  it("mirrors normalizePageDoc: only a version 2 document with sections", () => {
    const headerNoSections = JSON.stringify({
      version: 2,
      meta: {},
      header: { title: "Hei" },
    });
    const legacy = JSON.stringify({
      version: 1,
      sections: [{ id: "s", blocks: [{ type: "text", text: "<p>Hei</p>" }] }],
    });
    const noVersion = JSON.stringify({
      sections: [{ id: "s", blocks: [] }],
    });
    expect(hasPublishedContent(tr({ published_doc: headerNoSections }))).toBe(
      false
    );
    expect(hasPublishedContent(tr({ published_doc: legacy }))).toBe(false);
    expect(hasPublishedContent(tr({ published_doc: noVersion }))).toBe(false);
  });

  it("ignores sections and a header that normalizePageDoc would drop", () => {
    const junk = JSON.stringify({
      version: 2,
      meta: {},
      sections: ["x", null],
      header: ["not", "an", "object"],
    });
    expect(hasPublishedContent(tr({ published_doc: junk }))).toBe(false);
  });
});

describe("pageEntries", () => {
  it("skips non-public pages", () => {
    expect(
      pageEntries(
        page({ visibility: PagesVisibility.AUTHENTICATED }),
        [tr()],
        ctx()
      )
    ).toEqual([]);
    expect(
      pageEntries(page({ status: PagesStatus.DRAFT }), [tr()], ctx())
    ).toEqual([]);
  });

  it("skips a published translation with an empty document", () => {
    expect(
      pageEntries(page(), [tr({ published_doc: emptyDoc })], ctx())
    ).toEqual([]);
  });

  it("never indexes unit root, reserved or null slugs", () => {
    expect(
      pageEntries(page({ slug: "units/oslo/fadderullan" }), [tr()], ctx())
    ).toEqual([]);
    expect(pageEntries(page({ slug: "units/oslo" }), [tr()], ctx())).toEqual(
      []
    );
    expect(pageEntries(page({ slug: "projects/nope" }), [tr()], ctx())).toEqual(
      []
    );
    expect(pageEntries(page({ slug: null }), [tr()], ctx())).toEqual([]);
  });

  it("falls back to the other locale's published translation", () => {
    const p = pageEntries(
      page({ slug: "packing-list" }),
      [tr({ title: "Pakkeliste" }), tr({ locale: "en", is_published: false })],
      ctx()
    );
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ locale: "no", text_locale: "no" });
    expect(p[1]).toMatchObject({
      locale: "en",
      text_locale: "no",
      url: "/packing-list",
      type: "page",
      title: "Pakkeliste",
    });
    expect(p[0].body).toContain("Pakkeliste");
  });

  it("builds title, summary and body from the translation", () => {
    const [no] = pageEntries(page(), [tr()], ctx());
    expect(no).toMatchObject({
      title: "Om oss",
      summary: "Hvem vi er",
      campus_id: "all",
    });
  });

  it("falls back to doc header title, then meta title, then slug", () => {
    const withHeader = JSON.stringify({
      version: 2,
      meta: { title: "Meta" },
      sections: [],
      header: { title: "Header" },
    });
    const withMeta = JSON.stringify({
      version: 2,
      meta: { title: "Meta" },
      sections: [{ id: "s", blocks: [] }],
    });
    expect(
      pageEntries(
        page(),
        [tr({ title: "", published_doc: withHeader })],
        ctx()
      )[0].title
    ).toBe("Header");
    expect(
      pageEntries(
        page(),
        [tr({ title: "", published_doc: withMeta })],
        ctx()
      )[0].title
    ).toBe("Meta");
    expect(
      pageEntries(
        page({ slug: "a/b-side" }),
        [tr({ title: "", published_doc: validDoc })],
        ctx()
      )[0].title
    ).toBe("b-side");
  });

  it("maps unit sub-pages and project pages as pages with their campus", () => {
    const sub = pageEntries(
      page({ slug: "units/oslo/fadderullan/program", campus_id: "1" }),
      [tr()],
      ctx()
    );
    expect(sub[0]).toMatchObject({
      type: "page",
      url: "/units/oslo/fadderullan/program",
      campus_id: "1",
    });
    const proj = pageEntries(
      page({ slug: "projects/winter-games" }),
      [tr()],
      ctx()
    );
    expect(proj[0]).toMatchObject({
      type: "page",
      url: "/projects/winter-games",
    });
  });
});
