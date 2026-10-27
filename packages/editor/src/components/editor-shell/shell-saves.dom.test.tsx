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

const GOOD = { dark: "#2a0a4a", accent: "#fecd45" };
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
  onPublishSaveFailed,
  savePage,
}: {
  onFlush?: Save;
  onPublishSaveFailed?: () => void;
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
        onPublishSaveFailed,
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

test("a failed save before Publish tells the host, which publishes nothing", async () => {
  let failed = 0;
  let published = 0;
  const { host } = mount({
    onPublish: () => {
      published += 1;
      return Promise.resolve(undefined);
    },
    onPublishSaveFailed: () => {
      failed += 1;
    },
    savePage: () => Promise.reject(new Error("network blip")),
  });
  const quiet = console.error;
  console.error = () => undefined;
  try {
    edit("Ny tittel");
    await act(async () => {
      publishButton(host).click();
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(failed).toBe(1);
    expect(published).toBe(0);
  } finally {
    console.error = quiet;
  }
});

test("a publish that itself fails is not reported as a failed save", async () => {
  let failed = 0;
  const { host } = mount({
    onPublish: () => Promise.reject(new Error("publish refused")),
    onPublishSaveFailed: () => {
      failed += 1;
    },
    savePage: () => Promise.resolve(undefined),
  });
  edit("Ny tittel");
  await act(async () => {
    publishButton(host).click();
    await new Promise((r) => setTimeout(r, 40));
  });
  expect(failed).toBe(0);
});

test("a save the server dropped the theme from clears it here, with no undo step", async () => {
  const saves: PageDoc[] = [];
  mount({
    savePage: (d) => {
      saves.push(d);
      return Promise.resolve({ themeDropped: true });
    },
  });
  act(() => useEditorStore.getState().setTheme(GOOD));
  expect(useEditorStore.getState().doc.meta.theme).toEqual(GOOD);
  const undoSteps = useEditorStore.getState().past.length;

  await wait(SAVE_WAIT_MS);

  expect(saves.length).toBe(1);
  expect(useEditorStore.getState().doc.meta.theme).toBeUndefined();
  expect("theme" in useEditorStore.getState().doc.meta).toBe(false);
  expect(useEditorStore.getState().past.length).toBe(undoSteps);
  // The correction is not an edit: it saves nothing more.
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
});

const U = { dark: "#0b3d2e", accent: "#fecd45" };

test("a themeDropped answer about an older save leaves a theme picked since", async () => {
  // T (the department's) went out with save 1; U was picked before the
  // answer came back. The answer is about T: U must stay and be saved.
  const answers: ((meta: StoredMeta) => void)[] = [];
  const saves: PageDoc[] = [];
  mount({
    savePage: (d) =>
      new Promise((resolve) => {
        saves.push(d);
        answers.push(resolve);
      }),
  });
  act(() => useEditorStore.getState().setTheme(GOOD));
  await wait(SAVE_WAIT_MS);
  expect(saves.length).toBe(1);
  act(() => useEditorStore.getState().setTheme(U));

  await act(async () => {
    answers[0]?.({ themeDropped: true });
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(useEditorStore.getState().doc.meta.theme).toEqual(U);

  await wait(SAVE_WAIT_MS);
  expect(saves.map((d) => d.meta.theme)).toEqual([GOOD, U]);
});

test("a save that finishes while a newer one waits keeps Saving… and the prompt", async () => {
  const saves = deferredSaves();
  mount({ savePage: saves.save });
  edit("Første");
  await wait(SAVE_WAIT_MS);
  expect(saves.calls.length).toBe(1);
  edit("Andre");

  await act(async () => {
    saves.calls[0]?.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(useEditorStore.getState().saving).toBe("pending");
  expect(unloadPrompted()).toBe(true);

  await wait(SAVE_WAIT_MS);
  await act(async () => {
    saves.calls[1]?.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(useEditorStore.getState().saving).toBe("saved");
  expect(unloadPrompted()).toBe(false);
});

test("a failed save in one language is kept, and retried, when the other language saves", async () => {
  const calls: {
    locale: EditorLocale;
    settle: (ok: boolean) => void;
    title: string;
  }[] = [];
  const savePage: Save = (d, locale) =>
    new Promise((resolve, reject) => {
      calls.push({
        locale,
        settle: (ok) => (ok ? resolve(undefined) : reject(new Error("blip"))),
        title: d.meta.title,
      });
    });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  const ref = createRef<EditorShellHandle>();
  const render = (locale: EditorLocale, initial: PageDoc) =>
    act(() =>
      root.render(
        createElement(EditorShell, {
          activeLocale: locale,
          departments: [],
          initial,
          locales: [
            { hasDraft: true, label: "Norwegian", locale: "no" },
            { hasDraft: true, label: "English", locale: "en" },
          ],
          onLocaleChange: () => undefined,
          ref,
          savePage,
          uploadFile: () => Promise.resolve({ fileId: "", url: "" }),
        })
      )
    );
  const norwegian = doc(section("s-1", "1", [["b-1"]]));
  render("no", norwegian);
  edit("NO edit");
  await wait(SAVE_WAIT_MS);
  expect(calls.map((c) => c.locale)).toEqual(["no"]);
  render("en", { ...norwegian, meta: { ...norwegian.meta, title: "EN" } });
  edit("EN edit");

  const quiet = console.error;
  console.error = () => undefined;
  try {
    await act(async () => {
      calls[0]?.settle(false);
      await new Promise((r) => setTimeout(r, 10));
    });
    await wait(SAVE_WAIT_MS);
    expect(calls.map((c) => c.locale)).toEqual(["no", "en"]);
    await act(async () => {
      calls[1]?.settle(true);
      await new Promise((r) => setTimeout(r, 10));
    });
    // English is stored; the Norwegian edit is not.
    expect(useEditorStore.getState().saving).toBe("error");
    expect(unloadPrompted()).toBe(true);

    // Set in callbacks, which flow analysis does not follow.
    let flushed = null as boolean | null;
    let flush: Promise<void> = Promise.resolve();
    await act(async () => {
      flush = (ref.current as EditorShellHandle).flushPendingSave().then(
        () => {
          flushed = true;
        },
        () => {
          flushed = false;
        }
      );
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(calls.map((c) => `${c.locale}:${c.title}`)).toEqual([
      "no:NO edit",
      "en:EN edit",
      "no:NO edit",
    ]);
    expect(flushed).toBe(null);
    await act(async () => {
      calls[2]?.settle(false);
      await flush;
    });
    expect(flushed).toBe(false);
    expect(unloadPrompted()).toBe(true);

    await act(async () => {
      flush = (ref.current as EditorShellHandle).flushPendingSave().then(
        () => {
          flushed = true;
        },
        () => {
          flushed = false;
        }
      );
      await new Promise((r) => setTimeout(r, 10));
      calls[3]?.settle(true);
      await flush;
    });
    expect(calls.length).toBe(4);
    expect(flushed).toBe(true);
    expect(unloadPrompted()).toBe(false);
  } finally {
    console.error = quiet;
  }
});

test("a save that finishes after the editor closed leaves the shared store alone", async () => {
  let answer: (meta: StoredMeta) => void = () => undefined;
  mount({
    savePage: () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  });
  act(() => useEditorStore.getState().setTheme(GOOD));
  unmount();
  // The next editor (another page) has the store now.
  const next = doc(section("s-9", "1", [["b-9"]]));
  act(() => {
    useEditorStore.getState().setDoc({
      ...next,
      meta: { ...next.meta, slug: "test", theme: GOOD },
    });
    useEditorStore.getState().setSaving("idle");
  });

  await act(async () => {
    answer({ slug: "test-2", themeDropped: true });
    await new Promise((r) => setTimeout(r, 10));
  });
  const state = useEditorStore.getState();
  expect(state.saving).toBe("idle");
  expect(state.doc.meta.slug).toBe("test");
  expect(state.doc.meta.theme).toEqual(GOOD);
});
