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
import { textSwatches } from "@repo/shared/utils/text-colours";
import { Window } from "happy-dom";
import { NodeApi, type Path } from "platejs";
import { EventEditorStore, type PlateEditor } from "platejs/react";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type EditorCallbacks,
  EditorCallbacksContext,
} from "@/editor/callbacks";
import { useEditorStore } from "@/editor/store";
import type { EditorDepartment } from "@/editor/types";
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
  EventEditorStore.set("focus", null);
  useEditorStore.setState({ themePreview: null });
});

/** `act` that also lets Slate report the change (it does so in a microtask). */
const settle = (run: () => void) =>
  act(async () => {
    run();
    await Promise.resolve();
  });

type Emit = (html: string) => void;

/**
 * One field on `html`, inside `wrap` when given (read again on every
 * render). `editor.tf.focus` is stubbed: a focused Slate editor syncs the
 * DOM selection through slate-dom, which read `globalThis.Node` before any
 * test file here installed a DOM (one module cache per run).
 */
async function mountField(
  html: string,
  variant: RichTextFieldProps["variant"] = "panel",
  wrap: (field: ReactElement) => ReactElement = (field) => field
) {
  const editorRef: { current: unknown } = { current: null };
  const onChange = mock<Emit>(() => undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const rerender = (next: string) =>
    settle(() => {
      root.render(
        wrap(
          createElement(RichTextField, {
            editorRef,
            html: next,
            label: "Text",
            onChange,
            variant,
          })
        )
      );
    });
  await rerender(html);
  const editor = editorRef.current as PlateEditor;
  const focus = spyOn(editor.tf, "focus").mockImplementation(() => undefined);
  const $ = <T extends Element = HTMLElement>(selector: string) =>
    host.querySelector<T>(selector) as T | null;
  const editable = () => $("[contenteditable]") as HTMLElement;
  return { $, editable, editor, focus, host, onChange, rerender };
}

/** The button with this accessible name (its label, else its text). */
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll("button")].find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent) === name
  ) as HTMLButtonElement;

/**
 * A press as the browser sends it: mousedown, then click. A mouse click
 * counts one click (`detail`); Enter or Space on a button clicks with none.
 */
function press(target: HTMLElement): MouseEvent {
  const down = new window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(down);
  target.dispatchEvent(
    new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    })
  );
  return down as unknown as MouseEvent;
}

/** Enter or Space on a focused button: a click with no mouse behind it. */
const pressByKey = (target: HTMLElement) => target.click();

/** Type into the (uncontrolled) input: its value, then `input`. */
function typeInto(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

const keydown = (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

test("toolbar exposes labelled controls in order", async () => {
  const { $ } = await mountField("<p>a</p>");
  const bar = $(".pe-rt-bar");
  const labels = [...(bar?.querySelectorAll("[aria-label]") ?? [])].map(
    (control) => control.getAttribute("aria-label")
  );
  expect(labels).toEqual([
    "Text style",
    "Bold",
    "Italic",
    "Underline",
    "Text colour",
    "Link",
    "Bullet list",
    "Numbered list",
    "Insert table",
    "More formatting",
  ]);
  // Right above the text, in the wrapper that takes a pending prop.
  expect(
    bar?.parentElement?.nextElementSibling?.getAttribute("contenteditable")
  ).toBe("true");
  expect($(".pe-rt-bubble")).toBeNull();
});

test("Bold reflects and toggles the mark", async () => {
  const { editor, host, onChange } = await mountField(
    "<p><strong>a</strong></p>"
  );
  await settle(() => editor.tf.select([]));
  expect(button(host, "Bold").getAttribute("aria-pressed")).toBe("true");
  expect(button(host, "Italic").getAttribute("aria-pressed")).toBe("false");

  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(button(host, "Bold"));
  });
  expect(down?.defaultPrevented).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith("<p>a</p>");
  expect(button(host, "Bold").getAttribute("aria-pressed")).toBe("false");
});

test("Text style shows the block's style and changes it", async () => {
  const { $, editor, focus, onChange } = await mountField("<h2>T</h2>");
  await settle(() => editor.tf.select([]));
  const select = $<HTMLSelectElement>('select[aria-label="Text style"]');
  expect(select?.value).toBe("h2");
  expect(
    [...(select?.options ?? [])].map((option) => option.textContent)
  ).toEqual(["Heading", "Subheading", "Paragraph", "Quote"]);

  await settle(() => {
    if (select) {
      select.value = "blockquote";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    }
  });
  expect(onChange).toHaveBeenLastCalledWith("<blockquote>T</blockquote>");
  expect(select?.value).toBe("blockquote");
  expect(focus).toHaveBeenCalled();
});

test("list buttons reflect and toggle", async () => {
  const { editor, host, onChange } = await mountField("<p>a</p>");
  await settle(() => editor.tf.select([]));
  expect(button(host, "Bullet list").getAttribute("aria-pressed")).toBe(
    "false"
  );

  await settle(() => press(button(host, "Bullet list")));
  expect(onChange).toHaveBeenLastCalledWith("<ul><li>a</li></ul>");
  expect(button(host, "Bullet list").getAttribute("aria-pressed")).toBe("true");

  await settle(() => press(button(host, "Numbered list")));
  expect(onChange).toHaveBeenLastCalledWith("<ol><li>a</li></ol>");
  expect(button(host, "Numbered list").getAttribute("aria-pressed")).toBe(
    "true"
  );
  expect(button(host, "Bullet list").getAttribute("aria-pressed")).toBe(
    "false"
  );
});

