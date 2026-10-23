import { describe, expect, test } from "bun:test";
import { unitPageTemplate } from "./templates";
import type { Block, Section } from "./types";

const flat = (sections: Section[]): Block[] =>
  sections.flatMap((s) => s.columns.flatMap((c) => c.blocks));
const types = (sections: Section[]) => flat(sections).map((b) => b.type);

describe("unitPageTemplate", () => {
  test("a project unit gets the full project layout", () => {
    const blocks = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    expect(types(blocks)).toEqual([
      "hero",
      "text",
      "events",
      "gallery",
      "text",
      "contact",
    ]);
  });

  test("an ordinary unit gets the shorter layout", () => {
    const blocks = unitPageTemplate({
      campusLabel: "Bergen",
      kind: "unit",
      locale: "no",
      name: "Case Club",
    });
    expect(types(blocks)).toEqual(["hero", "text", "events", "contact"]);
  });

  test("the hero carries the unit's name and campus", () => {
    const [hero] = flat(
      unitPageTemplate({
        campusLabel: "Trondheim",
        kind: "project",
        locale: "en",
        name: "Fadderullan",
      })
    );
    expect(hero).toMatchObject({
      eyebrow: "BISO Trondheim",
      title: "Fadderullan",
      type: "hero",
    });
  });

  test("the events block follows the page's own department", () => {
    const blocks = unitPageTemplate({
      campusLabel: null,
      kind: "project",
      locale: "no",
      name: "Wintergames",
    });
    const events = flat(blocks).find((block) => block.type === "events");
    expect(events).toMatchObject({ items: [], source: "auto" });
  });

  test("placeholder copy follows the locale", () => {
    const norwegian = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    const english = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "en",
      name: "Fadderullan",
    });
    const heading = (sections: Section[], index: number) => {
      const block = flat(sections)[index];
      return block?.type === "text" ? block.body[0]?.text : undefined;
    };
    expect(heading(norwegian, 1)).toBe("Om Fadderullan");
    expect(heading(english, 1)).toBe("About Fadderullan");
    expect(heading(norwegian, 4)).toBe("For bedrifter");
    expect(heading(english, 4)).toBe("For companies");
  });

  test("every block gets its own id", () => {
    const blocks = unitPageTemplate({
      campusLabel: "Oslo",
      kind: "project",
      locale: "no",
      name: "Fadderullan",
    });
    const all = [
      ...blocks.map((s) => s.id),
      ...blocks.flatMap((s) => s.columns.map((c) => c.id)),
      ...flat(blocks).map((b) => b.id),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  test("a project unit template is one single-column section per block", () => {
    const sections = unitPageTemplate({
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
      "hero",
      "text",
      "events",
      "gallery",
      "text",
      "contact",
    ]);
  });
});
