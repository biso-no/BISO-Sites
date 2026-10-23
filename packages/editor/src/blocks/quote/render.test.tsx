import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { QuoteBlock } from "@/editor/types";
import { QuoteRender } from "./render";

const base: QuoteBlock = {
  author: "Kari",
  id: "q1",
  role: "Leader",
  text: "Words worth keeping.",
  type: "quote",
};

const render = (block: QuoteBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(QuoteRender, {
        block,
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("QuoteRender", () => {
  test("without an author or role there is no figcaption", () => {
    expect(render({ ...base, author: "", role: "" })).not.toContain(
      "figcaption"
    );
  });

  test("with an author it renders the caption roles", () => {
    const html = render(base);
    expect(html).toContain("<figcaption");
    expect(html).toContain("type-heading-card");
    expect(html).toContain("type-body-sm");
  });

  test("a left action rule and ink text on a dark section", () => {
    const html = render(base);
    expect(html).toContain("<figure");
    expect(html).toContain("border-l-4");
    expect(html).toContain("<blockquote");
    expect(html).toContain("type-display-sm m-0 text-ink");
  });
});
