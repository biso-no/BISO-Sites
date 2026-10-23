import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CtaBandBlock } from "@/editor/types";
import { CtaBandRender } from "./render";

const BG_CLASS = /\bbg-/;

const block = (patch: Partial<CtaBandBlock> = {}): CtaBandBlock => ({
  buttons: [{ href: "/join", label: "Join", style: "primary" }],
  eyebrow: "Get involved",
  id: "cb1",
  text: "Come along.",
  title: "Ready to jump in?",
  type: "ctaBand",
  ...patch,
});

const html = (b: CtaBandBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(CtaBandRender, {
        block: b,
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("CtaBandRender", () => {
  test("renders the title as an h2 in the band layout", () => {
    const out = html(block());
    expect(out).toContain("<h2");
    expect(out).toContain("type-display-lg");
    expect(out).toContain("@2xl:grid-cols-[1fr_auto]");
    expect(out).toContain("text-ink-accent");
    expect(out).toContain("Ready to jump in?");
  });

  test("empty buttons render no link", () => {
    expect(html(block({ buttons: [] }))).not.toContain("<a ");
  });

  test("a secondary button keeps its border", () => {
    const out = html(
      block({ buttons: [{ href: "/x", label: "More", style: "secondary" }] })
    );
    expect(out).toContain("border-edge");
  });

  test("paints no background of its own", () => {
    expect(html(block({ buttons: [] }))).not.toMatch(BG_CLASS);
  });
});
