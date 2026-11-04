import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  jest,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import type { PlateEditor } from "platejs/react";
import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import { findBlock } from "@/editor/tree";
import type { TextBlock } from "@/editor/types";
import { bodyPatch, bodyToHtml, legacyBodyToHtml } from "../body";
import { RICH_CLASS } from "../render-classes";
import RichTextField, { type RichTextFieldProps } from "./field";
import { RichPastePlugin } from "./paste-plugin";
import { RichKeysPlugin } from "./react-plugins";

/** What Slate, Plate, floating-ui and React DOM read from the global scope. */
const GLOBALS = [
  "CustomEvent",
  "DOMParser",
  "Document",
  "Element",
  "HTMLElement",
  "Node",
  "ShadowRoot",
  "cancelAnimationFrame",
  "document",
  "getComputedStyle",
  // Slate scrolls the caret into view after typing in a field it saw focus.
  "innerHeight",
  "innerWidth",
  "requestAnimationFrame",
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
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
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

/** How long an unfocused field waits before it takes a changed prop. */
const TAKE_DELAY = 300;

/** Move the fake clock on, as `settle` does for the change it causes. */
const advance = (ms: number) => settle(() => jest.advanceTimersByTime(ms));

type Emit = RichTextFieldProps["onChange"];
type PageStep = NonNullable<RichTextFieldProps["onPageHistory"]>;

interface Field {
  editor: () => PlateEditor;
  props: (html: string) => RichTextFieldProps;
  spy: ReturnType<typeof mock<Emit>>;
}

/** One field's fixed props; `html` is given per render. */
function field(
  variant: RichTextFieldProps["variant"] = "canvas",
  label = "Rich text",
  onPageHistory?: PageStep
): Field {
  const editorRef: { current: unknown } = { current: null };
  const spy = mock<Emit>(() => undefined);
  return {
    editor: () => editorRef.current as PlateEditor,
    props: (html) => ({
      editorRef,
      html,
      label,
      onChange: spy,
      onPageHistory,
      variant,
    }),
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
  const unmount = () => act(() => root.render(null));
  return { editables, host, render, unmount };
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

/** Focus leaves the field, as a click elsewhere on the page does. */
const blur = (editor: PlateEditor, editable: HTMLElement | undefined) =>
  settle(() => {
    editor.api.isFocused = () => false;
    editable?.dispatchEvent(
      new window.FocusEvent("focusout", { bubbles: true })
    );
  });

/** Focus comes back to the field. */
const refocus = (editor: PlateEditor, editable: HTMLElement | undefined) =>
  settle(() => {
    editable?.dispatchEvent(
      new window.FocusEvent("focusin", { bubbles: true })
    );
    markFocused(editor);
  });

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
// through `start`. Each level below the first sits 1.25rem further in, the
// public page's step (every top-level list already has `pl-5`).
test("each list item is its own list, numbered on and indented by depth", async () => {
  const { editables, host, render } = mount(field());
  await render(
    '<ol start="3"><li>a</li><li>b</li></ol><ul><li>c<ul><li>d<ul><li>e</li></ul></li></ul></li></ul>'
  );

  const items = [...(editables()[0]?.children ?? [])] as HTMLElement[];
  expect(items.map((item) => item.tagName)).toEqual([
    "OL",
    "OL",
    "UL",
    "UL",
    "UL",
  ]);
  expect(items.map((item) => item.textContent)).toEqual([
    "a",
    "b",
    "c",
    "d",
    "e",
  ]);
  expect(items.map((item) => item.getAttribute("start"))).toEqual([
    "3",
    "4",
    null,
    null,
    null,
  ]);
  expect(items.map((item) => item.style.marginLeft)).toEqual([
    "",
    "",
    "",
    "1.25rem",
    "2.5rem",
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
  // The legacy prop is not the canonical HTML, so it waits its turn too.
  await advance(TAKE_DELAY);
  expect(a.spy).not.toHaveBeenCalled();
  expect(a.editor().history.undos).toEqual([]);
});

test("a coloured run shows as its token span on the canvas", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render('<p><span data-color="red">x</span></p>');

  const span = editables()[0]?.querySelector("span[data-color]");
  expect(span?.getAttribute("data-color")).toBe("red");
  expect(span?.textContent).toBe("x");
  await advance(TAKE_DELAY);
  expect(a.spy).not.toHaveBeenCalled();
});

test("a stored table is a real table on the canvas", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render(
    '<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td colspan="2">Ada</td></tr></tbody></table>'
  );

  const table = editables()[0]?.querySelector("table");
  // The header row in a thead, as the page writes it, so it wears the
  // page's header background.
  const header = table?.querySelectorAll(":scope > thead > tr > th");
  expect([...(header ?? [])].map((th) => th.textContent)).toEqual([
    "Name",
    "Role",
  ]);
  const merged = table?.querySelector(':scope > tbody > tr > td[colspan="2"]');
  expect(merged?.textContent).toBe("Ada");
  expect(merged?.hasAttribute("rowspan")).toBe(false);
  // Plain tags, so the canvas wears the public classes.
  for (const tag of ["table", "tr", "th", "td"]) {
    expect(
      editables()[0]?.querySelector(tag)?.getAttribute("class")
    ).toBeNull();
  }
  await advance(TAKE_DELAY);
  expect(a.spy).not.toHaveBeenCalled();
});

test("typing emits the new HTML", async () => {
  const a = field();
  const { render } = mount(a);
  await render("<p>a</p>");
  await typeText(a.editor(), "!");
  expect(a.spy).toHaveBeenCalledTimes(1);
  expect(a.spy).toHaveBeenCalledWith("<p>a!</p>");

  // The page hands the emitted HTML straight back.
  const setValue = spyOn(a.editor().tf, "setValue");
  await render("<p>a!</p>");
  await advance(TAKE_DELAY);
  expect(setValue).not.toHaveBeenCalled();
  expect(a.spy).toHaveBeenCalledTimes(1);
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
  await advance(TAKE_DELAY);
  expect(setValue).not.toHaveBeenCalled();
  expect(a.editor().selection).toEqual(selection);
  expect(editables()[1]?.textContent).toBe("a!");
  // Taking the prop is not an edit of B's own.
  expect(b.spy).not.toHaveBeenCalled();
  expect(a.spy).toHaveBeenCalledTimes(1);
});

// Long pasted documents: both surfaces stay mounted, so a keystroke must not
// make the focused one parse its own echo.
test("a focused field parses no prop at all", async () => {
  const html = await import("./html");
  const a = field();
  const { render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");
  const parse = spyOn(html, "htmlToValue");
  try {
    await render("<p>a!</p>");
    await render("<p>other</p>");
    await advance(TAKE_DELAY * 2);
    expect(parse).not.toHaveBeenCalled();
  } finally {
    parse.mockRestore();
  }
});

test("an unfocused field takes a changed prop 300 ms after the last change", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  const setValue = spyOn(a.editor().tf, "setValue");

  await render("<p>b</p>");
  await advance(TAKE_DELAY - 1);
  await render("<p>c</p>");
  await advance(TAKE_DELAY - 1);
  expect(setValue).not.toHaveBeenCalled();
  expect(editables()[0]?.textContent).toBe("a");

  await advance(1);
  expect(setValue).toHaveBeenCalledTimes(1);
  expect(editables()[0]?.textContent).toBe("c");
  expect(a.spy).not.toHaveBeenCalled();
});

test("a field that unmounts drops its pending prop", async () => {
  const a = field();
  const { render, unmount } = mount(a);
  await render("<p>a</p>");
  const setValue = spyOn(a.editor().tf, "setValue");
  await render("<p>b</p>");
  unmount();
  await advance(TAKE_DELAY);
  expect(setValue).not.toHaveBeenCalled();
});

test("focusing a field takes its pending prop at once", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  await render("<p>b</p>");
  expect(editables()[0]?.textContent).toBe("a");

  await settle(() => {
    editables()[0]?.dispatchEvent(
      new window.FocusEvent("focusin", { bubbles: true })
    );
  });
  expect(editables()[0]?.textContent).toBe("b");
  expect(a.spy).not.toHaveBeenCalled();
});

test("taking a prop starts the field's undo history again", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  await typeText(a.editor(), "!");
  expect(a.editor().history.undos.length).toBeGreaterThan(0);

  await render("<p>other</p>");
  await advance(TAKE_DELAY);
  expect(editables()[0]?.textContent).toBe("other");
  expect(a.editor().history.undos).toHaveLength(0);
  expect(a.editor().history.redos).toHaveLength(0);
});

// An outside change (the copilot, or the other surface's toolbar) that lands
// while the field is focused waits for the field to lose focus.
test("a focused field keeps its text when the prop changes under it, and takes it after blur", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");

  await render("<p>other</p>");
  await advance(TAKE_DELAY);
  expect(editables()[0]?.textContent).toBe("a!");
  expect(a.spy).toHaveBeenCalledTimes(1);

  await blur(a.editor(), editables()[0]);
  await advance(TAKE_DELAY - 1);
  expect(editables()[0]?.textContent).toBe("a!");
  await advance(1);
  expect(editables()[0]?.textContent).toBe("other");
  // Taking it is not an edit of the field's own.
  expect(a.spy).toHaveBeenCalledTimes(1);

  await refocus(a.editor(), editables()[0]);
  await typeText(a.editor(), "?");
  expect(a.spy).toHaveBeenLastCalledWith("<p>other?</p>");
});

