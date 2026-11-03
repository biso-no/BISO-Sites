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
  return { canvas, host, inspect, onPatch };
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

  expect(host.querySelector(".pe-insp-section__h")?.textContent).toBe("Text");
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
