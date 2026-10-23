import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { TabsBlock } from "@/editor/types";
import { TabsRender } from "./render";

const previous = {
  Event: globalThis.Event,
  KeyboardEvent: globalThis.KeyboardEvent,
  MouseEvent: globalThis.MouseEvent,
  Node: globalThis.Node,
  document: globalThis.document,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };

beforeAll(() => {
  const win = new Window();
  Object.assign(globalThis, {
    Event: win.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
    KeyboardEvent: win.KeyboardEvent,
    MouseEvent: win.MouseEvent,
    Node: win.Node,
    document: win.document,
    window: win,
  });
});

afterAll(() => {
  Object.assign(globalThis, previous);
  flags.IS_REACT_ACT_ENVIRONMENT = undefined;
});

const block: TabsBlock = {
  id: "t1",
  tabs: [
    { body: "Om oss.", label: "Om" },
    { body: "Slik melder du deg på.", label: "Påmelding" },
    { body: "Ta kontakt.", label: "Kontakt" },
  ],
  type: "tabs",
};

const mounted: { host: HTMLElement; root: Root }[] = [];

afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function mount(edit = false) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => {
    root.render(
      createElement(TabsRender, { block, edit, onPatch: () => undefined })
    );
  });
  return host;
}

const tabs = (host: Element) => [...host.querySelectorAll('[role="tab"]')];
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k })
    );
  });
const selected = (host: Element) =>
  tabs(host).map((t) => t.getAttribute("aria-selected"));

describe("tabs semantics", () => {
  test("tablist, labelled panels and ids derived from the block id", () => {
    const host = mount();
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    const all = tabs(host);
    const panels = [...host.querySelectorAll('[role="tabpanel"]')];
    expect(all).toHaveLength(3);
    expect(panels).toHaveLength(3);
    all.forEach((tab, i) => {
      expect(tab.id).toBe(["t1", "tab", i].join("-"));
      expect(tab.getAttribute("aria-controls")).toBe(
        ["t1", "panel", i].join("-")
      );
      expect(panels[i].id).toBe(["t1", "panel", i].join("-"));
      expect(panels[i].getAttribute("aria-labelledby")).toBe(tab.id);
    });
    expect(selected(host)).toEqual(["true", "false", "false"]);
    expect(all.map((t) => t.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);
    expect(panels.map((p) => p.hasAttribute("hidden"))).toEqual([
      false,
      true,
      true,
    ]);
  });

  test("server markup is identical to the first client render", () => {
    const html = renderToStaticMarkup(
      createElement(TabsRender, {
        block,
        edit: false,
        onPatch: () => undefined,
      })
    );
    expect(html).toContain('id="t1-tab-0"');
    expect(html).toContain('aria-controls="t1-panel-0"');
  });

  test("ArrowRight and ArrowLeft move selection and focus, wrapping", () => {
    const host = mount();
    key(tabs(host)[0], "ArrowRight");
    expect(selected(host)).toEqual(["false", "true", "false"]);
    expect(document.activeElement).toBe(tabs(host)[1]);
    key(tabs(host)[1], "ArrowLeft");
    key(tabs(host)[0], "ArrowLeft");
    expect(selected(host)).toEqual(["false", "false", "true"]);
    key(tabs(host)[2], "ArrowRight");
    expect(selected(host)).toEqual(["true", "false", "false"]);
  });

  test("Home and End jump to the first and last tab", () => {
    const host = mount();
    key(tabs(host)[0], "End");
    expect(selected(host)).toEqual(["false", "false", "true"]);
    key(tabs(host)[2], "Home");
    expect(selected(host)).toEqual(["true", "false", "false"]);
  });

  test("clicking a tab selects it and shows its panel", () => {
    const host = mount();
    act(() => {
      tabs(host)[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(selected(host)).toEqual(["false", "true", "false"]);
    const panel = host.querySelector("#t1-panel-1") as Element;
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(panel.textContent).toBe("Slik melder du deg på.");
  });

  test("the selected tab has the action underline", () => {
    const host = mount();
    const [first, second] = tabs(host);
    expect(first.classList.contains("border-b-2")).toBe(true);
    expect(first.classList.contains("border-action")).toBe(true);
    expect(second.classList.contains("border-action")).toBe(false);
  });
});