test("refocused straight after blur, the field takes the outside change on focus", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");
  await render("<p>COPILOT REWRITE</p>");

  await blur(a.editor(), editables()[0]);
  await refocus(a.editor(), editables()[0]);
  expect(editables()[0]?.textContent).toBe("COPILOT REWRITE");

  await typeText(a.editor(), "?");
  // The take blur scheduled finds nothing left to do.
  await advance(TAKE_DELAY);
  expect(a.spy.mock.calls.map(([html]) => html)).toEqual([
    "<p>a!</p>",
    "<p>COPILOT REWRITE?</p>",
  ]);
  expect(editables()[0]?.textContent).toBe("COPILOT REWRITE?");
});

/** Opens or closes the toolbar's link input, as mod+k and its buttons do. */
const setLinkOpen = (editor: PlateEditor, open: boolean) =>
  settle(() => editor.setOption(RichKeysPlugin, "linkOpen", open));

// The link input acts on the selection in the text it opened on.
test("an outside change waits while the link input is open, and is taken when it closes", async () => {
  const a = field("panel", "Text");
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  await setLinkOpen(a.editor(), true);

  await render("<p>b</p>");
  await advance(TAKE_DELAY * 3);
  expect(editables()[0]?.textContent).toBe("a");

  await setLinkOpen(a.editor(), false);
  expect(editables()[0]?.textContent).toBe("b");
  expect(a.spy).not.toHaveBeenCalled();
});

