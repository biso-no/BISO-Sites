import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TextBlock } from "@/editor/types";
import { TextRender } from "./render";

const block = (text: string): TextBlock => ({
  body: [{ text, type: "p" }],
  id: "t1",
  type: "text",
});

const noPatch = () => undefined;

const render = (text: string, edit: boolean) =>
  renderToStaticMarkup(
    createElement(TextRender, { block: block(text), edit, onPatch: noPatch })
  );

describe("TextRender in edit mode", () => {
  test("shows stored markup as formatting, exactly as the public site does", () => {
    // The stored value is HTML. Rendering it as a text child escaped it, so an
    // ampersand showed as "&amp;" and bold as a literal "<b>" — and each blur
    // re-saved the escaped form, corrupting the text a little more every time.
    const stored = "Q&amp;A with <b>bold</b>";

    expect(render(stored, true)).toContain(stored);
    expect(render(stored, true)).not.toContain("&amp;amp;");
    expect(render(stored, true)).not.toContain("&lt;b&gt;");
  });

  test("renders the same markup on the public site", () => {
    expect(render("Q&amp;A with <b>bold</b>", false)).toContain(
      "Q&amp;A with <b>bold</b>"
    );
  });
});

const renderBlock = (body: TextBlock["body"]) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(TextRender, {
        block: { body, id: "t2", type: "text" },
        edit: false,
        onPatch: noPatch,
      })
    )
  );

describe("TextRender in the redesign's type", () => {
  test("consecutive list items share one list", () => {
    const html = renderBlock([
      { text: "a", type: "li" },
      { text: "b", type: "li" },
    ]);
    expect(html.match(/<ul/g)?.length).toBe(1);
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).toContain("marker:text-ink-accent");
  });

  test("a paragraph between list items splits the list", () => {
    const html = renderBlock([
      { text: "a", type: "li" },
      { text: "mid", type: "p" },
      { text: "b", type: "li" },
    ]);
    expect(html.match(/<ul/g)?.length).toBe(2);
  });

  test("h renders the display role and body uses the measure", () => {
    const html = renderBlock([{ text: "Title", type: "h" }]);
    expect(html).toContain('<h2 class="type-display-sm');
    expect(html).toContain("max-w-(--measure)");
    expect(html).toContain("text-ink");
  });

  test("h3 and p use their roles", () => {
    const html = renderBlock([
      { text: "Sub", type: "h3" },
      { text: "Body", type: "p" },
    ]);
    expect(html).toContain("type-heading-card");
    expect(html).toContain("type-body");
  });
});
