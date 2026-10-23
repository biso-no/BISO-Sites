import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ButtonsBlock } from "@/editor/types";
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

const html = (b: ButtonsBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(ButtonsRender, {
        block: b,
        edit: false,
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
});

describe("registry", () => {
  test("cta and hero are gone; buttons and ctaBand are v2", () => {
    const types = allBlocks().map((d) => d.type as string);
    expect(types).not.toContain("cta");
    expect(types).not.toContain("hero");
    for (const type of ["buttons", "ctaBand"]) {
      expect(allBlocks().find((d) => d.type === type)?.v2).toBe(true);
    }
  });
});
