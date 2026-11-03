import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { EventEditorStore, type PlateEditor } from "platejs/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import RichTextField, { type RichTextFieldProps } from "./field";
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
});

/** `act` that also lets Slate report the change (it does so in a microtask). */
const settle = (run: () => void) =>
  act(async () => {
    run();
    await Promise.resolve();
  });

type Emit = (html: string) => void;

/**
 * One field on `html`. `editor.tf.focus` is stubbed: a focused Slate editor
 * syncs the DOM selection through slate-dom, which read `globalThis.Node`
 * before any test file here installed a DOM (one module cache per run).
 */
async function mountField(
  html: string,
  variant: RichTextFieldProps["variant"] = "panel"
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
        createElement(RichTextField, {
          editorRef,
          html: next,
          label: "Text",
          onChange,
          variant,
        })
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

/** A press as the browser sends it: mousedown, then click. */
function press(target: HTMLElement): MouseEvent {
  const down = new window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(down);
  target.click();
  return down as unknown as MouseEvent;
}

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
    "Link",
    "Bullet list",
    "Numbered list",
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
  expect(event?.defaultPrevented).toBe(false);

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
