import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block, PageDoc } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { getBlock } from "../index";

/*
 * Copilot output and seed scripts can store any string in an enum prop. Each
 * lookup falls back to the block's default instead of producing an
 * `undefined` class or an empty label.
 */
const render = (block: Block, edit = false): Element => {
  const def = getBlock(block.type);
  if (!def) {
    throw new Error(`No block registered for ${block.type}`);
  }
  return parseHtml(
    renderToStaticMarkup(
      createElement(def.Render, {
        background: "default",
        block: block as never,
        edit,
        onPatch: () => undefined,
      })
    )
  );
};

const inspectorOn = (block: Block): string[] => {
  const def = getBlock(block.type);
  if (!def) {
    throw new Error(`No block registered for ${block.type}`);
  }
  const root = parseHtml(
    renderToStaticMarkup(
      createElement(def.Inspector, {
        block: block as never,
        doc: {} as PageDoc,
        onPatch: () => undefined,
      })
    )
  );
  return [...root.querySelectorAll(".pe-seg button.on, .pe-variant.on")].map(
    (button) => button.textContent ?? ""
  );
};

const noUndefinedClass = (root: Element) => {
  for (const el of root.querySelectorAll("[class]")) {
    expect(classesOf(el)).not.toContain("undefined");
  }
};

const junk = <T extends Block>(block: T, patch: Record<string, unknown>) =>
  ({ ...block, ...patch }) as unknown as Block;

describe("unknown enum values take the default", () => {
  test("heading size falls back to medium", () => {
    const block = junk(
      {
        eyebrow: "",
        id: "h",
        intro: "",
        size: "medium",
        title: "Om oss",
        type: "heading",
      },
      { size: "huge" }
    );
    const root = render(block);
    expect(classesOf(root.querySelector("h2"))).toContain("type-display-sm");
    noUndefinedClass(root);
    expect(inspectorOn(block)).toEqual(["Medium"]);
  });

  test("divider spacing falls back to medium", () => {
    const block = junk(
      { id: "d", spacing: "medium", type: "divider" },
      { spacing: "vast" }
    );
    const root = render(block);
    expect(classesOf(root.querySelector("hr"))).toContain("my-8");
    noUndefinedClass(root);
    expect(inspectorOn(block)).toEqual(["Medium"]);
  });

  test("callout tone falls back to info, label and colour", () => {
    const block = junk(
      { body: "b", id: "c", title: "t", tone: "info", type: "callout" },
      { tone: "danger" }
    );
    const root = render(block);
    const pill = root.querySelector("aside > span");
    expect(classesOf(pill)).toContain("text-ink-accent");
    expect(pill?.textContent).toBe("Info");
    noUndefinedClass(root);
    expect(inspectorOn(block)).toEqual(["info"]);
  });

  test("a text item of unknown type renders as a paragraph", () => {
    const block = junk(
      { body: [], id: "t", type: "text" },
      { body: [{ text: "Hei", type: "h4" }] }
    );
    const root = render(block);
    const p = root.querySelector("p");
    expect(p?.textContent).toBe("Hei");
    expect(classesOf(p)).toContain("type-body");
    noUndefinedClass(root);
    expect(inspectorOn(block)).toEqual(["Paragraph"]);
  });

  test("gallery layout falls back to the collage", () => {
    const images = [1, 2, 3, 4, 5, 6].map((n) => ({
      alt: `Bilde ${n}`,
      src: `https://x.test/${n}.jpg`,
    }));
    const block = junk(
      { id: "g", images, layout: "collage", type: "gallery" },
      { layout: "mosaic" }
    );
    // The collage shows five of the six images, with the big first tile.
    const root = render(block);
    expect(root.querySelectorAll("img")).toHaveLength(5);
    expect(root.querySelector(".pg-chevron-fill")).not.toBeNull();
    expect(inspectorOn(block)).toEqual(["Collage"]);
  });

  test("buttons alignment and image frame and lean fall back too", () => {
    const buttons = render(
      junk(
        {
          align: "start",
          id: "b",
          items: [{ href: "/a", label: "A", style: "primary" }],
          type: "buttons",
        },
        { align: "middle" }
      )
    );
    expect(classesOf(buttons.firstElementChild)).not.toContain(
      "justify-center"
    );
    const image = render(
      junk(
        {
          alt: "A",
          caption: "",
          frame: "chevron",
          id: "i",
          lean: "left",
          ratio: "16/9",
          src: "https://x.test/a.jpg",
          type: "image",
        },
        { frame: "polaroid", lean: "up", ratio: "2/1" }
      )
    );
    const frame = image.querySelector(".chevron-frame");
    expect(frame).not.toBeNull();
    expect(frame?.hasAttribute("data-lean")).toBe(false);
    expect(frame?.getAttribute("style")).toContain("--ar:0.5625");
    expect(
      inspectorOn(
        junk(
          {
            alt: "A",
            caption: "",
            frame: "chevron",
            id: "i",
            lean: "left",
            ratio: "16/9",
            type: "image",
          },
          { frame: "polaroid", lean: "up", ratio: "2/1" }
        )
      )
    ).toEqual(["Chevron", "16:9", "Left"]);
  });
});