const linkInput = (host: HTMLElement) =>
  host.querySelector<HTMLInputElement>('input[aria-label="Link address"]');

test("Link opens an address input; Apply links the selection", async () => {
  const { editor, focus, host, onChange } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  expect(linkInput(host)).toBeNull();

  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(button(host, "Link"));
  });
  expect(down?.defaultPrevented).toBe(true);
  const input = linkInput(host) as HTMLInputElement;
  expect(input).not.toBeNull();
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("");

  await settle(() => typeInto(input, "biso.no"));
  await settle(() => press(button(host, "Apply")));
  expect(onChange).toHaveBeenLastCalledWith(
    '<p><a href="https://biso.no">biso</a></p>'
  );
  expect(linkInput(host)).toBeNull();
  expect(focus).toHaveBeenCalled();
});

test("Enter applies; an unsafe address is refused and the input stays", async () => {
  const { editor, host, onChange } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Link")));
  const input = linkInput(host) as HTMLInputElement;

  await settle(() => typeInto(input, "javascript:alert(1)"));
  await settle(() => keydown(input, { key: "Enter" }));
  expect(onChange).not.toHaveBeenCalled();
  expect(linkInput(host)?.getAttribute("aria-invalid")).toBe("true");

  await settle(() => typeInto(input, "/events"));
  expect(linkInput(host)?.getAttribute("aria-invalid")).toBe("false");
  await settle(() => keydown(input, { key: "Enter" }));
  expect(onChange).toHaveBeenLastCalledWith(
    '<p><a href="/events">biso</a></p>'
  );
});

test("the input opens on the link's address; Remove unlinks", async () => {
  const { editor, host, onChange } = await mountField(
    '<p><a href="https://biso.no">biso</a></p>'
  );
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Link")));
  expect(linkInput(host)?.value).toBe("https://biso.no");

  await settle(() => press(button(host, "Remove")));
  expect(onChange).toHaveBeenLastCalledWith("<p>biso</p>");
  expect(linkInput(host)).toBeNull();
});

test("Remove is off when the selection holds no link", async () => {
  const { editor, host } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Link")));
  expect(button(host, "Remove").disabled).toBe(true);
});

