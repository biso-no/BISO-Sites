import { afterEach, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import "@/blocks/index";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import type { PageDoc } from "@/editor/types";
import { emptyHeader } from "@/header/empty-header";
import type { CanvasDrag } from "./drop";
import { CanvasPane } from "./index";

const twoSections = doc(
  section("s-1", "1-1", [["b-1", "b-2"], []]),
  section("s-2", "1", [["b-3"]])
);

type StoreState = ReturnType<typeof useEditorStore.getState>;

// Server rendering reads a zustand store's *initial* state (its server
// snapshot), so these tests seed that object and restore it afterwards.
const pristine = { ...useEditorStore.getInitialState() };
const seed = (patch: Partial<StoreState>) =>
  Object.assign(useEditorStore.getInitialState(), patch);

const render = (
  page: PageDoc,
  drag: CanvasDrag | null = null,
  patch: Partial<StoreState> = {}
) => {
  seed({ doc: page, ...patch });
  return renderToStaticMarkup(
    <DndContext>
      <CanvasPane drag={drag} />
    </DndContext>
  );
};

const count = (html: string, needle: string) => html.split(needle).length - 1;
const FIRST_SECTION_MARKED =
  /data-section-id="s-1"[^>]*>\s*<section class="pg-sec"[^>]*data-first=""/;
const SECOND_SECTION_UNMARKED =
  /data-section-id="s-2"[^>]*>\s*<section class="pg-sec"(?![^>]*data-first)[^>]*>/;

afterEach(() => {
  Object.assign(useEditorStore.getInitialState(), pristine);
});

test("edit mode marks the frame and gives every column and boundary its controls", () => {
  const html = render(twoSections);
  expect(html).toContain("data-editing");
  expect(count(html, 'class="pg-sec"')).toBe(2);
  expect(count(html, 'class="pe-section"')).toBe(2);
  // Three columns, three "+ Add block".
  expect(count(html, "+ Add block")).toBe(3);
  expect(count(html, 'class="pe-col"')).toBe(3);
  // Before each section and after the last.
  expect(count(html, "+ Add section")).toBe(3);
  // The empty column shows its placeholder.
  expect(count(html, "data-empty")).toBe(1);
  // One zipper: between b-1 and b-2.
  expect(count(html, 'class="pe-zipper"')).toBe(1);
});

test("preview shows the page without editor chrome", () => {
  const html = render(twoSections, null, { mode: "preview" });
  expect(html).not.toContain("data-editing");
  expect(html).not.toContain("+ Add block");
  expect(html).not.toContain("+ Add section");
  expect(html).not.toContain("pe-zipper");
  expect(count(html, 'class="pg-sec"')).toBe(2);
});

test("an empty page offers the six layouts", () => {
  const html = render(doc());
  expect(html).toContain("Add your first section");
  for (const label of [
    "One column",
    "Two equal columns",
    "Wide left",
    "Wide right",
    "Three columns",
    "Four columns",
  ]) {
    expect(html).toContain(`aria-label="${label}"`);
  }
});

test("a selected section shows its tag, handle and actions", () => {
  const html = render(twoSections, null, { selectedSectionId: "s-1" });
  expect(html).toContain('class="pe-section selected"');
  expect(html).toContain("Section · 2 columns");
  expect(html).toContain('aria-label="Move section 1"');
  expect(html).toContain('title="Delete section"');
  expect(count(html, "pe-section__bar")).toBe(1);
});

test("the column '+ Add block' points at is highlighted", () => {
  const html = render(twoSections, null, {
    insertTarget: { columnId: "s-1-c1" },
  });
  expect(count(html, "data-target")).toBe(1);
  expect(html).toContain('aria-pressed="true"');
});

test("while dragging, zippers give way to drop slots and the frame says what is dragged", () => {
  const html = render(twoSections, {
    indicator: { kind: "before-block", blockId: "b-2" },
    source: { source: "palette", type: "text" },
  });
  expect(html).toContain('data-dragging="block"');
  expect(html).not.toContain('class="pe-zipper"');
  // One slot before each block, one per non-empty column end, one per boundary.
  expect(count(html, 'class="pe-drop-slot"')).toBe(3 + 2 + 3);
  // Only the slot before b-2 is lit.
  expect(count(html, "opacity:1;transition")).toBe(1);
});

test("the frame mounts the redesign's v2 surface and marks the first section", () => {
  const html = render(twoSections);
  expect(html).toContain('class="biso-surface biso-surface-v2 pe-frame desk"');
  // The canvas has no nav (`--pg-nav-offset: 0px`), so the mark costs nothing
  // there, and the canvas markup stays the site's.
  expect(html).toMatch(FIRST_SECTION_MARKED);
  expect(html).toMatch(SECOND_SECTION_UNMARKED);
});

const withHeader: PageDoc = {
  ...twoSections,
  header: { ...emptyHeader("Fadderullan"), eyebrow: "BISO Oslo" },
};
const HEADER_BEFORE_SECTIONS =
  /class="pe-section pe-header"[\s\S]*<header class="pg-header[\s\S]*data-section-id="s-1"/;

test("a page header sits above the sections, and the first section no longer clears the top", () => {
  const html = render(withHeader);
  expect(html).toMatch(HEADER_BEFORE_SECTIONS);
  expect(html).not.toMatch(FIRST_SECTION_MARKED);
  expect(html).not.toContain("+ Add page header");
});

test("a selected page header shows its tag and remove button", () => {
  const html = render(withHeader, null, { headerSelected: true });
  expect(html).toContain('class="pe-section pe-header selected"');
  expect(html).toContain("Page header");
  expect(html).toContain('title="Remove page header"');
});

test("without a header the editor offers one; preview shows nothing", () => {
  expect(render(twoSections)).toContain("+ Add page header");
  expect(render(doc())).toContain("+ Add page header");
  const preview = render(twoSections, null, { mode: "preview" });
  expect(preview).not.toContain("+ Add page header");
  expect(preview).not.toContain("pg-header");
});

test("preview shows the header without its chrome", () => {
  const html = render(withHeader, null, {
    headerSelected: true,
    mode: "preview",
  });
  expect(html).toContain("pg-header");
  expect(html).not.toContain("pe-section__bar");
  expect(html.toLowerCase()).not.toContain("contenteditable");
});
