import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { getBlock } from "../index";

/*
 * A long Norwegian compound or an email address has no break opportunity, so
 * in a narrow (four-column) section it runs out of its column unless the block
 * lets it wrap. `type-display-sm` sets no overflow-wrap of its own, and the
 * shared stylesheet stays as the coded site has it, so the blocks do it.
 */
const WORD = "Samarbeidspartnere";
const EMAIL = "communication.wintergames@biso.no";
const WRAP = ["break-words", "hyphens-auto"];
const ANYWHERE = "[overflow-wrap:anywhere]";

const render = (block: Block): Element => {
  const def = getBlock(block.type);
  if (!def) {
    throw new Error(`No block registered for ${block.type}`);
  }
  return parseHtml(
    renderToStaticMarkup(
      createElement(
        "section",
        { "data-surface": "deep" },
        createElement(def.Render, {
          background: "default",
          block: block as never,
          edit: false,
          onPatch: () => undefined,
        })
      )
    )
  );
};

/** The block's own root: the first element inside the wrapping section. */
const root = (el: Element) => el.querySelector("section > *");

const expectWraps = (element: Element | null | undefined) => {
  for (const cls of WRAP) {
    expect(classesOf(element)).toContain(cls);
  }
};

describe("long words wrap inside a narrow column", () => {
  test("text: headings wrap, paragraphs and list items break anywhere", () => {
    const el = render({
      body: [
        { text: WORD, type: "h" },
        { text: WORD, type: "h3" },
        { text: EMAIL, type: "p" },
        { text: EMAIL, type: "li" },
      ],
      id: "t",
      type: "text",
    });
    expectWraps(el.querySelector("h2"));
    expectWraps(el.querySelector("h3"));
    for (const tag of ["p", "li"]) {
      const classes = classesOf(el.querySelector(tag));
      expect(classes).toContain(ANYWHERE);
      expect(classes).toContain("hyphens-auto");
      // One overflow-wrap per element, or the stylesheet order decides.
      expect(classes).not.toContain("break-words");
    }
  });

  test("heading: the block and its title wrap", () => {
    const el = render({
      eyebrow: "",
      id: "h",
      intro: "",
      size: "medium",
      title: WORD,
      type: "heading",
    });
    expectWraps(root(el));
    expectWraps(el.querySelector("h2"));
    expect(classesOf(el.querySelector("h2"))).toContain("min-w-0");
  });

  test("quote", () => {
    const el = render({
      author: "Kari",
      id: "q",
      role: "",
      text: WORD,
      type: "quote",
    });
    expectWraps(root(el));
  });

  test("facts: values break anywhere, so an email fits", () => {
    const el = render({
      id: "f",
      items: [{ label: "E-post", text: EMAIL }],
      type: "facts",
    });
    expectWraps(root(el));
    expect(classesOf(el.querySelector("dd"))).toContain(ANYWHERE);
  });

  test("highlights: items may shrink below their longest word", () => {
    const el = render({
      id: "hl",
      items: [{ text: WORD }],
      type: "highlights",
    });
    expectWraps(root(el));
    expect(classesOf(el.querySelector("li"))).toContain("min-w-0");
  });

  test("stats: labels wrap", () => {
    const el = render({
      id: "s",
      items: [{ label: WORD, num: "4" }],
      type: "stats",
    });
    expectWraps(root(el));
    expect(classesOf(el.querySelector("dl > div"))).toContain("min-w-0");
  });

  test("callout", () => {
    const el = render({
      body: EMAIL,
      id: "c",
      title: WORD,
      tone: "info",
      type: "callout",
    });
    expectWraps(root(el));
  });

  test("ctaBand: the text column may shrink below its longest word", () => {
    const el = render({
      buttons: [],
      eyebrow: "",
      id: "cb",
      text: EMAIL,
      title: WORD,
      type: "ctaBand",
    });
    const column = root(el)?.firstElementChild;
    expectWraps(column);
    expect(classesOf(column)).toContain("min-w-0");
  });
});