test("a take scheduled before the link input opened does not fire while it is open", async () => {
  const a = field("panel", "Text");
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  await render("<p>b</p>");
  await advance(TAKE_DELAY - 1);
  await setLinkOpen(a.editor(), true);
  await advance(10);
  expect(editables()[0]?.textContent).toBe("a");

  await setLinkOpen(a.editor(), false);
  expect(editables()[0]?.textContent).toBe("b");
});

test("a press in the open link input takes no outside change", async () => {
  const a = field("panel", "Text");
  const { editables, host, render } = mount(a);
  await render("<p>a</p>");
  await setLinkOpen(a.editor(), true);
  await render("<p>b</p>");

  const apply = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Apply"
  );
  await settle(() => {
    apply?.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, cancelable: true })
    );
  });
  expect(apply).toBeDefined();
  expect(editables()[0]?.textContent).toBe("a");
});

/**
 * A Ctrl key press on the editable, as the browser sends it: Plate reads
 * `key`, Slate's own undo and redo read `which`.
 */
const pressKey = (
  editable: HTMLElement | undefined,
  init: { code: string; key: string; shiftKey?: boolean; which: number }
) =>
  settle(() => {
    editable?.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        keyCode: init.which,
        ...init,
      })
    );
  });

const UNDO = { code: "KeyZ", key: "z", which: 90 };
const REDO = { code: "KeyZ", key: "Z", shiftKey: true, which: 90 };
/** Redo on Windows and Linux, as well as Ctrl+Shift+Z. */
const REDO_Y = { code: "KeyY", key: "y", which: 89 };

