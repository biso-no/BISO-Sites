import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@/blocks/index";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import { CanvasPane } from "./index";

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

let mounted: { host: HTMLElement; root: Root } | null = null;
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount());
    mounted.host.remove();
    mounted = null;
  }
});

test("a store theme update repaints the mounted frame", () => {
  useEditorStore.getState().setDoc(doc(section("s-1", "1", [["b-1"]])));
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  act(() => {
    root.render(
      createElement(DndContext, null, createElement(CanvasPane, { drag: null }))
    );
  });
  const frame = () => host.querySelector(".pe-frame") as HTMLElement;
  expect(frame().getAttribute("style") ?? "").not.toContain("--biso-deep");

  act(() =>
    useEditorStore.getState().setTheme({ dark: "#2a0a4a", accent: "#fecd45" })
  );
  expect(frame().getAttribute("style")).toContain("--biso-deep: #2a0a4a");

  act(() =>
    useEditorStore.getState().setTheme({ dark: "#0a3a1a", accent: "#7be495" })
  );
  expect(frame().getAttribute("style")).toContain("--biso-deep: #0a3a1a");

  act(() => useEditorStore.getState().setTheme(null));
  expect(frame().getAttribute("style") ?? "").not.toContain("--biso-deep");
});
