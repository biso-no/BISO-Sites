import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HeadingBlock } from "@/editor/types";
import { HeadingRender } from "./render";

const base: HeadingBlock = {
  eyebrow: "About",
  id: "h1",
  intro: "Intro copy",
  size: "medium",
  title: "Our story",
  type: "heading",
};

const render = (block: HeadingBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(HeadingRender, {
        block,
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("HeadingRender", () => {
  test("no link means no marker", () => {
    const html = render(base);
    expect(html).not.toContain("bg-marker");
    expect(html).not.toContain("<a");
  });

  test("a link draws the marker and shows the label", () => {
    const html = render({
      ...base,
      link: { href: "/about", label: "Read more" },
    });
    expect(html).toContain("bg-marker");
    expect(html).toContain("<a");
    expect(html).toContain("Read more");
    expect(html).toContain('href="/about"');
  });

  test("a link without a label draws nothing", () => {
    const html = render({ ...base, link: { href: "/about", label: "" } });
    expect(html).not.toContain("bg-marker");
  });

  test("large uses the largest display role", () => {
    expect(render({ ...base, size: "large" })).toContain("type-display-lg");
    expect(render({ ...base, size: "small" })).toContain(
      "type-heading-section"
    );
  });

  test("never renders an h1, and uses ink on a dark section", () => {
    const html = render(base);
    expect(html).not.toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("text-ink");
  });
});
