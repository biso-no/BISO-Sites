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
import type { FaqBlock } from "@/editor/types";
import { FaqRender } from "./render";

const previous = {
  Event: globalThis.Event,
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

const block: FaqBlock = {
  heading: "Spørsmål",
  id: "f1",
  items: [{ a: "Ja.", q: "Er det gratis?" }],
  type: "faq",
};

const mounted: { host: HTMLElement; root: Root }[] = [];

afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function mount(edit: boolean) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => {
    root.render(
      createElement(FaqRender, { block, edit, onPatch: () => undefined })
    );
  });
  return host;
}

const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });

describe("faq disclosure", () => {
  test("clicking a summary opens and closes its details", () => {
    const host = mount(false);
    const details = host.querySelector("details") as HTMLDetailsElement;
    const summary = host.querySelector("summary") as Element;
    expect(details.open).toBe(false);
    click(summary);
    expect(details.open).toBe(true);
    click(summary);
    expect(details.open).toBe(false);
  });

  test("in the editor a click on the summary does not close it", () => {
    const host = mount(true);
    const details = host.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    click(host.querySelector("summary") as Element);
    expect(details.open).toBe(true);
  });
});
