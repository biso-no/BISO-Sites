import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  jest,
  mock,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { PatchFn } from "@/blocks/types";
import { doc } from "@/editor/test-fixtures";
import type { TextBlock } from "@/editor/types";
import { TextInspector } from "./inspector";
import { TextRender } from "./render";
import { RICH_CLASS } from "./render-classes";
import { RICH_ATTR } from "./test-support";

/**
 * What Slate, Plate, floating-ui and React DOM read from the global scope;
 * the viewport's size for Slate scrolling a focused selection into view.
 */
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
  // The field takes a changed prop on a timer; it never fires unless a test
  // moves the clock.
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

/** How long an unfocused field waits before it takes a changed prop. */
const TAKE_DELAY = 300;

const textBlock = (id: string, body: TextBlock["body"]): TextBlock => ({
  body,
  id,
  type: "text",
});

/**
 * `act` that lets the lazy field's chunk load and React draw it, and lets
 * Slate report a change (it does so in a microtask).
 */
const settle = (run: () => void) =>
  act(async () => {
    run();
    await import("./rich/field");
    await Promise.resolve();
  });

/** A root that draws `TextInspector`, or `TextRender` in edit mode. */
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const onPatch = mock<PatchFn>(() => undefined);
  const inspect = (block: TextBlock) =>
    settle(() =>
      root.render(createElement(TextInspector, { block, doc: doc(), onPatch }))
    );
  const canvas = (block: TextBlock) =>
    settle(() =>
      root.render(createElement(TextRender, { block, edit: true, onPatch }))
    );
  const unmount = () => act(() => root.unmount());
  return { canvas, host, inspect, onPatch, unmount };
}

/** The section's Expand button. */
const expandButton = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>(
    'button[aria-haspopup="dialog"]'
  ) as HTMLButtonElement;

/** The open wide view, anywhere in the document. */
const wideView = () => document.querySelector<HTMLElement>('[role="dialog"]');

/** The button in `scope` with this accessible name (its label, else text). */
const button = (scope: HTMLElement, name: string) =>
  [...scope.querySelectorAll("button")].find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent) === name
  ) as HTMLButtonElement;

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** The panel field is back, the wide view gone, and Expand has focus. */
function expectPanel(host: HTMLElement) {
  expect(wideView()).toBeNull();
  const editable = host.querySelector(".pe-insp-section [contenteditable]");
  expect(editable?.getAttribute("aria-label")).toBe("Text");
  expect(document.activeElement).toBe(expandButton(host));
  expect(expandButton(host).getAttribute("aria-expanded")).toBe("false");
}

test("inspector shows the newly selected block's text", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  expect(host.textContent).toContain("Alpha");

  await inspect(textBlock("b", "<p>Beta</p>"));
  expect(host.textContent).toContain("Beta");
  expect(host.textContent).not.toContain("Alpha");
});

test("inspector field has the Text label and the toolbar", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));

  const header = host.querySelector(".pe-insp-section__h");
  expect(header?.firstChild?.textContent).toBe("Text");
  expect(header?.querySelector("button")).toBe(expandButton(host));
  expect(expandButton(host).textContent).toBe("⤢ Expand");
  const editable = host.querySelector("[contenteditable]");
  expect(editable?.getAttribute("aria-label")).toBe("Text");
  expect(editable?.classList.contains("pe-rt-field")).toBe(true);
  expect(host.querySelector('select[aria-label="Text style"]')).not.toBeNull();
});

test("a legacy body opens in the inspector as one text, saving nothing", async () => {
  const { host, inspect, onPatch } = mount();
  await inspect(
    textBlock("a", [
      { text: "Title", type: "h" },
      { text: "x", type: "li" },
      { text: "y", type: "li" },
    ])
  );
  await settle(() => jest.advanceTimersByTime(TAKE_DELAY));

  expect(host.querySelector("h2")?.textContent).toBe("Title");
  expect(
    [...host.querySelectorAll("ul > li")].map((li) => li.textContent)
  ).toEqual(["x", "y"]);
  expect(onPatch).not.toHaveBeenCalled();
});

test("the canvas edits the body in the rich field", async () => {
  const { canvas, host, onPatch } = mount();
  await canvas(textBlock("a", "<h2>T</h2><p>x</p>"));
  await settle(() => jest.advanceTimersByTime(TAKE_DELAY));

  const editable = host.querySelector("[contenteditable]");
  expect(editable?.getAttribute("aria-label")).toBe("Rich text");
  expect(editable?.getAttribute("data-rich-edit")).toBe("1");
  expect(editable?.className).toContain(RICH_CLASS);
  // The canvas FormatBar keys on `data-edit`; the rich field has its bubble.
  expect(host.querySelector("[data-edit]")).toBeNull();
  expect(host.querySelector("h2")?.textContent).toBe("T");
  expect(onPatch).not.toHaveBeenCalled();
});

