import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import type { PlateEditor } from "platejs/react";
import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { legacyBodyToHtml } from "../body";
import { RICH_CLASS } from "../render-classes";
import RichTextField, { type RichTextFieldProps } from "./field";

/** What Slate, Plate and React DOM read from the global scope here. */
const GLOBALS = [
  "DOMParser",
  "Document",
  "Node",
  "ShadowRoot",
  "cancelAnimationFrame",
  "document",
  "window",
] as const;

const scope = globalThis as unknown as Record<string, unknown>;
const previous = Object.fromEntries(GLOBALS.map((key) => [key, scope[key]]));

beforeAll(() => {
  const win = new Window();
  const source = win as unknown as Record<string, unknown>;
  for (const key of GLOBALS) {
    scope[key] = key === "window" ? win : source[key];
  }
  scope.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  Object.assign(scope, previous);
  scope.IS_REACT_ACT_ENVIRONMENT = undefined;
});

let mounted: { host: HTMLElement; root: Root }[] = [];
afterEach(() => {
  for (const { host, root } of mounted) {
    act(() => root.unmount());
    host.remove();
  }
  mounted = [];
});

/**
 * `act` that lets Slate report the change: it calls `onChange` in a
 * microtask after the operations, which a sync `act` would end before.
 */
const settle = (run: () => void) =>
  act(async () => {
    run();
    await Promise.resolve();
  });

type Emit = (html: string) => void;

interface Field {
  editor: () => PlateEditor;
  props: (html: string) => RichTextFieldProps;
  spy: ReturnType<typeof mock<Emit>>;
}

/** One field's fixed props; `html` is given per render. */
function field(
  variant: RichTextFieldProps["variant"] = "canvas",
  label = "Rich text"
): Field {
  const editorRef: { current: unknown } = { current: null };
  const spy = mock<Emit>(() => undefined);
  return {
    editor: () => editorRef.current as PlateEditor,
    props: (html) => ({ editorRef, html, label, onChange: spy, variant }),
    spy,
  };
}

/** A root rendering the given fields side by side, all on one `html`. */
function mount(...fields: Field[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const render = (html: string) =>
    settle(() => {
      root.render(
        createElement(
          Fragment,
          null,
          ...fields.map((f) => createElement(RichTextField, f.props(html)))
        )
      );
    });
  const editables = () =>
    [...host.querySelectorAll("[contenteditable]")] as HTMLElement[];
  return { editables, host, render };
}

/** Put the caret at the end and type one character at a time, as keys do. */
const typeText = (editor: PlateEditor, text: string) =>
  settle(() => {
    editor.tf.select(editor.api.end([]));
    for (const char of text) {
      editor.tf.insertText(char);
    }
  });

/**
 * happy-dom can focus the contenteditable, but a focused Slate editor then
 * syncs the DOM selection through slate-dom, which read `globalThis.Node`
 * when first imported: before any test file here installs a DOM, since the
 * test process shares one module cache. Stub the one check the field reads.
 */
const markFocused = (editor: PlateEditor) => {
  editor.api.isFocused = () => true;
};

test("renders the stored HTML as editable content", async () => {
  const a = field();
  const { editables, host, render } = mount(a);
  await render("<h2>T</h2><ul><li>x</li></ul>");

  const [editable] = editables();
  expect(editable?.getAttribute("contenteditable")).toBe("true");
  expect(editable?.getAttribute("aria-label")).toBe("Rich text");
  expect(host.querySelector("h2")?.textContent).toBe("T");
  expect(host.querySelector("ul > li")?.textContent).toBe("x");
});

test("elements are plain tags; the canvas carries the public classes", async () => {
  const { editables, host, render } = mount(field());
  await render('<h2>T</h2><p>a <a href="https://biso.no">b</a></p><hr>');

  const [editable] = editables();
  expect(editable?.getAttribute("data-rich-edit")).toBe("1");
  expect(editable?.className).toContain(RICH_CLASS);
  expect(host.querySelector("[data-edit]")).toBeNull();
  for (const tag of ["h2", "p", "a", "hr"]) {
    expect(host.querySelector(tag)?.getAttribute("class")).toBeNull();
  }
  expect(host.querySelector("a")?.getAttribute("href")).toBe("https://biso.no");
});

// One <ul>/<ol> per list block, as Plate draws lists; the numbers carry on
// through `start` and Plate's indent margin shows the nesting.
test("each list item is its own list, numbered on and indented by depth", async () => {
  const { editables, host, render } = mount(field());
  await render(
    '<ol start="3"><li>a</li><li>b</li></ol><ul><li>c<ul><li>d</li></ul></li></ul>'
  );

  const items = [...(editables()[0]?.children ?? [])] as HTMLElement[];
  expect(items.map((item) => item.tagName)).toEqual(["OL", "OL", "UL", "UL"]);
  expect(items.map((item) => item.textContent)).toEqual(["a", "b", "c", "d"]);
  expect(items.map((item) => item.getAttribute("start"))).toEqual([
    "3",
    "4",
    null,
    null,
  ]);
  expect(items.map((item) => item.style.marginLeft)).toEqual([
    "24px",
    "24px",
    "24px",
    "48px",
  ]);
  expect(host.querySelector("li :is(ul, ol)")).toBeNull();
});

test("the panel variant has the panel class and no canvas marker", async () => {
  const { editables, render } = mount(field("panel", "Text"));
  await render("<p>a</p>");

  const [editable] = editables();
  expect(editable?.classList.contains("pe-rt-field")).toBe(true);
  expect(editable?.getAttribute("aria-label")).toBe("Text");
  expect(editable?.hasAttribute("data-rich-edit")).toBe(false);
});

test("mounting emits nothing", async () => {
  const a = field();
  const { render } = mount(a);
  await render(
    legacyBodyToHtml([
      { text: "Title", type: "h" },
      { text: "A <b>b</b>", type: "p" },
      { text: "x", type: "li" },
    ])
  );
  expect(a.spy).not.toHaveBeenCalled();
  expect(a.editor().history.undos).toEqual([]);
});

test("typing emits the new HTML", async () => {
  const a = field();
  const { render } = mount(a);
  await render("<p>a</p>");
  await typeText(a.editor(), "!");
  expect(a.spy).toHaveBeenCalledTimes(1);
  expect(a.spy).toHaveBeenCalledWith("<p>a!</p>");
});

test("focused field ignores the echo of its own change; unfocused field takes it", async () => {
  const a = field();
  const b = field("panel", "Text");
  const { editables, render } = mount(a, b);
  await render("<p>a</p>");
  markFocused(a.editor());

  await typeText(a.editor(), "!");
  expect(a.spy).toHaveBeenCalledWith("<p>a!</p>");
  const selection = structuredClone(a.editor().selection);
  const setValue = spyOn(a.editor().tf, "setValue");

  await render("<p>a!</p>");
  expect(setValue).not.toHaveBeenCalled();
  expect(a.editor().selection).toEqual(selection);
  expect(editables()[1]?.textContent).toBe("a!");
  // Taking the prop is not an edit of B's own.
  expect(b.spy).not.toHaveBeenCalled();
  expect(a.spy).toHaveBeenCalledTimes(1);
});

test("a focused field keeps its text when the prop changes under it", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");

  await render("<p>other</p>");
  expect(editables()[0]?.textContent).toBe("a!");
  expect(a.spy).toHaveBeenCalledTimes(1);
});