/** The keydown events the editable saw, to read `defaultPrevented` from. */
const keydowns = (editable: HTMLElement | undefined): KeyboardEvent[] => {
  const seen: KeyboardEvent[] = [];
  editable?.addEventListener("keydown", (event) => seen.push(event));
  return seen;
};

// With nothing of its own to undo, mod+z in a field undoes the page, which
// the shell's own shortcut leaves to focused text.
test("mod+z with an empty field history steps the page back and shows the result at once", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  const seen = keydowns(editables()[0]);

  await pressKey(editables()[0], UNDO);
  expect(pageHistory.mock.calls).toEqual([["undo"]]);
  expect(seen[0]?.defaultPrevented).toBe(true);

  // The page's previous body, while the field is still focused.
  await render("<p>before</p>");
  expect(editables()[0]?.textContent).toBe("before");
  expect(a.spy).not.toHaveBeenCalled();
});

test("mod+shift+z with an empty redo history steps the page forward", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  const seen = keydowns(editables()[0]);

  await pressKey(editables()[0], REDO);
  expect(pageHistory.mock.calls).toEqual([["redo"]]);
  expect(seen[0]?.defaultPrevented).toBe(true);
  await render("<p>after</p>");
  expect(editables()[0]?.textContent).toBe("after");
});

test("Ctrl+Y with an empty redo history steps the page forward, as Ctrl+Shift+Z does", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  const seen = keydowns(editables()[0]);

  await pressKey(editables()[0], REDO_Y);
  expect(pageHistory.mock.calls).toEqual([["redo"]]);
  expect(seen[0]?.defaultPrevented).toBe(true);
  await render("<p>after</p>");
  expect(editables()[0]?.textContent).toBe("after");
});

test("mod+z after typing undoes the typing in the field, not the page", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");

  await pressKey(editables()[0], UNDO);
  expect(pageHistory).not.toHaveBeenCalled();
  expect(editables()[0]?.textContent).toBe("a");
});

test("the field's own undo and redo report their change as history-neutral; typing does not", async () => {
  const a = field(
    "canvas",
    "Rich text",
    mock<PageStep>(() => undefined)
  );
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());
  await typeText(a.editor(), "!");
  expect(a.spy.mock.calls).toEqual([["<p>a!</p>"]]);

  await pressKey(editables()[0], UNDO);
  await pressKey(editables()[0], REDO);
  await typeText(a.editor(), "?");
  expect(a.spy.mock.calls).toEqual([
    ["<p>a!</p>"],
    ["<p>a</p>", { historyNeutral: true }],
    ["<p>a!</p>", { historyNeutral: true }],
    ["<p>a!?</p>"],
  ]);
});

test("a page step that changes nothing here takes nothing later", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());

  await pressKey(editables()[0], UNDO);
  expect(pageHistory).toHaveBeenCalledTimes(1);
  await typeText(a.editor(), "x");
  expect(a.spy).toHaveBeenLastCalledWith("<p>ax</p>");

  // An outside change, while the field is focused, waits as ever.
  await render("<p>z</p>");
  expect(editables()[0]?.textContent).toBe("ax");
});

