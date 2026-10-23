import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import type { EditorLocale } from "@/editor/types";
import { EditorShell } from "./index";

const previous = {
  Event: globalThis.Event,
  KeyboardEvent: globalThis.KeyboardEvent,
  MouseEvent: globalThis.MouseEvent,
  Node: globalThis.Node,
  HTMLElement: globalThis.HTMLElement,
  HTMLInputElement: globalThis.HTMLInputElement,
  HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
  document: globalThis.document,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };

beforeAll(() => {
  const win = new Window();
  Object.assign(globalThis, {
    Event: win.Event,
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
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

const BAD = { dark: "#9b5de5", accent: "#fecd45" };
const GOOD = { dark: "#2a0a4a", accent: "#fecd45" };
const SAVE_WAIT_MS = 1100;

let mounted: { host: HTMLElement; root: Root } | null = null;
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount());
    mounted.host.remove();
    mounted = null;
  }
});

function mount(saves: unknown[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  const initial = doc(section("s-1", "1", [["b-1"]]));
  act(() => {
    root.render(
      createElement(EditorShell, {
        activeLocale: "no" as EditorLocale,
        departments: [],
        initial,
        locales: [
          { hasDraft: true, label: "Norwegian", locale: "no" },
          { hasDraft: true, label: "English", locale: "en" },
        ],
        onLocaleChange: () => undefined,
        savePage: (d) => {
          saves.push(d);
          return Promise.resolve(undefined);
        },
        uploadFile: () => Promise.resolve({ fileId: "", url: "" }),
      })
    );
  });
  return host;
}

const localeButtons = (host: Element) => [
  ...host.querySelectorAll(".pe-locale-seg button"),
];
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

test("a failing theme shows Not saved, holds the locale switch, and saves once fixed", async () => {
  const saves: unknown[] = [];
  const host = mount(saves);
  expect(localeButtons(host).every((b) => !b.hasAttribute("disabled"))).toBe(
    true
  );

  act(() => useEditorStore.getState().setTheme(BAD));
  await wait(SAVE_WAIT_MS);
  expect(useEditorStore.getState().saving).toBe("blocked");
  expect(host.querySelector(".pe-save")?.textContent).toContain(
    "Not saved: theme colours fail the contrast check"
  );
  expect(saves.length).toBe(0);
  const buttons = localeButtons(host);
  expect(buttons.every((b) => b.hasAttribute("disabled"))).toBe(true);
  expect(buttons[0]?.getAttribute("title")).toBe(
    "Fix the theme colours before switching language"
  );

  act(() => useEditorStore.getState().setTheme(GOOD));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  expect(useEditorStore.getState().saving).not.toBe("blocked");
  expect(localeButtons(host).every((b) => !b.hasAttribute("disabled"))).toBe(
    true
  );
});
