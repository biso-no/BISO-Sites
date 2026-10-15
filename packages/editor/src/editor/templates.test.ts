import { describe, expect, test } from "bun:test";
import { unitPageTemplate } from "./templates";
import type { Block } from "./types";

const types = (blocks: Block[]) => blocks.map((block) => block.type);

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
    const [hero] = unitPageTemplate({
      campusLabel: "Trondheim",
      kind: "project",
      locale: "en",
      name: "Fadderullan",
    });
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
    const events = blocks.find((block) => block.type === "events");
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
    const heading = (blocks: Block[], index: number) => {
      const block = blocks[index];
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
    const ids = new Set(blocks.map((block) => block.id));
    expect(ids.size).toBe(blocks.length);
  });
});