test("a page step is forgotten when focus leaves the field", async () => {
  const pageHistory = mock<PageStep>(() => undefined);
  const a = field("canvas", "Rich text", pageHistory);
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());

  await pressKey(editables()[0], UNDO);
  await blur(a.editor(), editables()[0]);
  await refocus(a.editor(), editables()[0]);
  await render("<p>z</p>");
  expect(editables()[0]?.textContent).toBe("a");
});

test("without onPageHistory, mod+z in an empty field changes nothing", async () => {
  const a = field();
  const { editables, render } = mount(a);
  await render("<p>a</p>");
  markFocused(a.editor());

  await pressKey(editables()[0], UNDO);
  expect(editables()[0]?.textContent).toBe("a");
  expect(a.spy).not.toHaveBeenCalled();
});

/**
 * Block `b1` of the page store in a field wired as the canvas wires it: the
 * body from the store, each change through `bodyPatch`, and mod+z past the
 * field's own history to the page's.
 */
function StoreField({ editorRef }: { editorRef: { current: unknown } }) {
  const block = useEditorStore((s) => findBlock(s.doc, "b1")?.block);
  const setProp = useEditorStore((s) => s.setProp);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const text = block as TextBlock;
  return createElement(RichTextField, {
    editorRef,
    html: bodyToHtml(text.body),
    label: "Rich text",
    onChange: bodyPatch(text, (path, value, options) =>
      setProp(text.id, path, value, options)
    ),
    onPageHistory: (step) => (step === "undo" ? undo() : redo()),
    variant: "canvas",
  });
}

/** A prop of block `id` in the page store. */
const storeProp = (id: string, key: "body" | "title"): unknown =>
  (
    findBlock(useEditorStore.getState().doc, id)?.block as
      | Record<string, unknown>
      | undefined
  )?.[key];

// The field's own undo writes the body back without a page step of its
// own, so the page's undo after it never brings the typing back. Redo walks
// forward through the same steps.
test("mod+z after a pause undoes the typing, then the step before it, and never replays the typing", async () => {
  setSystemTime(new Date("2026-11-03T10:00:00Z"));
  const store = useEditorStore.getState();
  store.setDoc(doc(section("s-1", "1-1", [["b1"], ["b2"]])));
  const title = storeProp("b2", "title");
  // The step before the typing.
  store.setProp("b2", "title", "Earlier");
  const original = storeProp("b1", "body") as string;

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const editorRef: { current: unknown } = { current: null };
  await settle(() => root.render(createElement(StoreField, { editorRef })));
  const editor = editorRef.current as PlateEditor;
  const editable = () =>
    host.querySelector("[contenteditable]") as HTMLElement | null;
  const shown = () => editable()?.textContent ?? "";
  const before = shown();
  markFocused(editor);

  await typeText(editor, "Hello");
  expect(shown()).toBe(`${before}Hello`);
  expect(storeProp("b1", "body")).toContain("Hello");
  expect(useEditorStore.getState().past).toHaveLength(2);

  setSystemTime(new Date("2026-11-03T10:00:02Z"));
  // The field undoes its own typing, and the page's step for it goes.
  await pressKey(editable() ?? undefined, UNDO);
  expect(shown()).toBe(before);
  expect(storeProp("b1", "body")).toBe(original);
  expect(useEditorStore.getState().past).toHaveLength(1);

  // Nothing left in the field: the page undoes the step before the typing.
  await pressKey(editable() ?? undefined, UNDO);
  expect(storeProp("b2", "title")).toBe(title);
  expect(storeProp("b1", "body")).toBe(original);
  expect(shown()).toBe(before);
  expect(useEditorStore.getState().past).toHaveLength(0);

  // Redo walks forward: the step before the typing, then the typing.
  await pressKey(editable() ?? undefined, REDO);
  expect(storeProp("b2", "title")).toBe("Earlier");
  expect(shown()).toBe(before);
  await pressKey(editable() ?? undefined, REDO);
  expect(storeProp("b1", "body")).toContain("Hello");
  expect(shown()).toBe(`${before}Hello`);
  expect(useEditorStore.getState().future).toHaveLength(0);
  setSystemTime();
});

