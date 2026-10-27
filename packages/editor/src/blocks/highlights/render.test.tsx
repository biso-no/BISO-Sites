import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HighlightsBlock } from "@/editor/types";
import { HighlightsRender } from "./render";

const block: HighlightsBlock = {
  id: "h1",
  items: [{ text: "Free coffee" }, { text: "Student discounts" }],
  type: "highlights",
};

describe("HighlightsRender", () => {
  test("renders an accent rule per item on a dark section", () => {
    const html = renderToStaticMarkup(
      createElement(
        "section",
        { "data-surface": "deep" },
        createElement(HighlightsRender, {
          block,
          edit: false,
          onPatch: () => undefined,
        })
      )
    );
    expect(html).toContain("border-ink-accent");
    expect(html).toContain("<ul");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("Free coffee");
  });
});
