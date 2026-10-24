import { describe, expect, test } from "bun:test";
import { unitPageTemplate } from "./templates";
import type { Block, Section } from "./types";

const flat = (sections: Section[]): Block[] =>
  sections.flatMap((s) => s.columns.flatMap((c) => c.blocks));
const types = (sections: Section[]) => flat(sections).map((b) => b.type);

describe("unitPageTemplate", () => {
  test("a project unit gets the full project layout", () => {
    const { sections } = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    expect(types(sections)).toEqual([
      "text",
      "events",
      "gallery",
      "text",
      "contact",
    ]);
  });

  test("an ordinary unit gets the shorter layout", () => {
    const { sections } = unitPageTemplate({
      campusLabel: "Bergen",
      kind: "unit",
      locale: "no",
      name: "Case Club",
    });
    expect(types(sections)).toEqual(["text", "events", "contact"]);
  });

  test("the page header carries the unit's name and campus", () => {
    const { header } = unitPageTemplate({
      campusLabel: "Trondheim",
      kind: "project",
      locale: "en",
      name: "Fadderullan",
    });
    expect(header).toEqual({
      buttons: [],
      crumbs: [],
      eyebrow: "BISO Trondheim",
      lede: "One sentence about what you do.",
      title: "Fadderullan",
      variant: "plain",
    });
  });

  test("a unit without a campus gets a plain BISO eyebrow and a Norwegian lede", () => {
    const { header } = unitPageTemplate({
      campusLabel: null,
      kind: "unit",
      locale: "no",
      name: "Case Club",
    });
    expect(header.eyebrow).toBe("BISO");
    expect(header.lede).toBe("Én setning om hva dere gjør.");
  });

  test("no section holds a hero any more", () => {
    for (const kind of ["project", "unit"] as const) {
      const { sections } = unitPageTemplate({
        campusLabel: "Oslo",
        kind,
        locale: "no",
        name: "Fadderullan",
      });
      expect(types(sections)).not.toContain("hero" as Block["type"]);
    }
  });

  test("the events block follows the page's own department", () => {
    const { sections } = unitPageTemplate({
      campusLabel: null,
      kind: "project",
      locale: "no",
      name: "Wintergames",
    });
    const events = flat(sections).find((block) => block.type === "events");
    expect(events).toMatchObject({ source: "auto" });
  });

  test("placeholder copy follows the locale", () => {
    const norwegian = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    }).sections;
    const english = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "en",
      name: "Fadderullan",
    }).sections;
    const heading = (sections: Section[], index: number) => {
      const block = flat(sections)[index];
      return block?.type === "text" ? block.body[0]?.text : undefined;
    };
    expect(heading(norwegian, 0)).toBe("Om Fadderullan");
    expect(heading(english, 0)).toBe("About Fadderullan");
    expect(heading(norwegian, 3)).toBe("For bedrifter");
    expect(heading(english, 3)).toBe("For companies");
  });

  test("every block gets its own id", () => {
    const { sections } = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    const all = [
      ...sections.map((s) => s.id),
      ...sections.flatMap((s) => s.columns.map((c) => c.id)),
      ...flat(sections).map((b) => b.id),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  test("a project unit template is one single-column section per block", () => {
    const { sections } = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    expect(
      sections.every(
        (s) => s.columns.length === 1 && s.columns[0].blocks.length === 1
      )
    ).toBe(true);
    expect(sections.map((s) => s.columns[0].blocks[0].type)).toEqual([
      "text",
      "events",
      "gallery",
      "text",
      "contact",
    ]);
  });
});

describe("unitPageTemplate escapes the unit's name", () => {
  // The name lands in a text block, whose body is HTML; department names come
  // from the accounting system. The header shows it as plain text.
  test.each([
    ["no", "Om Case &amp; Co &lt;img src=x onerror=alert(1)&gt;"],
    ["en", "About Case &amp; Co &lt;img src=x onerror=alert(1)&gt;"],
  ] as const)("in the %s about heading", (locale, heading) => {
    const name = "Case & Co <img src=x onerror=alert(1)>";
    const { header, sections } = unitPageTemplate({
      campusLabel: null,
      kind: "unit",
      locale,
      name,
    });
    const about = sections[0].columns[0].blocks[0];

    expect(about.type === "text" && about.body[0].text).toBe(heading);
    expect(header.title).toBe(name);
  });
});