const T0 = new Date("2026-11-03T10:00:00Z").getTime();

/** How many steps the page can undo and redo. */
const pageHistory = () => {
  const { future, past } = useEditorStore.getState();
  return { future: future.length, past: past.length };
};

/**
 * At `T0`, a one-block page with `b1` in a focused `StoreField`: what it
 * shows, and the text and body it started with.
 */
async function focusedStoreField() {
  setSystemTime(T0);
  useEditorStore.getState().setDoc(doc(section("s-1", "1", [["b1"]])));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const entry = { host, root };
  mounted.push(entry);
  const editorRef: { current: unknown } = { current: null };
  await settle(() => root.render(createElement(StoreField, { editorRef })));
  const editor = editorRef.current as PlateEditor;
  markFocused(editor);
  const editable = () =>
    (host.querySelector("[contenteditable]") as HTMLElement | null) ??
    undefined;
  const shown = () => editable()?.textContent ?? "";
  return {
    before: shown(),
    editor,
    original: storeProp("b1", "body"),
    press: (key: typeof UNDO) => pressKey(editable(), key),
    shown,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
      mounted = mounted.filter((m) => m !== entry);
    },
  };
}

// A pause of a second or more opens a page step, and the field's own undo
// steps at the same places, so neither undo spans two of the other's steps.
test("each pause in typing is its own undo step, in the field and on the page", async () => {
  const f = await focusedStoreField();
  await typeText(f.editor, "Hello");
  expect(pageHistory().past).toBe(1);
  setSystemTime(T0 + 2000);
  await typeText(f.editor, " world");
  expect(pageHistory().past).toBe(2);
  setSystemTime(T0 + 4000);

  await f.press(UNDO);
  expect(f.shown()).toBe(`${f.before}Hello`);
  expect(pageHistory()).toEqual({ future: 1, past: 1 });
  await f.press(UNDO);
  expect(f.shown()).toBe(f.before);
  expect(storeProp("b1", "body")).toBe(f.original);
  expect(pageHistory()).toEqual({ future: 2, past: 0 });

  await f.press(REDO);
  expect(f.shown()).toBe(`${f.before}Hello`);
  expect(pageHistory()).toEqual({ future: 1, past: 1 });
  await f.press(REDO);
  expect(f.shown()).toBe(`${f.before}Hello world`);
  expect(pageHistory()).toEqual({ future: 0, past: 2 });
  setSystemTime();
});

test("a pause of exactly one second splits the field and the page alike", async () => {
  const split = await focusedStoreField();
  await typeText(split.editor, "Hello");
  setSystemTime(T0 + 1000);
  await typeText(split.editor, " world");
  expect(pageHistory().past).toBe(2);
  await split.press(UNDO);
  expect(split.shown()).toBe(`${split.before}Hello`);
  expect(pageHistory().past).toBe(1);
  split.unmount();

  const joined = await focusedStoreField();
  await typeText(joined.editor, "Hello");
  setSystemTime(T0 + 999);
  await typeText(joined.editor, " world");
  expect(pageHistory().past).toBe(1);
  await joined.press(UNDO);
  expect(joined.shown()).toBe(joined.before);
  expect(pageHistory().past).toBe(0);
  setSystemTime();
});

test("typing straight after a field undo is a step of its own", async () => {
  const f = await focusedStoreField();
  await typeText(f.editor, "Hello");
  setSystemTime(T0 + 2000);
  await typeText(f.editor, " world");
  await f.press(UNDO);
  expect(f.shown()).toBe(`${f.before}Hello`);

  await typeText(f.editor, "!");
  expect(f.shown()).toBe(`${f.before}Hello!`);
  expect(pageHistory().past).toBe(2);
  await f.press(UNDO);
  expect(f.shown()).toBe(`${f.before}Hello`);
  expect(pageHistory().past).toBe(1);
  await f.press(UNDO);
  expect(f.shown()).toBe(f.before);
  expect(pageHistory().past).toBe(0);
  setSystemTime();
});

