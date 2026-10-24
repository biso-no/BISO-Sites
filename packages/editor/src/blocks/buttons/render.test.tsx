import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ButtonsBlock } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { allBlocks } from "../index";
import { ButtonsRender } from "./render";

const block = (patch: Partial<ButtonsBlock> = {}): ButtonsBlock => ({
  align: "start",
  id: "bt1",
  items: [
    { href: "/a", label: "One", style: "primary" },
    { href: "/b", label: "Two", style: "secondary" },
    { href: "/c", label: "Three", style: "secondary" },
  ],
  type: "buttons",
  ...patch,
});

const html = (b: ButtonsBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(ButtonsRender, {
        block: b,
        edit,
        onPatch: () => undefined,
      })
    )
  );

describe("ButtonsRender", () => {
  test("three items render three links", () => {
    const out = html(block());
    expect(out.match(/<a /g)).toHaveLength(3);
    expect(out).toContain("flex flex-wrap gap-3");
    expect(out).not.toContain("justify-center");
  });

  test("center alignment centres the row", () => {
    expect(html(block({ align: "center" }))).toContain("justify-center");
  });

  test("an unsafe href never becomes a link", () => {
    const out = html(
      block({
        items: [{ href: "javascript:alert(1)", label: "x", style: "primary" }],
      })
    );
    expect(out).not.toContain("<a ");
  });

  test("in the editor no button is a link, so a click cannot leave the editor", () => {
    const root = parseHtml(html(block(), true));
    expect(root.querySelectorAll("a")).toHaveLength(0);
    expect(root.querySelectorAll("span")).toHaveLength(3);
  });

  test("the site drops buttons with an empty or unsafe link", () => {
    const root = parseHtml(
      html(
        block({
          items: [
            { href: "", label: "Empty", style: "primary" },
            { href: "javascript:alert(1)", label: "Bad", style: "secondary" },
            { href: "/ok", label: "Ok", style: "secondary" },
          ],
        })
      )
    );
    expect(root.querySelectorAll("a")).toHaveLength(1);
    expect(root.querySelectorAll("span")).toHaveLength(0);
    expect(root.textContent).toBe("Ok");
  });

  test("the editor still shows a button whose link is missing", () => {
    const root = parseHtml(
      html(
        block({ items: [{ href: "", label: "Empty", style: "primary" }] }),
        true
      )
    );
    expect(root.querySelector("span")?.textContent).toBe("Empty");
  });
});

describe("registry", () => {
  test("cta and hero are gone; buttons and ctaBand are v2", () => {
    const types = allBlocks().map((d) => d.type as string);
    expect(types).not.toContain("cta");
    expect(types).not.toContain("hero");
    for (const type of ["buttons", "ctaBand"]) {
      expect(allBlocks().some((d) => d.type === type)).toBe(true);
    }
  });
});
