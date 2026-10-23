import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FactsBlock } from "@/editor/types";
import { FactsRender } from "./render";

const render = (block: FactsBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(FactsRender, {
        block,
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("FactsRender", () => {
  test("two items render two terms and two descriptions", () => {
    const html = render({
      id: "f1",
      items: [
        { label: "Where", text: "Oslo" },
        { label: "When", text: "Friday" },
      ],
      type: "facts",
    });
    expect(html.match(/<dt/g)).toHaveLength(2);
    expect(html.match(/<dd/g)).toHaveLength(2);
    expect(html).toContain("divide-edge");
    expect(html).not.toContain("<a");
  });

  test("an item with an href renders a link", () => {
    const html = render({
      id: "f1",
      items: [{ href: "https://example.com", label: "Web", text: "Site" }],
      type: "facts",
    });
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com"');
  });

  test("a javascript: href renders plain text, no link", () => {
    const html = render({
      id: "f1",
      items: [{ href: "javascript:alert(1)", label: "Web", text: "Site" }],
      type: "facts",
    });
    expect(html).not.toContain("<a");
    expect(html).toContain("Site");
  });

  test("an external link opens safely in a new tab", () => {
    const html = render({
      id: "f1",
      items: [{ href: "https://example.com", label: "Web", text: "Site" }],
      type: "facts",
    });
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('target="_blank"');
  });
});