// The copilot writes the body while the field is focused, so the field has
// not taken it. mod+z takes it first, and the page's undo then reverts it
// before the typing. The field's own undo would write over it, with no page
// step to bring it back.
test("a copilot change the field has not taken stays reachable by undo and redo", async () => {
  const f = await focusedStoreField();
  await typeText(f.editor, "Hello");
  expect(pageHistory().past).toBe(1);
  setSystemTime(T0 + 2000);
  await settle(() =>
    useEditorStore.getState().setProp("b1", "body", "<p>Copilot</p>", {
      coalesce: "copilot:b1:body",
    })
  );
  expect(f.shown()).toBe(`${f.before}Hello`);
  expect(pageHistory().past).toBe(2);

  await f.press(UNDO);
  expect(storeProp("b1", "body")).toContain("Hello");
  expect(storeProp("b1", "body")).not.toContain("Copilot");
  expect(f.shown()).toBe(`${f.before}Hello`);
  expect(pageHistory()).toEqual({ future: 1, past: 1 });
  await f.press(UNDO);
  expect(storeProp("b1", "body")).toBe(f.original);
  expect(f.shown()).toBe(f.before);
  expect(pageHistory().past).toBe(0);

  await f.press(REDO);
  expect(storeProp("b1", "body")).toContain("Hello");
  await f.press(REDO);
  expect(storeProp("b1", "body")).toBe("<p>Copilot</p>");
  expect(f.shown()).toBe("Copilot");
  expect(pageHistory().future).toBe(0);
  setSystemTime();
});

test("a legacy prop re-rendered, or in its canonical form, triggers no setValue and no emit", async () => {
  const a = field();
  const { render } = mount(a);
  await render("<p>A <b>b</b></p>");
  const setValue = spyOn(a.editor().tf, "setValue");
  await advance(TAKE_DELAY);

  await render("<p>A <b>b</b></p>");
  await render("<p>A <strong>b</strong></p>");
  await advance(TAKE_DELAY);
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

const NOTICE = "Images aren't pasted into text — use an Image block.";
const NOTICE_MS = 6000;

/** A paste that dropped an image, as the paste plugin counts it. */
const dropImage = (editor: PlateEditor) =>
  settle(() => {
    editor.setOption(
      RichPastePlugin,
      "imageNotices",
      editor.getOption(RichPastePlugin, "imageNotices") + 1
    );
  });

test.each([
  "canvas",
  "panel",
] as const)("a dropped image shows a notice for six seconds (%s)", async (variant) => {
  const a = field(variant);
  const { host, render } = mount(a);
  await render("<p>a</p>");
  const region = host.querySelector('[role="status"]');
  expect(region?.className).toBe("pe-rt-notice");
  expect(region?.textContent).toBe("");
  expect(region?.parentElement?.className).toBe("pe-rt-wrap");
  await dropImage(a.editor());
  expect(region?.textContent).toBe(NOTICE);
  await advance(NOTICE_MS - 1);
  expect(region?.textContent).toBe(NOTICE);
  await advance(1);
  expect(region?.textContent).toBe("");
});

test("a second dropped image restarts the notice", async () => {
  const a = field();
  const { host, render } = mount(a);
  await render("<p>a</p>");
  const region = host.querySelector('[role="status"]');
  await dropImage(a.editor());
  await advance(4000);
  await dropImage(a.editor());
  await advance(4000);
  expect(region?.textContent).toBe(NOTICE);
  await advance(2000);
  expect(region?.textContent).toBe("");
});

test("a field that unmounts with a notice showing leaves no timer behind", async () => {
  const a = field();
  const { render, unmount } = mount(a);
  await render("<p>a</p>");
  await dropImage(a.editor());
  const showing = jest.getTimerCount();
  await unmount();
  expect(jest.getTimerCount()).toBeLessThan(showing);
});
