import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CtaBandBlock } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
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

const html = (b: CtaBandBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(CtaBandRender, {
        block: b,
        edit,
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

  test("in the editor its buttons are not links", () => {
    const root = parseHtml(html(block(), true));
    expect(root.querySelectorAll("a")).toHaveLength(0);
    expect(root.querySelector("span.rounded-biso-pill")?.textContent).toBe(
      "Join"
    );
  });

  test("the site drops buttons with an empty or unsafe link", () => {
    const root = parseHtml(
      html(
        block({
          buttons: [
            { href: " ", label: "Blank", style: "primary" },
            { href: "data:text/html,x", label: "Bad", style: "secondary" },
          ],
        })
      )
    );
    expect(root.querySelectorAll("a")).toHaveLength(0);
    expect(root.querySelectorAll(".rounded-biso-pill")).toHaveLength(0);
  });
});