test("Escape closes the link input and returns focus to the editor", async () => {
  const { editor, focus, host, onChange } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Link")));
  const input = linkInput(host) as HTMLInputElement;
  await settle(() => typeInto(input, "biso.no"));

  let escapeKey: KeyboardEvent | undefined;
  await settle(() => {
    escapeKey = keydown(input, { key: "Escape" });
  });
  expect(escapeKey?.defaultPrevented).toBe(true);
  expect(linkInput(host)).toBeNull();
  expect(focus).toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test("the Link button closes an open input and returns focus", async () => {
  const { editor, focus, host } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Link")));
  expect(button(host, "Link").getAttribute("aria-expanded")).toBe("true");
  expect(focus).not.toHaveBeenCalled();

  await settle(() => press(button(host, "Link")));
  expect(linkInput(host)).toBeNull();
  expect(button(host, "Link").getAttribute("aria-expanded")).toBe("false");
  expect(focus).toHaveBeenCalled();
});

test("Apply at a caret inserts the address as linked text", async () => {
  const { editor, host, onChange } = await mountField("<p>see </p>");
  await settle(() => editor.tf.select(editor.api.end([0])));
  await settle(() => press(button(host, "Link")));
  await settle(() => typeInto(linkInput(host) as HTMLInputElement, "biso.no"));
  await settle(() => press(button(host, "Apply")));
  expect(onChange).toHaveBeenLastCalledWith(
    '<p>see <a href="https://biso.no">https://biso.no</a></p>'
  );
  const links = [...editor.api.nodes({ at: [], match: { type: "a" } })];
  expect(links.map(([node]) => editor.api.string(node))).toEqual([
    "https://biso.no",
  ]);
});

test("Apply with no selection changes nothing and closes", async () => {
  const { editor, host, onChange } = await mountField("<p>see</p>");
  expect(editor.selection).toBeNull();
  await settle(() => press(button(host, "Link")));
  await settle(() => typeInto(linkInput(host) as HTMLInputElement, "biso.no"));
  await settle(() => press(button(host, "Apply")));
  expect(onChange).not.toHaveBeenCalled();
  expect(linkInput(host)).toBeNull();
});

test("the input closes when the selection moves to another link", async () => {
  const { editor, host } = await mountField(
    '<p><a href="/a">one</a> and <a href="/b">two</a></p>'
  );
  await settle(() => editor.tf.select(editor.api.start([0, 1])));
  await settle(() => press(button(host, "Link")));
  expect(linkInput(host)?.value).toBe("/a");

  await settle(() => editor.tf.select(editor.api.start([0, 3])));
  expect(linkInput(host)).toBeNull();
});

test("a toolbar command on an unfocused field first takes its pending prop", async () => {
  const { editor, host, onChange, rerender } = await mountField("<p>a</p>");
  await settle(() => editor.tf.select([]));
  await rerender("<p>b</p>");
  expect(host.querySelector("[contenteditable]")?.textContent).toBe("a");

  await settle(() => press(button(host, "Bold")));
  expect(host.querySelector("[contenteditable]")?.textContent).toBe("b");
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p><strong>b</strong></p>");
});

test("mod+k opens the link input", async () => {
  const { editable, editor, host } = await mountField("<p>biso</p>");
  await settle(() => editor.tf.select([]));
  let event: KeyboardEvent | undefined;
  await settle(() => {
    event = keydown(editable(), { code: "KeyK", ctrlKey: true, key: "k" });
  });
  expect(event?.defaultPrevented).toBe(true);
  expect(linkInput(host)).not.toBeNull();
});

test("Tab in a list nests the item; Shift+Tab takes it back out", async () => {
  const { editable, editor, onChange } = await mountField(
    "<ul><li>a</li><li>b</li></ul>"
  );
  await settle(() => editor.tf.select(editor.api.end([1])));
  let tab: KeyboardEvent | undefined;
  await settle(() => {
    tab = keydown(editable(), { code: "Tab", key: "Tab" });
  });
  expect(tab?.defaultPrevented).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith(
    "<ul><li>a<ul><li>b</li></ul></li></ul>"
  );

  await settle(() => {
    keydown(editable(), { code: "Tab", key: "Tab", shiftKey: true });
  });
  expect(onChange).toHaveBeenLastCalledWith("<ul><li>a</li><li>b</li></ul>");
});

test("Tab in a paragraph neither indents it nor keeps the key", async () => {
  const { editable, editor, onChange } = await mountField("<p>a</p>");
  await settle(() => editor.tf.select(editor.api.end([0])));
  let tab: KeyboardEvent | undefined;
  await settle(() => {
    tab = keydown(editable(), { code: "Tab", key: "Tab" });
  });
  expect(tab?.defaultPrevented).toBe(false);
  expect(editor.children[0]?.indent).toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
});

/**
 * Focus moving from `from` onto `to`, as the bubble's capture-phase
 * listeners see it: `focusout`, then (React has rendered in between, as in a
 * browser) `focusin`. The events do not bubble, so Slate's own focus handler
 * stays out of it (a focused Slate editor syncs the DOM selection; see
 * `mountField`); Plate's record of the focused editor is set by hand.
 */
async function moveFocus(
  editor: PlateEditor,
  to: HTMLElement | null,
  from: HTMLElement | null
): Promise<void> {
  const isEditable = (element: HTMLElement | null) =>
    element?.hasAttribute("contenteditable") === true;
  await settle(() => {
    from?.dispatchEvent(
      new window.FocusEvent("focusout", { relatedTarget: to })
    );
    if (isEditable(from)) {
      EventEditorStore.set("focus", null);
    }
  });
  await settle(() => {
    if (isEditable(to)) {
      EventEditorStore.set("focus", editor.id);
    }
    to?.dispatchEvent(new window.FocusEvent("focusin"));
  });
}

test("the canvas bubble shows over an expanded selection while focused", async () => {
  const { $, editable, editor } = await mountField("<p>biso</p>", "canvas");
  expect($(".pe-rt-bar")).toBeNull();
  await moveFocus(editor, editable(), null);
  expect($(".pe-rt-bubble")).toBeNull();

  await settle(() => editor.tf.select([]));
  const bubble = $(".pe-rt-bubble");
  expect(bubble).not.toBeNull();
  expect(bubble?.querySelector(".pe-rt-bar--ink")).not.toBeNull();
  expect(bubble?.querySelector('[aria-label="Bold"]')).not.toBeNull();

  await settle(() => editor.tf.collapse({ edge: "end" }));
  expect($(".pe-rt-bubble")).toBeNull();
});

test("mod+k on a canvas caret opens no input, now or with the next selection", async () => {
  const { $, editable, editor, host } = await mountField(
    "<p>biso</p>",
    "canvas"
  );
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select(editor.api.end([0])));
  let event: KeyboardEvent | undefined;
  await settle(() => {
    event = keydown(editable(), { code: "KeyK", ctrlKey: true, key: "k" });
  });
  // Still kept from the browser, whose Ctrl+K is its search bar on Windows
  // and Linux.
  expect(event?.defaultPrevented).toBe(true);

  await settle(() => editor.tf.select([]));
  expect($(".pe-rt-bubble")).not.toBeNull();
  expect(linkInput(host)).toBeNull();
  expect(document.activeElement?.tagName).not.toBe("INPUT");
});

test("a link input asked for while the bubble is hidden is dropped", async () => {
  const { editable, editor, host } = await mountField("<p>biso</p>", "canvas");
  await moveFocus(editor, editable(), null);
  await settle(() => editor.setOption(RichKeysPlugin, "linkOpen", true));
  expect(editor.getOption(RichKeysPlugin, "linkOpen")).toBe(false);
  await settle(() => editor.tf.select([]));
  expect(host.querySelector(".pe-rt-bubble")).not.toBeNull();
  expect(linkInput(host)).toBeNull();
});

test("mod+k over a canvas selection opens the input in the bubble", async () => {
  const { editable, editor, host } = await mountField("<p>biso</p>", "canvas");
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select([]));
  await settle(() => {
    keydown(editable(), { code: "KeyK", ctrlKey: true, key: "k" });
  });
  expect(host.querySelector(".pe-rt-bubble")?.contains(linkInput(host))).toBe(
    true
  );
});

