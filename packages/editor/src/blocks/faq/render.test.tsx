import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FaqBlock } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { FaqRender } from "./render";

const block: FaqBlock = {
  heading: "Vanlige spørsmål",
  id: "f1",
  items: [
    { a: "Ja, det er gratis.", q: "Koster det noe?" },
    { a: "Hver tirsdag.", q: "Når møtes vi?" },
  ],
  type: "faq",
};

const render = (b: unknown, edit = false) =>
  parseHtml(
    renderToStaticMarkup(
      <section data-surface="deep">
        <FaqRender
          block={b as FaqBlock}
          edit={edit}
          onPatch={() => undefined}
        />
      </section>
    )
  );

describe("faq render", () => {
  test("each question is a details with a summary, closed on the site", () => {
    const root = render(block);
    const details = [...root.querySelectorAll("details")];
    expect(details).toHaveLength(2);
    for (const d of details) {
      expect(d.hasAttribute("open")).toBe(false);
      expect(d.querySelector("summary")).not.toBeNull();
    }
    const summary = root.querySelector("summary");
    expect(classesOf(summary)).toContain("type-heading-card");
    expect(summary?.textContent).toContain("Koster det noe?");
    expect(root.querySelector("details p")?.textContent).toBe(
      "Ja, det er gratis."
    );
    expect(classesOf(root.querySelector("details p"))).toContain("type-body");
  });

  test("items are divided by edge rules", () => {
    const list = render(block).querySelector("details")?.parentElement;
    expect(classesOf(list)).toContain("divide-y");
    expect(classesOf(list)).toContain("divide-edge");
  });

  test("in the editor every item is open and the text is editable", () => {
    const root = render(block, true);
    for (const d of root.querySelectorAll("details")) {
      expect(d.hasAttribute("open")).toBe(true);
    }
    expect(root.querySelectorAll("[contenteditable]").length).toBe(5);
  });

  test("a missing or malformed list renders no items", () => {
    expect(
      render({ ...block, items: "nope" }).querySelectorAll("details")
    ).toHaveLength(0);
    expect(
      render({ id: "f2", type: "faq" }).querySelectorAll("details")
    ).toHaveLength(0);
  });

  test("no heading is printed on the site when empty", () => {
    expect(render({ ...block, heading: "" }).querySelector("h2")).toBeNull();
    expect(
      render({ ...block, heading: "" }, true).querySelector("h2")
    ).not.toBeNull();
  });
});
