import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TimelineBlock } from "@/editor/types";
import { TimelineRender } from "./render";

const WHITESPACE = /\s+/;

const block: TimelineBlock = {
  heading: "Programmet",
  id: "t1",
  items: [
    { label: "Dag 1 · 10:00", text: "Åpning", title: "Velkommen" },
    { label: "Dag 1 · 12:00", text: "Lunsj" },
    { label: "Dag 2 · 09:00", text: "Intervjuer" },
  ],
  type: "timeline",
};

describe("TimelineRender", () => {
  test("renders every item with its label on an accent rail", () => {
    const html = renderToStaticMarkup(
      createElement(
        "section",
        { "data-surface": "deep" },
        createElement(TimelineRender, {
          block,
          edit: false,
          onPatch: () => undefined,
        })
      )
    );
    expect(html.match(/<li[ >]/g)).toHaveLength(3);
    for (const label of ["Dag 1 · 10:00", "Dag 1 · 12:00", "Dag 2 · 09:00"]) {
      expect(html).toContain(label);
    }
    const tokens = new Set(
      [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, c]) =>
        (c ?? "").split(WHITESPACE)
      )
    );
    expect(tokens.has("border-ink-accent")).toBe(true);
    expect(tokens.has("type-data")).toBe(true);
    expect(tokens.has("type-heading-card")).toBe(true);
  });

  test("survives the legacy year key without crashing", () => {
    const legacy = {
      ...block,
      items: [{ text: "Founded.", year: "2019" }],
    } as never;
    expect(() =>
      renderToStaticMarkup(
        createElement(TimelineRender, {
          block: legacy,
          edit: false,
          onPatch: () => undefined,
        })
      )
    ).not.toThrow();
  });
});