test("a press on the bubble's own surface keeps focus where it is", async () => {
  const { $, editable, editor } = await mountField("<p>biso</p>", "canvas");
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select([]));
  const bubble = $(".pe-rt-bubble") as HTMLElement;
  const down = (target: Element) => {
    const event = new window.MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(down(bubble)).toBe(true);
  expect(down(bubble.querySelector(".pe-rt-sep") as Element)).toBe(true);
  expect(down(bubble.querySelector("select") as Element)).toBe(false);
});

test("the canvas bubble stays hidden while the editor is not focused", async () => {
  const { $, editor } = await mountField("<p>biso</p>", "canvas");
  await settle(() => editor.tf.select([]));
  expect($(".pe-rt-bubble")).toBeNull();
});

test("the bubble stays while focus moves into it, and goes when focus leaves", async () => {
  const { $, editable, editor, host } = await mountField(
    "<p>biso</p>",
    "canvas"
  );
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select([]));

  const select = $<HTMLSelectElement>('select[aria-label="Text style"]');
  await moveFocus(editor, select, editable());
  expect($(".pe-rt-bubble")).not.toBeNull();
  expect(button(host, "Bold")).toBeDefined();

  await moveFocus(editor, null, select);
  expect($(".pe-rt-bubble")).toBeNull();
});

