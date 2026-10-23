import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import type {
  EditorLocale,
  PageDoc,
  PublishOutcome,
  StoredMeta,
} from "@/editor/types";
import { EditorShell, type EditorShellHandle } from "./index";

// Saves and Publish never drop work (stage 5, review focus 3): an edit made
// within the 800 ms autosave debounce is saved before Publish, on unmount and
// when the page is hidden.

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
const SAVE_WAIT_MS = 1100;

let mounted: { host: HTMLElement; root: Root } | null = null;
beforeEach(() => {
  useEditorStore.setState({ saving: "idle" });
});
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount());
    mounted.host.remove();
    mounted = null;
  }
});

type Save = (
  doc: PageDoc,
  locale: EditorLocale
) => Promise<StoredMeta | undefined>;

function mount({
  onFlush,
  onPublish,
  savePage,
}: {
  onFlush?: Save;
  onPublish?: (locale: EditorLocale) => Promise<PublishOutcome | undefined>;
  savePage: Save;
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  const ref = createRef<EditorShellHandle>();
  act(() => {
    root.render(
      createElement(EditorShell, {
        activeLocale: "no" as EditorLocale,
        departments: [],
        initial: doc(section("s-1", "1", [["b-1"]])),
        locales: [{ hasDraft: true, label: "Norwegian", locale: "no" }],
        onFlush,
        onLocaleChange: () => undefined,
        onPublish,
        ref,
        savePage,
        uploadFile: () => Promise.resolve({ fileId: "", url: "" }),
      })
    );
  });
  return { host, ref };
}

const unmount = () => {
  act(() => mounted?.root.unmount());
  mounted?.host.remove();
  mounted = null;
};

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

const edit = (title: string) =>
  act(() => useEditorStore.getState().setMeta("title", title));

/** A save the test resolves (or rejects) itself. */
function deferredSaves() {
  const calls: { doc: PageDoc; resolve: () => void; reject: () => void }[] = [];
  const save: Save = (d) =>
    new Promise((resolve, reject) => {
      calls.push({
        doc: d,
        reject: () => reject(new Error("network blip")),
        resolve: () => resolve(undefined),
      });
    });
  return { calls, save };
}

const publishButton = (host: Element) =>
  host.querySelector(".pe-publish") as HTMLButtonElement;

/** Dispatch a cancelable `beforeunload` and report whether a prompt was asked for. */
const unloadPrompted = () => {
  const event = new window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

test("an edit, then Publish within the debounce: the save is stored first and the publish carries the edit", async () => {
  const events: string[] = [];
  let stored: PageDoc | null = null;
  const { host } = mount({
    onPublish: () => {
      events.push(`publish:${stored?.meta.title}`);
      return Promise.resolve(undefined);
    },
    savePage: async (d) => {
      events.push("save");
      await new Promise((r) => setTimeout(r, 20));
      stored = d;
      return undefined;
    },
  });

  edit("Ny tittel");
  await act(async () => {
    publishButton(host).click();
    await new Promise((r) => setTimeout(r, 80));
  });

  expect(events).toEqual(["save", "publish:Ny tittel"]);
  expect(useEditorStore.getState().doc.meta.status).toBe("published");
  // The debounce that was pending does not save the same edit again.
  await wait(SAVE_WAIT_MS);
  expect(events).toEqual(["save", "publish:Ny tittel"]);
});

test("flushPendingSave runs the pending save now and resolves once it is stored", async () => {
  const saves = deferredSaves();
  const { ref } = mount({ savePage: saves.save });
  edit("Ny tittel");

  let flushed = false;
  let flush: Promise<void> = Promise.resolve();
  await act(async () => {
    flush = (ref.current as EditorShellHandle).flushPendingSave().then(() => {
      flushed = true;
    });
    await Promise.resolve();
  });
  expect(saves.calls.length).toBe(1);
  expect(saves.calls[0]?.doc.meta.title).toBe("Ny tittel");
  expect(flushed).toBe(false);

  await act(async () => {
    saves.calls[0]?.resolve();
    await flush;
  });
  expect(flushed).toBe(true);
  await wait(SAVE_WAIT_MS);
  expect(saves.calls.length).toBe(1);
});

test("flushPendingSave resolves at once with nothing pending, and waits for a save in flight", async () => {
  const saves = deferredSaves();
  const { ref } = mount({ savePage: saves.save });
  await act(async () => {
    await (ref.current as EditorShellHandle).flushPendingSave();
  });
  expect(saves.calls.length).toBe(0);

  edit("Ny tittel");
  await wait(SAVE_WAIT_MS);
  expect(saves.calls.length).toBe(1);

  let flushed = false;
  let flush: Promise<void> = Promise.resolve();
  await act(async () => {
    flush = (ref.current as EditorShellHandle).flushPendingSave().then(() => {
      flushed = true;
    });
    await Promise.resolve();
  });
  expect(flushed).toBe(false);
  expect(saves.calls.length).toBe(1);
  await act(async () => {
    saves.calls[0]?.resolve();
    await flush;
  });
  expect(flushed).toBe(true);
});

test("while the theme blocks saving, a flush saves nothing and resolves", async () => {
  const saves = deferredSaves();
  const { ref } = mount({ savePage: saves.save });
  act(() => useEditorStore.getState().setTheme(BAD));
  await wait(SAVE_WAIT_MS);
  expect(useEditorStore.getState().saving).toBe("blocked");

  await act(async () => {
    await (ref.current as EditorShellHandle).flushPendingSave();
  });
  expect(saves.calls.length).toBe(0);
  unmount();
  expect(saves.calls.length).toBe(0);
});

test("unmounting within the debounce saves the edit", () => {
  const saves: PageDoc[] = [];
  mount({
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve(undefined);
    },
  });
  edit("Ny tittel");
  unmount();
  expect(saves.map((d) => d.meta.title)).toEqual(["Ny tittel"]);
});

test("hiding the page within the debounce saves the edit once", async () => {
  const saves: PageDoc[] = [];
  mount({
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve(undefined);
    },
  });
  edit("Ny tittel");
  act(() => {
    window.dispatchEvent(new window.Event("pagehide"));
  });
  expect(saves.map((d) => d.meta.title)).toEqual(["Ny tittel"]);
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
});

