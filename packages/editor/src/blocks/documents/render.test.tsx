import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentsBlock } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { DocumentsRender } from "./render";

const VIEW =
  "https://appwrite.biso.no/v1/storage/buckets/media/files/f1/view?project=biso";

const block: DocumentsBlock = {
  heading: "Dokumenter",
  id: "d1",
  items: [
    {
      fileId: "f1",
      mime: "application/pdf",
      size: 1_200_000,
      src: VIEW,
      title: "Vedtekter",
    },
    { src: "https://example.com/budsjett.xlsx", title: "Budsjett" },
  ],
  type: "documents",
};

const html = (b: unknown, edit = false) =>
  renderToStaticMarkup(
    <section data-surface="deep">
      <DocumentsRender
        block={b as DocumentsBlock}
        edit={edit}
        onPatch={() => undefined}
      />
    </section>
  );

const render = (b: unknown, edit = false) => parseHtml(html(b, edit));

describe("documents render", () => {
  test("a PDF row links to the real download endpoint", () => {
    const link = render(block).querySelector("a");
    expect(link?.getAttribute("href")).toContain(
      "/storage/buckets/media/files/f1/download"
    );
    expect(link?.hasAttribute("download")).toBe(true);
  });

  test("the row shows title, type and a Norwegian size", () => {
    const root = render(block);
    expect(root.textContent).toContain("Vedtekter");
    expect(root.textContent).toContain("PDF · 1,2 MB");
    expect(root.textContent).toContain("Excel");
  });

  test("the link is named by title, type and size", () => {
    const link = render(block).querySelector("a");
    expect(link?.getAttribute("aria-label")).toBe(
      "Last ned Vedtekter (PDF, 1,2 MB)"
    );
  });

  test("uses the divided list and the v2 type roles", () => {
    const root = render(block);
    expect(classesOf(root.querySelector("ul"))).toContain("divide-y");
    expect(classesOf(root.querySelector("ul"))).toContain("divide-edge");
    expect(html(block)).toContain("type-heading-card");
    expect(html(block)).toContain("type-body-sm");
    expect(html(block)).toContain("text-ink-muted");
  });

  test("an unsafe link is not rendered as a link on the site", () => {
    const root = render({
      ...block,
      items: [{ src: "javascript:alert(1)", title: "Ond" }],
    });
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("");
  });

  test("renders nothing on the site without items", () => {
    expect(html({ ...block, items: [] })).toBe(
      '<section data-surface="deep"></section>'
    );
  });

  test("shows an explanation in the editor without items", () => {
    expect(render({ ...block, items: [] }, true).textContent).toContain(
      "Add documents"
    );
  });

  test("the editor shows rows with an inert link", () => {
    const root = render(block, true);
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("Vedtekter");
  });

  test("survives junk", () => {
    for (const b of [
      { ...block, items: [null, "x", 3, { title: 4, size: "big" }] },
      { ...block, items: "oops", heading: 3 },
    ]) {
      expect(() => html(b)).not.toThrow();
      expect(() => html(b, true)).not.toThrow();
    }
  });
});
