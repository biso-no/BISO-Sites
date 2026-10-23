import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HeadingBlock } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { HeadingRender } from "./render";

const base: HeadingBlock = {
  eyebrow: "About",
  id: "h1",
  intro: "Intro copy",
  size: "medium",
  title: "Our story",
  type: "heading",
};

const render = (block: HeadingBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(HeadingRender, {
        block,
        edit,
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

  test("in the editor the link is shown but is not a link", () => {
    const root = parseHtml(
      render({ ...base, link: { href: "/about", label: "Read more" } }, true)
    );
    expect(root.querySelectorAll("a")).toHaveLength(0);
    expect(root.textContent).toContain("Read more →");
  });

  test("the marker paints behind the title, never behind the section", () => {
    // The stroke sits at -z-10; without a stacking context on the title it
    // would drop behind the section's own background and vanish.
    const root = parseHtml(
      render({ ...base, link: { href: "/about", label: "Read more" } })
    );
    const h2 = root.querySelector("h2");
    expect(h2?.classList.contains("isolate")).toBe(true);
    expect(h2?.hasAttribute("data-marker")).toBe(false);
    expect(h2?.querySelector("span")?.classList.contains("after:-z-10")).toBe(
      true
    );
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