test("the host's onFlush takes the unmount and page-hide saves instead of savePage", () => {
  const saves: string[] = [];
  const flushes: string[] = [];
  mount({
    onFlush: (d) => {
      flushes.push(d.meta.title);
      return Promise.resolve(undefined);
    },
    savePage: (d) => {
      saves.push(d.meta.title);
      return Promise.resolve(undefined);
    },
  });
  edit("Første");
  act(() => {
    window.dispatchEvent(new window.Event("pagehide"));
  });
  edit("Andre");
  unmount();
  expect(flushes).toEqual(["Første", "Andre"]);
  expect(saves).toEqual([]);
});

test("closing the tab while a save is pending or in flight prompts; once it is stored it does not", async () => {
  const saves = deferredSaves();
  mount({ savePage: saves.save });
  expect(unloadPrompted()).toBe(false);

  edit("Ny tittel");
  expect(unloadPrompted()).toBe(true);
  await wait(SAVE_WAIT_MS);
  expect(saves.calls.length).toBe(1);
  // In flight: the edit is not stored yet.
  expect(unloadPrompted()).toBe(true);

  await act(async () => {
    saves.calls[0]?.resolve();
    await Promise.resolve();
  });
  expect(unloadPrompted()).toBe(false);
});

test("a save that failed is retried by Publish, and nothing is published while it fails", async () => {
  let failing = true;
  const saves: PageDoc[] = [];
  const published: string[] = [];
  const { host } = mount({
    onPublish: () => {
      published.push(saves.at(-1)?.meta.title ?? "");
      return Promise.resolve(undefined);
    },
    savePage: (d) => {
      saves.push(d);
      return failing
        ? Promise.reject(new Error("network blip"))
        : Promise.resolve(undefined);
    },
  });
  const quiet = console.error;
  console.error = () => undefined;
  try {
    edit("Ny tittel");
    await wait(SAVE_WAIT_MS);
    expect(saves.length).toBe(1);
    expect(useEditorStore.getState().saving).toBe("error");
    // The edit exists only in memory.
    expect(unloadPrompted()).toBe(true);

    await act(async () => {
      publishButton(host).click();
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(saves.length).toBe(2);
    expect(published).toEqual([]);

    failing = false;
    await act(async () => {
      publishButton(host).click();
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(saves.length).toBe(3);
    expect(published).toEqual(["Ny tittel"]);
    expect(unloadPrompted()).toBe(false);
  } finally {
    console.error = quiet;
  }
});

test("an edit made while a publish is on its way saves the published status, not the old one", async () => {
  const saves: PageDoc[] = [];
  let finishPublish: () => void = () => undefined;
  const { host } = mount({
    onPublish: () =>
      new Promise((resolve) => {
        finishPublish = () => resolve(undefined);
      }),
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve(undefined);
    },
  });
  await act(async () => {
    publishButton(host).click();
    await Promise.resolve();
  });
  edit("Skrevet under publisering");
  await act(async () => {
    finishPublish();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(useEditorStore.getState().doc.meta.status).toBe("published");

  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  expect(saves[0]?.meta.title).toBe("Skrevet under publisering");
  expect(saves[0]?.meta.status).toBe("published");
});