// The admin editor renders on the server first, and the field needs a DOM.
test("a server render shows the static fallback, never the field", async () => {
  // Load the field first: a server render that reached it would now draw it.
  const { inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));

  const block = textBlock("s", "<h2>T</h2><p>x</p>");
  const onPatch = () => undefined;
  const canvas = renderToStaticMarkup(
    createElement(TextRender, { block, edit: true, onPatch })
  );
  const inspector = renderToStaticMarkup(
    createElement(TextInspector, { block, doc: doc(), onPatch })
  );

  expect(canvas).toBe(`<div class="${RICH_ATTR}"><h2>T</h2><p>x</p></div>`);
  expect(inspector).toContain('<div class="pe-rt-field"></div>');
  expect(`${canvas}${inspector}`).not.toContain("data-slate-editor");
  expect(`${canvas}${inspector}`).not.toContain("contenteditable");
});

test("Expand opens the same text in a wide view and parks the panel field", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  expect(expandButton(host).getAttribute("aria-expanded")).toBe("false");

  await settle(() => expandButton(host).click());

  const view = wideView() as HTMLElement;
  expect(view.getAttribute("aria-label")).toBe("Text");
  expect(view.getAttribute("aria-modal")).toBe("true");
  expect(view.querySelector(".pe-rt-bar")).not.toBeNull();
  expect(view.textContent).toContain("Alpha");
  expect(expandButton(host).getAttribute("aria-expanded")).toBe("true");
  // One Plate field in the inspector: the wide view's, beside the section.
  const editables = document.querySelectorAll(".pe-rt-field[contenteditable]");
  expect(editables).toHaveLength(1);
  expect(view.contains(editables[0] as Node)).toBe(true);
  expect(document.activeElement).toBe(editables[0] as Element);
  expect(view.closest(".pe-insp-section")).toBeNull();
  expect(host.querySelector(".pe-insp-section [contenteditable]")).toBeNull();
  // The parked field keeps the panel's height.
  const parked = host.querySelector(".pe-insp-section .pe-rt-field");
  expect(parked?.getAttribute("aria-hidden")).toBe("true");
});

test("Close and Escape return to the panel, focus on Expand", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));

  await settle(() => expandButton(host).click());
  await settle(() => button(wideView() as HTMLElement, "Close").click());
  expectPanel(host);

  await settle(() => expandButton(host).click());
  const field = wideView()?.querySelector("[contenteditable]") as Element;
  let escapeKey: KeyboardEvent | undefined;
  await settle(() => {
    escapeKey = keydown(field, { key: "Escape" });
  });
  // The view took the key.
  expect(escapeKey?.defaultPrevented).toBe(true);
  expectPanel(host);
  expect(host.textContent).toContain("Alpha");
});

test("Escape in a popover keeps the wide view open", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  await settle(() => expandButton(host).click());
  const view = wideView() as HTMLElement;

  for (const name of ["Text colour", "More formatting"]) {
    // From the keyboard: the popover's first item takes focus.
    await settle(() => button(view, name).click());
    const group = () =>
      view.querySelector(`[role="group"][aria-label="${name}"]`);
    expect(group()).not.toBeNull();
    expect(group()?.contains(document.activeElement)).toBe(true);

    await settle(() => {
      keydown(document.activeElement as Element, { key: "Escape" });
    });
    expect(group()).toBeNull();
    expect(wideView()).toBe(view);
  }
});

test("Escape in the link input keeps the wide view open", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  await settle(() => expandButton(host).click());
  const view = wideView() as HTMLElement;

  await settle(() => button(view, "Link").click());
  const input = view.querySelector('input[aria-label="Link address"]');
  expect(document.activeElement).toBe(input);

  await settle(() => {
    keydown(input as Element, { key: "Escape" });
  });
  expect(view.querySelector('input[aria-label="Link address"]')).toBeNull();
  expect(wideView()).toBe(view);
});

test("an Escape something inside handled keeps the wide view open", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  await settle(() => expandButton(host).click());
  const view = wideView() as HTMLElement;
  const field = view.querySelector("[contenteditable]") as Element;
  // As the link input does: it prevents the key it took.
  const take = (event: Event) => event.preventDefault();
  field.addEventListener("keydown", take);

  await settle(() => {
    keydown(field, { key: "Escape" });
  });
  expect(wideView()).toBe(view);

  field.removeEventListener("keydown", take);
  await settle(() => {
    keydown(field, { key: "Escape" });
  });
  expect(wideView()).toBeNull();
});

test("a click on the scrim keeps the wide view open", async () => {
  const { host, inspect } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  await settle(() => expandButton(host).click());

  const scrim = wideView()?.parentElement as HTMLElement;
  expect(scrim.classList.contains("pe-rt-expand")).toBe(true);
  await settle(() => scrim.click());
  expect(wideView()).not.toBeNull();
});

// Keyed on the block, like the panel field: another block, or none, closes
// the view rather than showing it another block's text.
test("the wide view closes when its block goes", async () => {
  const { host, inspect, unmount } = mount();
  await inspect(textBlock("a", "<p>Alpha</p>"));
  await settle(() => expandButton(host).click());
  expect(wideView()?.textContent).toContain("Alpha");

  await inspect(textBlock("b", "<p>Beta</p>"));
  expect(wideView()).toBeNull();
  expect(expandButton(host).getAttribute("aria-expanded")).toBe("false");
  const panel = host.querySelector(".pe-insp-section [contenteditable]");
  expect(panel?.textContent).toBe("Beta");

  await settle(() => expandButton(host).click());
  expect(wideView()?.textContent).toContain("Beta");
  unmount();
  expect(wideView()).toBeNull();
});
