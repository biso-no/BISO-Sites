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

function mount(
  saves: unknown[],
  save: () => Promise<undefined> = () => Promise.resolve(undefined)
) {
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
          return save();
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

const SAVED_TIMER_WAIT_MS = 2200;
const blockedHeld = (host: Element) => {
  expect(useEditorStore.getState().saving).toBe("blocked");
  expect(localeButtons(host).every((b) => b.hasAttribute("disabled"))).toBe(
    true
  );
};

test("the saved/idle timer does not clear a block that arrived after a save", async () => {
  const saves: unknown[] = [];
  const host = mount(saves);
  act(() => useEditorStore.getState().setTheme(GOOD));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  expect(useEditorStore.getState().saving).toBe("saved");

  act(() => useEditorStore.getState().setTheme(BAD));
  await wait(SAVED_TIMER_WAIT_MS);
  blockedHeld(host);
});

test("a save that resolves after the block leaves it blocked", async () => {
  const saves: unknown[] = [];
  let resolveSave: () => void = () => undefined;
  const host = mount(
    saves,
    () =>
      new Promise<undefined>((resolve) => {
        resolveSave = () => resolve(undefined);
      })
  );
  act(() => useEditorStore.getState().setTheme(GOOD));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);

  act(() => useEditorStore.getState().setTheme(BAD));
  expect(useEditorStore.getState().saving).toBe("blocked");
  await act(async () => {
    resolveSave();
    await Promise.resolve();
  });
  await wait(SAVED_TIMER_WAIT_MS);
  blockedHeld(host);
});

/** Dispatch a cancelable `beforeunload` and report whether a prompt was asked for. */
const unloadPrompted = () => {
  const event = new window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

test("closing the tab while blocked prompts; once the colours pass it does not", async () => {
  const saves: unknown[] = [];
  mount(saves);
  expect(unloadPrompted()).toBe(false);

  act(() => useEditorStore.getState().setTheme(BAD));
  await wait(SAVE_WAIT_MS);
  expect(useEditorStore.getState().saving).toBe("blocked");
  expect(unloadPrompted()).toBe(true);

  act(() => useEditorStore.getState().setTheme(GOOD));
  await wait(SAVE_WAIT_MS);
  expect(useEditorStore.getState().saving).not.toBe("blocked");
  expect(unloadPrompted()).toBe(false);
});

test("unmounting while blocked removes the prompt", async () => {
  mount([]);
  act(() => useEditorStore.getState().setTheme(BAD));
  await wait(SAVE_WAIT_MS);
  expect(unloadPrompted()).toBe(true);
  act(() => mounted?.root.unmount());
  mounted?.host.remove();
  mounted = null;
  expect(unloadPrompted()).toBe(false);
});

function mountHost({
  onPublish,
  savePage,
}: {
  onPublish?: () => Promise<{ themeCopied?: boolean } | undefined>;
  savePage: (d: unknown) => Promise<{ department?: string; slug?: string }>;
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  act(() => {
    root.render(
      createElement(EditorShell, {
        activeLocale: "no" as EditorLocale,
        departments: [
          { campusId: "c-1", id: "dept-1", name: "Fadderullan", theme: GOOD },
        ],
        initial: doc(section("s-1", "1", [["b-1"]])),
        locales: [{ hasDraft: true, label: "Norwegian", locale: "no" }],
        onLocaleChange: () => undefined,
        onPublish,
        savePage,
        uploadFile: () => Promise.resolve({ fileId: "", url: "" }),
      })
    );
  });
  return host;
}

test("a save that bound the page to a department takes it in, with no extra save or undo step", async () => {
  const saves: unknown[] = [];
  mountHost({
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve({ department: "dept-1" });
    },
  });
  act(() => useEditorStore.getState().setMeta("title", "Ny side"));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  expect(useEditorStore.getState().doc.meta.department).toBe("dept-1");
  expect(useEditorStore.getState().past.length).toBe(1);
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
});

test("a publish that copied the theme to the department drops it, with no save or undo step", async () => {
  const saves: unknown[] = [];
  const host = mountHost({
    onPublish: () => Promise.resolve({ themeCopied: true }),
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve({});
    },
  });
  act(() => useEditorStore.getState().setTheme({ ...GOOD, accent: "#ffffff" }));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  const steps = useEditorStore.getState().past.length;

  const publish = host.querySelector(".pe-publish") as HTMLButtonElement;
  expect(publish.disabled).toBe(false);
  await act(async () => {
    publish.click();
    await new Promise((r) => setTimeout(r, 20));
  });

  const state = useEditorStore.getState();
  expect(state.doc.meta.status).toBe("published");
  expect(state.doc.meta.theme).toBeUndefined();
  expect(state.past.length).toBe(steps);
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
});
