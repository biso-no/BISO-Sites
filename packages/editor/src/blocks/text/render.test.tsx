import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TextBlock } from "@/editor/types";
import { TextRender } from "./render";
import { RICH_CLASS } from "./render-classes";
import { RICH_ATTR } from "./test-support";

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

const renderBody = (body: string) =>
  renderToStaticMarkup(
    <TextRender
      block={{ body, id: "t", type: "text" }}
      edit={false}
      onPatch={noPatch}
    />
  );

describe("TextRender with an HTML body", () => {
  test("a string body renders its HTML inside the rich wrapper", () => {
    expect(renderBody("<h2>T</h2><ul><li>x</li></ul>")).toBe(
      `<div class="${RICH_ATTR}"><h2>T</h2><ul><li>x</li></ul></div>`
    );
  });

  test("a blank string body renders nothing on the site", () => {
    expect(renderBody("<p> </p>")).toBe("");
  });

  test("a table body renders inside the rich wrapper as stored", () => {
    const table =
      '<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td colspan="2">Ada</td></tr></tbody></table>';
    expect(renderBody(`<p>x</p>${table}`)).toBe(
      `<div class="${RICH_ATTR}"><p>x</p>${table}</div>`
    );
  });

  test("tables scroll inside themselves", () => {
    for (const c of [
      "[&_table]:block",
      "[&_table]:overflow-x-auto",
      "[&_table]:max-w-full",
    ]) {
      expect(RICH_CLASS).toContain(c);
    }
  });

  test("table cells wrap long words as body copy does", () => {
    expect(RICH_CLASS).toContain("[&_:is(th,td)]:[overflow-wrap:anywhere]");
  });
});
