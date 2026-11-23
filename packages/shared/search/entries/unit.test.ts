import { describe, expect, it } from "vitest";
import type { TranslationText } from "./common";
import { ctx } from "./fixtures";
import type { PageTranslationText } from "./page";
import { unitEntries } from "./unit";

type Row = Parameters<typeof unitEntries>[0];
type Extras = Parameters<typeof unitEntries>[1];

function unit(overrides: Partial<Row> = {}): Row {
  return {
    $id: "d1",
    Name: "OSL Fadderullan",
    slug: "fadderullan",
    campus_id: "1",
    active: true,
    logo: "https://img/logo.png",
    hero: null,
    ...overrides,
  };
}

const noExtras: Extras = {
  overlay: [],
  page: null,
  replacedByProjectPage: false,
};

const doc = JSON.stringify({
  version: 2,
  meta: {},
  sections: [{ id: "s", blocks: [{ type: "text", text: "<p>Sidetekst</p>" }] }],
});

function pageTr(
  overrides: Partial<PageTranslationText> = {}
): PageTranslationText {
  return {
    locale: "no",
    title: "Side",
    description: "<p>Sidebeskrivelse</p>",
    is_published: true,
    published_doc: doc,
    ...overrides,
  };
}

describe("unitEntries", () => {
  it("skips ledgers, inactive units and units replaced by a project page", () => {
    expect(unitEntries(unit({ Name: "Drift BISO" }), noExtras, ctx())).toEqual(
      []
    );
    expect(unitEntries(unit({ active: false }), noExtras, ctx())).toEqual([]);
    expect(
      unitEntries(unit(), { ...noExtras, replacedByProjectPage: true }, ctx())
    ).toEqual([]);
  });

  it("skips a unit with no campus segment", () => {
    expect(unitEntries(unit({ campus_id: "9" }), noExtras, ctx())).toEqual([]);
  });

  it("maps title, url, campus and image", () => {
    const entries = unitEntries(unit(), noExtras, ctx());
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      type: "unit",
      row_id: "d1",
      title: "Fadderullan",
      url: "/units/oslo/fadderullan",
      campus_id: "1",
      image: "https://img/logo.png",
      summary: "",
      body: "",
      text_locale: "no",
    });
    expect(entries[1]).toMatchObject({ locale: "en", text_locale: "en" });
  });

  it("prefers overlay text and falls back across locales", () => {
    const overlay: TranslationText[] = [
      {
        locale: "no",
        title: "x",
        description: "<p>Om enheten</p>",
        short_description: "Kort",
      },
    ];
    const [no, en] = unitEntries(unit(), { ...noExtras, overlay }, ctx());
    expect(no).toMatchObject({
      summary: "Kort",
      body: "Om enheten",
      text_locale: "no",
    });
    expect(en).toMatchObject({ summary: "Kort", text_locale: "no" });
  });

  it("falls back to the unit's published page text", () => {
    const [no, en] = unitEntries(
      unit(),
      { ...noExtras, page: [pageTr()] },
      ctx()
    );
    expect(no).toMatchObject({ summary: "Sidebeskrivelse", text_locale: "no" });
    expect(no.body).toContain("Sidetekst");
    expect(en).toMatchObject({ text_locale: "no", title: "Fadderullan" });
  });

  it("ignores page translations without published content", () => {
    const [no] = unitEntries(
      unit(),
      { ...noExtras, page: [pageTr({ is_published: false })] },
      ctx()
    );
    expect(no).toMatchObject({ summary: "", body: "", text_locale: "no" });
  });

  it("buckets national and empty campus as all", () => {
    const [e] = unitEntries(
      unit({ campus_id: "5", slug: "x" }),
      noExtras,
      ctx()
    );
    expect(e.campus_id).toBe("all");
    expect(e.url).toBe("/units/national/x");
  });
});