test("a legacy prop re-rendered, or in its canonical form, triggers no setValue and no emit", async () => {
  const a = field();
  const { render } = mount(a);
  await render("<p>A <b>b</b></p>");
  const setValue = spyOn(a.editor().tf, "setValue");

  await render("<p>A <b>b</b></p>");
  await render("<p>A <strong>b</strong></p>");
  expect(setValue).not.toHaveBeenCalled();
  expect(a.spy).not.toHaveBeenCalled();
});

test.each([
  ["b", "strong"],
  ["i", "em"],
  ["u", "u"],
])("mod+%s marks the selection", async (key, tag) => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  await settle(() => {
    const editor = a.editor();
    editor.tf.select([]);
    editables()[0]?.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: true,
        key,
      })
    );
  });
  expect(a.spy).toHaveBeenCalledWith(`<p><${tag}>a</${tag}></p>`);
});

test.each([
  ["- ", "<ul><li></li></ul>"],
  ["* ", "<ul><li></li></ul>"],
  ["1. ", "<ol><li></li></ol>"],
  ["1) ", "<ol><li></li></ol>"],
])("autoformat: %p starts a list", async (typed, html) => {
  const a = field();
  const { render } = mount(a);
  await render("");
  await typeText(a.editor(), typed);
  expect(a.spy).toHaveBeenLastCalledWith(html);
});

const fixture = (name: string): string =>
  readFileSync(join(import.meta.dir, "fixtures", `${name}.html`), "utf8");

/** The clipboard as Plate reads it: `types`, `getData` and `files`. */
const clipboard = (entries: Record<string, string>): DataTransfer =>
  ({
    files: [],
    getData: (format: string) => entries[format] ?? "",
    types: Object.keys(entries),
  }) as unknown as DataTransfer;

// RichPastePlugin must be the outermost insertData: if Plate's own HTML
// parser ran first, Word's mso-list paragraphs would arrive as paragraphs.
test("a Word list pasted into the field becomes a real list", async () => {
  const a = field();
  const { render } = mount(a);
  await render("");
  await settle(() => {
    const editor = a.editor();
    editor.tf.select(editor.api.end([]));
    editor.tf.insertData(
      clipboard({ "text/html": fixture("word-desktop"), "text/plain": "x" })
    );
  });
  expect(a.spy).toHaveBeenCalledTimes(1);
  expect(a.spy.mock.calls[0]?.[0]).toContain(
    "<ul><li>Sustainability and academic development</li><li>Student welfare<ul><li>Mental health</li></ul></li><li>Finance</li></ul>"
  );
});