/** The open popover with this label, or `null`. */
const group = (host: HTMLElement, label: string) =>
  host.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`);

/** The names of the buttons in the popover with this label. */
const groupButtons = (host: HTMLElement, label: string) =>
  [...(group(host, label)?.querySelectorAll("button") ?? [])].map(
    (element) => element.getAttribute("aria-label") ?? element.textContent
  );

test("Text colour opens the swatches; the current one is pressed", async () => {
  const { editor, host } = await mountField(
    '<p><span data-color="accent">a</span></p>'
  );
  await settle(() => editor.tf.select([]));
  const toggle = button(host, "Text colour");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.hasAttribute("aria-controls")).toBe(false);
  expect(toggle.hasAttribute("aria-haspopup")).toBe(false);

  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(toggle);
  });
  expect(down?.defaultPrevented).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(toggle.getAttribute("aria-controls")).toBe(
    group(host, "Text colour")?.id ?? "missing"
  );
  expect(groupButtons(host, "Text colour")).toEqual([
    "Default",
    "Accent",
    "Muted",
    "Green",
    "Amber",
    "Red",
  ]);
  expect(button(host, "Accent").getAttribute("aria-pressed")).toBe("true");
  expect(button(host, "Default").getAttribute("aria-pressed")).toBe("false");
});

test("a swatch colours the selection and closes the swatches", async () => {
  const { editor, focus, host, onChange } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  expect(button(host, "Default").getAttribute("aria-pressed")).toBe("true");

  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(button(host, "Red"));
  });
  expect(down?.defaultPrevented).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith(
    '<p><span data-color="red">ab</span></p>'
  );
  expect(group(host, "Text colour")).toBeNull();
  expect(button(host, "Text colour").getAttribute("aria-expanded")).toBe(
    "false"
  );
  expect(focus).toHaveBeenCalled();
});

test("the colour button shows the colour at the selection", async () => {
  const { editor, host } = await mountField(
    '<p><span data-color="red">a</span>b</p>'
  );
  const dot = () =>
    button(host, "Text colour").querySelector<HTMLElement>(
      ".pe-rt-colour__dot"
    );
  await settle(() => editor.tf.select(editor.api.start([0, 0])));
  const red = textSwatches(null).find((s) => s.token === "red")?.paper;
  expect(dot()?.style.backgroundColor).toBe(red ?? "");
  expect(dot()?.classList.contains("pe-rt-swatch--none")).toBe(false);

  await settle(() => editor.tf.select(editor.api.end([0])));
  expect(dot()?.style.backgroundColor).toBe("");
  expect(dot()?.classList.contains("pe-rt-swatch--none")).toBe(true);
});

test("Default removes the colour", async () => {
  const { editor, host, onChange } = await mountField(
    '<p><span data-color="red">ab</span></p>'
  );
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  await settle(() => press(button(host, "Default")));
  expect(onChange).toHaveBeenLastCalledWith("<p>ab</p>");
});

test("Escape closes the swatches and keeps the key", async () => {
  const { editor, focus, host, onChange } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));

  let escapeKey: KeyboardEvent | undefined;
  await settle(() => {
    escapeKey = keydown(button(host, "Red"), { key: "Escape" });
  });
  expect(escapeKey?.defaultPrevented).toBe(true);
  expect(group(host, "Text colour")).toBeNull();
  expect(document.activeElement).toBe(button(host, "Text colour"));
  expect(focus).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test("Escape outside an open popover is left alone", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  let escapeKey: KeyboardEvent | undefined;
  await settle(() => {
    escapeKey = keydown(button(host, "Text colour"), { key: "Escape" });
  });
  expect(escapeKey?.defaultPrevented).toBe(false);
});

test("a press outside closes the swatches", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  expect(group(host, "Text colour")).not.toBeNull();

  await settle(() => {
    document.body.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, cancelable: true })
    );
  });
  expect(group(host, "Text colour")).toBeNull();
  expect(button(host, "Text colour").getAttribute("aria-expanded")).toBe(
    "false"
  );
});

test("the colour button closes its own swatches", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  await settle(() => press(button(host, "Text colour")));
  expect(group(host, "Text colour")).toBeNull();
});

test("opened from the keyboard, the first swatch takes focus; by mouse, nothing moves", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  expect(document.activeElement).not.toBe(button(host, "Default"));
  await settle(() => press(button(host, "Text colour")));

  await settle(() => pressByKey(button(host, "Text colour")));
  expect(document.activeElement).toBe(button(host, "Default"));
});

test("More formatting holds strikethrough, divider and clear formatting", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  const toggle = button(host, "More formatting");
  expect(toggle.textContent).toBe("⋯");
  await settle(() => press(toggle));
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(toggle.getAttribute("aria-controls")).toBe(
    group(host, "More formatting")?.id ?? "missing"
  );
  expect(groupButtons(host, "More formatting")).toEqual([
    "Strikethrough",
    "Divider",
    "Clear formatting",
  ]);
  expect(button(host, "Divider").disabled).toBe(false);
});

test("Strikethrough toggles and shows its state", async () => {
  const { editor, focus, host, onChange } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "More formatting")));
  expect(button(host, "Strikethrough").getAttribute("aria-pressed")).toBe(
    "false"
  );
  await settle(() => press(button(host, "Strikethrough")));
  expect(onChange).toHaveBeenLastCalledWith("<p><s>ab</s></p>");
  expect(group(host, "More formatting")).toBeNull();
  expect(focus).toHaveBeenCalled();

  await settle(() => press(button(host, "More formatting")));
  expect(button(host, "Strikethrough").getAttribute("aria-pressed")).toBe(
    "true"
  );
});

test("Divider and Clear formatting run from the menu", async () => {
  const { editor, host, onChange } = await mountField("<p>a</p>");
  await settle(() => editor.tf.select(editor.api.end([0])));
  await settle(() => press(button(host, "More formatting")));
  await settle(() => press(button(host, "Divider")));
  expect(onChange).toHaveBeenLastCalledWith("<p>a</p><hr>");
  expect(group(host, "More formatting")).toBeNull();

  const cleared = await mountField(
    '<p><a href="https://biso.no"><strong><span data-color="red">x</span></strong></a> <em>y</em> <s>z</s></p>'
  );
  await settle(() => cleared.editor.tf.select([]));
  await settle(() => press(button(cleared.host, "More formatting")));
  await settle(() => press(button(cleared.host, "Clear formatting")));
  expect(cleared.onChange).toHaveBeenLastCalledWith(
    '<p><a href="https://biso.no">x</a> y z</p>'
  );
});

test("opening one popover closes the other", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  await settle(() => press(button(host, "More formatting")));
  expect(group(host, "Text colour")).toBeNull();
  expect(group(host, "More formatting")).not.toBeNull();
});

test("the bubble has the colour button and no ⋯", async () => {
  const { $, editable, editor } = await mountField("<p>biso</p>", "canvas");
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select([]));
  const labels = [
    ...($(".pe-rt-bubble")?.querySelectorAll("[aria-label]") ?? []),
  ].map((control) => control.getAttribute("aria-label"));
  expect(labels).toContain("Text colour");
  expect(labels).not.toContain("More formatting");
});

test("a swatch in the bubble colours the selection", async () => {
  const { $, editable, editor, host, onChange } = await mountField(
    "<p>biso</p>",
    "canvas"
  );
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  expect($(".pe-rt-bubble")?.contains(group(host, "Text colour"))).toBe(true);
  await settle(() => press(button(host, "Green")));
  expect(onChange).toHaveBeenLastCalledWith(
    '<p><span data-color="green">biso</span></p>'
  );
});

test("the panel field paints colours with the page's swatches", async () => {
  const { editable } = await mountField("<p>a</p>");
  for (const swatch of textSwatches(null)) {
    expect(editable().style.getPropertyValue(`--pe-rt-${swatch.token}`)).toBe(
      swatch.paper
    );
  }
});

test("the page theme reaches the swatches, the panel's paint and paste", async () => {
  const theme = { accent: "#fecd45", dark: "#3b1c6b" };
  const accent = textSwatches(theme).find((s) => s.token === "accent");
  expect(accent?.paper).not.toBe(
    textSwatches(null).find((s) => s.token === "accent")?.paper
  );
  const { editable, editor } = await mountField("<p>a</p>");
  await settle(() => useEditorStore.setState({ themePreview: theme }));
  expect(editable().style.getPropertyValue("--pe-rt-accent")).toBe(
    accent?.paper ?? ""
  );
  expect(editor.getOption(RichPastePlugin, "swatches")).toEqual(
    textSwatches(theme)
  );
});

test("Escape after a press closes the swatches and keeps the text focused", async () => {
  const { editable, editor, focus, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  const outer = mock(() => undefined);
  window.addEventListener("keydown", outer);
  let escapeKey: KeyboardEvent | undefined;
  try {
    await settle(() => {
      escapeKey = keydown(editable(), { key: "Escape" });
    });
  } finally {
    window.removeEventListener("keydown", outer);
  }
  expect(group(host, "Text colour")).toBeNull();
  expect(escapeKey?.defaultPrevented).toBe(true);
  expect(outer).not.toHaveBeenCalled();
  expect(focus).toHaveBeenCalled();
});

test("opened from the keyboard, Escape hands focus back to the toggle", async () => {
  const { editor, focus, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => pressByKey(button(host, "More formatting")));
  expect(document.activeElement).toBe(button(host, "Strikethrough"));

  await settle(() => {
    keydown(document.activeElement as HTMLElement, { key: "Escape" });
  });
  expect(group(host, "More formatting")).toBeNull();
  expect(document.activeElement).toBe(button(host, "More formatting"));
  expect(focus).not.toHaveBeenCalled();
});

test("Escape in the link input is the input's, not the swatches'", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => press(button(host, "Text colour")));
  await settle(() => editor.setOption(RichKeysPlugin, "linkOpen", true));
  const input = linkInput(host) as HTMLInputElement;
  expect(document.activeElement).toBe(input);

  await settle(() => {
    keydown(input, { key: "Escape" });
  });
  expect(linkInput(host)).toBeNull();
  expect(group(host, "Text colour")).not.toBeNull();
});

test("focus leaving the menu closes it; moving inside it does not", async () => {
  const { editor, host } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select([]));
  await settle(() => pressByKey(button(host, "Text colour")));
  expect(document.activeElement).toBe(button(host, "Default"));

  await settle(() => button(host, "Accent").focus());
  expect(group(host, "Text colour")).not.toBeNull();
  await settle(() => button(host, "Text colour").focus());
  expect(group(host, "Text colour")).not.toBeNull();

  await settle(() => button(host, "Bold").focus());
  expect(group(host, "Text colour")).toBeNull();
});

test("a colour chosen at a caret colours what is typed next", async () => {
  const { editor, host, onChange } = await mountField("<p>ab</p>");
  await settle(() => editor.tf.select(editor.api.end([0])));
  await settle(() => press(button(host, "Text colour")));
  await settle(() => press(button(host, "Red")));
  expect(onChange).not.toHaveBeenCalled();
  expect(
    button(host, "Text colour")
      .querySelector(".pe-rt-colour__dot")
      ?.classList.contains("pe-rt-swatch--none")
  ).toBe(false);

  await settle(() => editor.tf.insertText("c"));
  expect(onChange).toHaveBeenLastCalledWith(
    '<p>ab<span data-color="red">c</span></p>'
  );
});

/** Callbacks for a page whose department list is `departments`. */
const callbacksWith = (departments: EditorDepartment[]): EditorCallbacks => ({
  activeLocale: "no",
  campuses: [],
  departments,
  locales: [{ hasDraft: true, label: "Norwegian", locale: "no" }],
  onLocaleChange: () => undefined,
  savePage: async () => undefined,
  uploadFile: async () => ({ fileId: "", url: "" }),
});

test("the swatches follow the department's theme", async () => {
  const PURPLE = { accent: "#fecd45", dark: "#3b1c6b" };
  const GREEN = { accent: "#2bb673", dark: "#0b3d2e" };
  const accentOf = (theme: typeof PURPLE) =>
    textSwatches(theme).find((s) => s.token === "accent")?.paper;
  expect(accentOf(GREEN)).not.toBe(accentOf(PURPLE));

  const doc = useEditorStore.getState().doc;
  useEditorStore.setState({
    doc: { ...doc, meta: { ...doc.meta, department: "d1", theme: undefined } },
  });
  let theme = PURPLE;
  const department = (): EditorDepartment => ({
    campusId: null,
    id: "d1",
    name: "Department",
    theme,
  });
  try {
    const { editable, editor, rerender } = await mountField(
      "<p>a</p>",
      "panel",
      (field) =>
        createElement(
          EditorCallbacksContext.Provider,
          { value: callbacksWith([department()]) },
          field
        )
    );
    expect(editable().style.getPropertyValue("--pe-rt-accent")).toBe(
      accentOf(PURPLE) ?? ""
    );

    theme = GREEN;
    await rerender("<p>a</p>");
    expect(editable().style.getPropertyValue("--pe-rt-accent")).toBe(
      accentOf(GREEN) ?? ""
    );
    expect(editor.getOption(RichPastePlugin, "swatches")).toEqual(
      textSwatches(GREEN)
    );
  } finally {
    // In `act`: the field is still mounted, and a render React schedules on
    // its own would run after this file has taken its DOM away.
    await settle(() => useEditorStore.setState({ doc }));
  }
});

// ── Tables ──

/** The caret at the end of the text `text`, or in the empty cell at `path`. */
const caretIn = (editor: PlateEditor, at: string | Path) => {
  const path =
    typeof at === "string"
      ? [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === at)?.[1]
      : at;
  if (!path) {
    throw new Error(`no text ${String(at)}`);
  }
  return settle(() => editor.tf.select(editor.api.end(path)));
};

const HEADER_TABLE =
  "<table><thead><tr><th>h</th><th>i</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";

/** The names of the table bar's controls, in order. */
const tableBarButtons = (host: HTMLElement) => groupButtons(host, "Table");

test("the toolbar wraps only between whole groups", async () => {
  const { $ } = await mountField("<p>a</p>");
  const bar = $(".pe-rt-bar") as HTMLElement;
  const layout = [...bar.children].map((child) => {
    if (child.classList.contains("pe-rt-sep")) {
      return "|";
    }
    if (child.classList.contains("pe-rt-group")) {
      return [...child.querySelectorAll("[aria-label]")]
        .map((control) => control.getAttribute("aria-label"))
        .join(" + ");
    }
    return child.getAttribute("aria-label");
  });
  expect(layout).toEqual([
    "Text style",
    "|",
    "Bold + Italic + Underline + Text colour + Link",
    "|",
    "Bullet list + Numbered list",
    "Insert table + More formatting",
  ]);

  // A group is one flex line that never wraps or shrinks. The select is the
  // mockup's narrow drop ("Paragraph ▾"), its longer names cut short, and
  // still leaves the lists room on the first line at 308px.
  const css = readFileSync(
    join(import.meta.dir, "..", "..", "..", "theme", "editor.css"),
    "utf8"
  );
  const rule = (selector: string) =>
    new RegExp(`\\n${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`).exec(
      css
    )?.[1] ?? "";
  expect(rule(".pe-rt-group")).toContain("display: flex;");
  expect(rule(".pe-rt-group")).toContain("flex: none;");
  expect(rule(".pe-rt-group")).not.toContain("wrap");
  expect(rule(".pe-rt-select")).toContain("width: 80px;");
  expect(rule(".pe-rt-select")).toContain("text-overflow: ellipsis;");
});

test("Insert table adds a table with a header row", async () => {
  const { editor, host, onChange } = await mountField("<p>a</p>");
  await caretIn(editor, "a");
  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(button(host, "Insert table"));
  });
  expect(down?.defaultPrevented).toBe(true);
  const row = "<tr><td></td><td></td><td></td></tr>";
  expect(onChange).toHaveBeenLastCalledWith(
    `<p>a</p><table><thead><tr><th></th><th></th><th></th></tr></thead><tbody>${row}${row}</tbody></table>`
  );
  // The caret is in the first header cell.
  expect(group(host, "Table")).not.toBeNull();
  expect(button(host, "Header row").getAttribute("aria-pressed")).toBe("true");
  expect(button(host, "Insert row above").disabled).toBe(true);
});

test("the table bar shows only while the caret is in a table", async () => {
  const { $, editor, host } = await mountField(`<p>p</p>${HEADER_TABLE}`);
  await caretIn(editor, "p");
  expect(group(host, "Table")).toBeNull();

  await caretIn(editor, "a");
  const bar = group(host, "Table");
  expect(bar?.classList.contains("pe-rt-table")).toBe(true);
  expect($(".pe-rt-bar")?.contains(bar)).toBe(true);
  expect(tableBarButtons(host)).toEqual([
    "Insert row above",
    "Insert row below",
    "Delete row",
    "Insert column left",
    "Insert column right",
    "Delete column",
    "Header row",
    "Delete table",
  ]);
  for (const control of bar?.querySelectorAll("button") ?? []) {
    expect(control.getAttribute("title")).toBe(
      control.getAttribute("aria-label")
    );
  }
  // One rule, between Row and Column; the text buttons sit apart by margin.
  expect(bar?.querySelectorAll(".pe-rt-sep")).toHaveLength(1);
  expect(
    button(host, "Header row").parentElement?.classList.contains(
      "pe-rt-table__text"
    )
  ).toBe(true);
  const labels = [...(bar?.querySelectorAll(".pe-rt-table__label") ?? [])];
  expect(labels.map((label) => label.textContent)).toEqual(["Row", "Column"]);
  expect(labels.every((label) => label.getAttribute("aria-hidden"))).toBe(true);
  expect(button(host, "Insert row above").disabled).toBe(false);

  await caretIn(editor, "p");
  expect(group(host, "Table")).toBeNull();
});

test("in a cell, style, lists, table and divider are off", async () => {
  const { $, editor, host } = await mountField(`<p>p</p>${HEADER_TABLE}`);
  const select = () => $<HTMLSelectElement>('select[aria-label="Text style"]');
  const off = ["Bullet list", "Numbered list", "Insert table"];

  await caretIn(editor, "a");
  expect(select()?.disabled).toBe(true);
  for (const name of off) {
    expect(button(host, name).disabled, name).toBe(true);
  }
  expect(button(host, "Bold").disabled).toBe(false);
  await settle(() => press(button(host, "More formatting")));
  expect(button(host, "Divider").disabled).toBe(true);
  expect(button(host, "Strikethrough").disabled).toBe(false);
  await settle(() => press(button(host, "More formatting")));

  await caretIn(editor, "p");
  expect(select()?.disabled).toBe(false);
  for (const name of off) {
    expect(button(host, name).disabled, name).toBe(false);
  }
});

test("Header row reflects and toggles the first row", async () => {
  const { editor, host, onChange } = await mountField(HEADER_TABLE);
  await caretIn(editor, "h");
  const header = () => button(host, "Header row");
  expect(header().getAttribute("aria-pressed")).toBe("true");
  expect(button(host, "Insert row above").disabled).toBe(true);

  let down: MouseEvent | undefined;
  await settle(() => {
    down = press(header());
  });
  expect(down?.defaultPrevented).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><tbody><tr><td>h</td><td>i</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>"
  );
  expect(header().getAttribute("aria-pressed")).toBe("false");
  expect(button(host, "Insert row above").disabled).toBe(false);

  await settle(() => press(header()));
  expect(onChange).toHaveBeenLastCalledWith(HEADER_TABLE);
});

test("the table bar's row and column buttons edit the table", async () => {
  const { editor, host, onChange } = await mountField(
    "<table><tbody><tr><td>x</td></tr></tbody></table>"
  );
  await caretIn(editor, "x");
  await settle(() => press(button(host, "Insert row below")));
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><tbody><tr><td>x</td></tr><tr><td></td></tr></tbody></table>"
  );
  await settle(() => press(button(host, "Insert column right")));
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><tbody><tr><td>x</td><td></td></tr><tr><td></td><td></td></tr></tbody></table>"
  );
  await settle(() => press(button(host, "Delete column")));
  await settle(() => press(button(host, "Delete row")));
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><tbody><tr><td></td></tr></tbody></table>"
  );
});

test("Delete table removes it and hands the caret to the next line", async () => {
  const { editor, focus, host, onChange } = await mountField(
    `<p>a</p>${HEADER_TABLE}<p>b</p>`
  );
  await caretIn(editor, "i");
  await settle(() => press(button(host, "Delete table")));
  expect(onChange).toHaveBeenLastCalledWith("<p>a</p><p>b</p>");
  expect(editor.selection?.focus.path).toEqual([1, 0]);
  expect(group(host, "Table")).toBeNull();
  // The bar it was pressed in is gone: focus goes back to the text.
  expect(focus).toHaveBeenCalled();
});

test("Tab in a cell moves to the next cell and nests no list", async () => {
  const { editable, editor, onChange } = await mountField(HEADER_TABLE);
  await caretIn(editor, "h");
  let tab: KeyboardEvent | undefined;
  await settle(() => {
    tab = keydown(editable(), { code: "Tab", key: "Tab" });
  });
  expect(tab?.defaultPrevented).toBe(true);
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([0, 0, 1]);
  expect(onChange).not.toHaveBeenCalled();

  await settle(() => {
    keydown(editable(), { code: "Tab", key: "Tab", shiftKey: true });
  });
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([0, 0, 0]);
  expect(onChange).not.toHaveBeenCalled();
});

test("Tab in the last cell adds a row and moves into it", async () => {
  const { editable, editor, onChange } = await mountField(HEADER_TABLE);
  await caretIn(editor, "b");
  await settle(() => {
    keydown(editable(), { code: "Tab", key: "Tab" });
  });
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><thead><tr><th>h</th><th>i</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr><tr><td></td><td></td></tr></tbody></table>"
  );
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([0, 2, 0]);

  // Shift+Tab in the first cell stays put.
  await caretIn(editor, "h");
  onChange.mockClear();
  await settle(() => {
    keydown(editable(), { code: "Tab", key: "Tab", shiftKey: true });
  });
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([0, 0, 0]);
  expect(onChange).not.toHaveBeenCalled();
});

test("typing '- ' in a cell starts no list", async () => {
  const { editor, onChange } = await mountField(
    "<table><tbody><tr><td>a</td><td></td></tr></tbody></table>"
  );
  await caretIn(editor, [0, 0, 1, 0, 0]);
  await settle(() => {
    editor.tf.insertText("-");
    editor.tf.insertText(" ");
  });
  expect(onChange).toHaveBeenLastCalledWith(
    "<table><tbody><tr><td>a</td><td>- </td></tr></tbody></table>"
  );
});

test("the canvas draws the header row in a thead, as the page does", async () => {
  const { editable, editor } = await mountField(HEADER_TABLE, "canvas");
  const cells = (section: string) =>
    [
      ...(editable()
        .querySelector("table")
        ?.querySelectorAll(`:scope > ${section} > tr > *`) ?? []),
    ].map((cell) => `${cell.tagName.toLowerCase()}:${cell.textContent}`);
  expect(cells("thead")).toEqual(["th:h", "th:i"]);
  expect(cells("tbody")).toEqual(["td:a", "td:b"]);

  // The header group follows the first row as it changes.
  await settle(() => editor.tf.setNodes({ type: "td" }, { at: [0, 0, 0] }));
  expect(cells("thead")).toEqual([]);
  expect(cells("tbody")).toEqual(["td:h", "th:i", "td:a", "td:b"]);
  await settle(() => editor.tf.setNodes({ type: "th" }, { at: [0, 0, 0] }));
  expect(cells("thead")).toEqual(["th:h", "th:i"]);
  expect(cells("tbody")).toEqual(["td:a", "td:b"]);
});

test("the canvas bubble has no table controls", async () => {
  const { editable, editor, host } = await mountField(
    "<table><tbody><tr><td>cell</td></tr></tbody></table>",
    "canvas"
  );
  await moveFocus(editor, editable(), null);
  await settle(() => editor.tf.select(editor.api.range([0, 0, 0])));
  expect(host.querySelector(".pe-rt-bubble")).not.toBeNull();
  expect(button(host, "Insert table")).toBeUndefined();
  expect(group(host, "Table")).toBeNull();
  expect(editable().querySelector("thead")).toBeNull();
  expect(editable().querySelectorAll("tbody > tr > td")).toHaveLength(1);
});
