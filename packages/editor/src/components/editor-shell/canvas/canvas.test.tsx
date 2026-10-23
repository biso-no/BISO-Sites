import { afterEach, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import "@/blocks/index";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import type { PageDoc } from "@/editor/types";
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
