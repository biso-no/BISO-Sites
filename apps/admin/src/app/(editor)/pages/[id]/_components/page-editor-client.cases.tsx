import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  mock,
  test,
} from "bun:test";
import type { PageEditorLoadResult } from "@repo/api/page-builder";
import type { EditorShell, PageDoc } from "@repo/editor";
import { Window } from "happy-dom";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";

// The page editor host's saves and publish (stage 5, Task 5): saves run one
// at a time so a page is created once, and Publish on a language with no
// stored draft saves it first. Run by page-editor-client-cases.test.ts in its
// own process, because mock.module is process-global.

type ShellProps = ComponentProps<typeof EditorShell>;
type SaveResult =
  | { department: string; pageId: string; slug: string }
  | { error: string };
interface SaveArgs {
  doc: PageDoc;
  id: string | null;
  locale?: "en" | "no";
}

let shell: ShellProps | null = null;
const savePageEditorDoc = mock(
  (_args: SaveArgs): Promise<SaveResult> =>
    Promise.resolve({ department: "", pageId: "page-1", slug: "side" })
);
const PUBLISHED = {
  departmentTheme: null,
  themeCopied: false,
  themeCopyFailed: false,
  translationQueued: false,
};
const publishPageAction = mock(
  (_id: string, _locale: string, _options?: unknown): Promise<unknown> =>
    Promise.resolve(PUBLISHED)
);
const toast = {
  error: mock((_message: string, _options?: unknown) => undefined),
  success: mock((_message: string) => undefined),
  warning: mock((_message: string) => undefined),
};

mock.module("@/app/(portal)/_actions/pages", () => ({
  publishPageAction,
  savePageEditorDoc,
  unpublishPageAction: mock(() => Promise.resolve(undefined)),
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));
mock.module("sonner", () => ({ toast }));
mock.module("@/app/_components/content-translation-controls", () => ({
  AutoTranslateControl: () => null,
}));
mock.module("@/lib/upload-client", () => ({
  uploadMediaFile: mock(() => Promise.resolve({ fileId: "f", url: "u" })),
}));
mock.module("@repo/editor/theme/styles.css", () => ({}));
mock.module("@repo/editor", () => ({
  EditorShell: (props: ShellProps) => {
    shell = props;
    return null;
  },
}));

const { PageEditorClient } = await import("./page-editor-client");

const previous = {
  document: globalThis.document,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let win: Window;
beforeAll(() => {
  win = new Window({ url: "http://localhost:3001/pages/new" });
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: win.document,
    window: win,
  });
});
afterAll(() => {
  Object.assign(globalThis, previous);
  flags.IS_REACT_ACT_ENVIRONMENT = undefined;
});

let mounted: { host: HTMLElement; root: Root } | null = null;
beforeEach(() => {
  shell = null;
  savePageEditorDoc.mockReset();
  savePageEditorDoc.mockImplementation(({ id }) =>
    Promise.resolve({ department: "", pageId: id ?? "page-1", slug: "side" })
  );
  publishPageAction.mockReset();
  publishPageAction.mockImplementation(() => Promise.resolve(PUBLISHED));
  toast.error.mockClear();
  toast.success.mockClear();
  win.history.replaceState(null, "", "/pages/new");
});
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount());
    mounted.host.remove();
    mounted = null;
  }
});

const DOC_NO: PageDoc = {
  meta: {
    campus: "campus-oslo",
    department: "",
    description: "",
    slug: "side",
    status: "draft",
    title: "Side",
  },
  sections: [],
  version: 2,
};

/** An existing page with only a Norwegian translation row. */
const NORWEGIAN_ONLY = {
  availableLocales: ["no", "en"],
  page: {
    campusId: "campus-oslo",
    departmentId: "",
    id: "page-1",
    slug: "side",
    status: "draft",
    visibility: "public",
  },
  translations: {
    no: {
      draftDocument: DOC_NO,
      isPublished: false,
      locale: "no",
      publishedAt: null,
      publishedDocument: null,
      title: "Side",
    },
  },
} as unknown as PageEditorLoadResult;

function mount(page: PageEditorLoadResult | null) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { host, root };
  act(() => {
    root.render(
      <PageEditorClient
        availableLocales={["no", "en"]}
        campuses={[]}
        defaultCampusId="campus-oslo"
        departments={[]}
        initialLocale="no"
        initialPage={page}
        pageId={page ? page.page.id : null}
      />
    );
  });
}

const props = (): ShellProps => {
  if (!shell) {
    throw new Error("EditorShell was not rendered");
  }
  return shell;
};

const titled = (title: string): PageDoc => ({
  ...DOC_NO,
  meta: { ...DOC_NO.meta, title },
});

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

test("two rapid saves on /pages/new create the page once; the second updates it", async () => {
  let finishCreate: () => void = () => undefined;
  savePageEditorDoc.mockImplementation(({ id }) =>
    id === null
      ? new Promise((resolve) => {
          finishCreate = () =>
            resolve({ department: "", pageId: "page-new-1", slug: "side" });
        })
      : Promise.resolve({ department: "", pageId: id, slug: "side" })
  );
  mount(null);

  let first: Promise<unknown> = Promise.resolve();
  let second: Promise<unknown> = Promise.resolve();
  await act(async () => {
    first = props().savePage(titled("Første"), "no");
    second = props().savePage(titled("Andre"), "no");
    await new Promise((r) => setTimeout(r, 10));
  });
  // The second waits for the create instead of creating its own row.
  expect(savePageEditorDoc).toHaveBeenCalledTimes(1);

  await act(async () => {
    finishCreate();
    await first;
    await second;
  });
  const calls = savePageEditorDoc.mock.calls.map(([args]) => ({
    id: args.id,
    title: args.doc.meta.title,
  }));
  expect(calls).toEqual([
    { id: null, title: "Første" },
    { id: "page-new-1", title: "Andre" },
  ]);
  expect(win.location.pathname).toBe("/pages/page-new-1");
});

test("a save after a failed one still runs, in order", async () => {
  savePageEditorDoc.mockImplementationOnce(() =>
    Promise.resolve({ error: "Appwrite blip" })
  );
  mount(NORWEGIAN_ONLY);
  let first: Promise<unknown> = Promise.resolve();
  let second: Promise<unknown> = Promise.resolve();
  await act(async () => {
    first = props().savePage(titled("Første"), "no");
    second = props().savePage(titled("Andre"), "no");
    await first.catch(() => undefined);
    await second;
  });
  await expect(first).rejects.toThrow("Appwrite blip");
  expect(savePageEditorDoc.mock.calls.map(([a]) => a.doc.meta.title)).toEqual([
    "Første",
    "Andre",
  ]);
});

test("the editor's last-chance save (onFlush) goes through the same queue", async () => {
  let finishCreate: () => void = () => undefined;
  savePageEditorDoc.mockImplementation(({ id }) =>
    id === null
      ? new Promise((resolve) => {
          finishCreate = () =>
            resolve({ department: "", pageId: "page-new-1", slug: "side" });
        })
      : Promise.resolve({ department: "", pageId: id, slug: "side" })
  );
  mount(null);
  const onFlush = props().onFlush;
  expect(typeof onFlush).toBe("function");
  await act(async () => {
    props().savePage(titled("Første"), "no");
    onFlush?.(titled("Siste"), "no");
    await new Promise((r) => setTimeout(r, 10));
    finishCreate();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(savePageEditorDoc.mock.calls.map(([a]) => a.id)).toEqual([
    null,
    "page-new-1",
  ]);
});

test("a first create that finishes after the editor was left does not rewrite the URL", async () => {
  let finishCreate: () => void = () => undefined;
  savePageEditorDoc.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishCreate = () =>
          resolve({ department: "", pageId: "page-new-1", slug: "side" });
      })
  );
  mount(null);
  let save: Promise<unknown> = Promise.resolve();
  await act(async () => {
    save = props().savePage(titled("Første"), "no");
    await new Promise((r) => setTimeout(r, 10));
  });
  // The editor was left for the page list before the create came back.
  win.history.pushState(null, "", "/pages");
  await act(async () => {
    finishCreate();
    await save;
  });
  expect(win.location.pathname).toBe("/pages");
});

test("publishing the untouched English locale saves it first, then publishes it", async () => {
  const stored = new Set<string>(["no"]);
  savePageEditorDoc.mockImplementation(({ id, locale }) => {
    stored.add(locale ?? "no");
    return Promise.resolve({
      department: "",
      pageId: id ?? "page-1",
      slug: "side",
    });
  });
  publishPageAction.mockImplementation((_id, locale) =>
    stored.has(locale)
      ? Promise.resolve(PUBLISHED)
      : Promise.reject(new Error("No translation found to publish"))
  );
  mount(NORWEGIAN_ONLY);
  act(() => props().onLocaleChange("en"));
  expect(props().activeLocale).toBe("en");
  const english = props().initial as PageDoc;

  await act(async () => {
    await props().onPublish?.("en");
  });

  expect(savePageEditorDoc).toHaveBeenCalledTimes(1);
  const [saved] = savePageEditorDoc.mock.calls[0] ?? [];
  expect(saved?.id).toBe("page-1");
  expect(saved?.locale).toBe("en");
  expect(saved?.doc.meta.title).toBe(english.meta.title);
  expect(publishPageAction).toHaveBeenCalledTimes(1);
  expect(publishPageAction.mock.calls[0]?.[1]).toBe("en");
  expect(toast.error).not.toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalledTimes(1);
});

test("when that save is refused, says to save the language first and publishes nothing", async () => {
  savePageEditorDoc.mockImplementation(() =>
    Promise.resolve({ error: "Not allowed" })
  );
  mount(NORWEGIAN_ONLY);
  act(() => props().onLocaleChange("en"));

  let failure: unknown = null;
  const quiet = console.error;
  console.error = () => undefined;
  try {
    await act(async () => {
      await props()
        .onPublish?.("en")
        .catch((error: unknown) => {
          failure = error;
        });
    });
  } finally {
    console.error = quiet;
  }

  expect(failure).toBeInstanceOf(Error);
  expect(publishPageAction).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(toast.error.mock.calls[0]?.[0]).toBe(
    "Save this language before publishing"
  );
  // The reason the save was refused goes with it.
  expect(toast.error.mock.calls[0]?.[1]).toEqual({
    description: "Not allowed",
  });
});

test("a locale that is stored publishes without another save", async () => {
  mount(NORWEGIAN_ONLY);
  await act(async () => {
    await props().onPublish?.("no");
  });
  expect(savePageEditorDoc).not.toHaveBeenCalled();
  expect(publishPageAction).toHaveBeenCalledTimes(1);

  // English, once saved by an edit, is stored too.
  act(() => props().onLocaleChange("en"));
  await act(async () => {
    await props().savePage(titled("Page"), "en");
    await props().onPublish?.("en");
  });
  expect(savePageEditorDoc).toHaveBeenCalledTimes(1);
  expect(publishPageAction).toHaveBeenCalledTimes(2);
  await settle();
});

test("Publish waits for a save still queued, so it copies the latest draft", async () => {
  let finishSave: () => void = () => undefined;
  savePageEditorDoc.mockImplementation(
    ({ id }) =>
      new Promise((resolve) => {
        finishSave = () =>
          resolve({ department: "", pageId: id ?? "page-1", slug: "side" });
      })
  );
  mount(NORWEGIAN_ONLY);
  let publish: Promise<unknown> = Promise.resolve();
  await act(async () => {
    props().savePage(titled("Siste"), "no");
    publish = props().onPublish?.("no") ?? Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(publishPageAction).not.toHaveBeenCalled();
  await act(async () => {
    finishSave();
    await publish;
  });
  expect(publishPageAction).toHaveBeenCalledTimes(1);
});

test("Publish on an unedited /pages/new creates nothing and says to save the page first", async () => {
  mount(null);
  let failure: unknown;
  await act(async () => {
    await props()
      .onPublish?.("no")
      .catch((err: unknown) => {
        failure = err;
      });
  });
  expect(failure).toBeInstanceOf(Error);
  expect(savePageEditorDoc).not.toHaveBeenCalled();
  expect(publishPageAction).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith(
    "Save the page first before publishing"
  );
});

test("Publish on /pages/new after a real edit has been saved publishes that page", async () => {
  mount(null);
  await act(async () => {
    await props().savePage(titled("Min side"), "no");
    await props().onPublish?.("no");
  });
  expect(savePageEditorDoc.mock.calls.map(([a]) => a.id)).toEqual([null]);
  expect(publishPageAction.mock.calls[0]?.[0]).toBe("page-1");
  expect(toast.error).not.toHaveBeenCalled();
});

test("Publish on /pages/new waits for the first create that is still in flight", async () => {
  let finishCreate: () => void = () => undefined;
  savePageEditorDoc.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishCreate = () =>
          resolve({ department: "", pageId: "page-new-1", slug: "side" });
      })
  );
  mount(null);
  let publish: Promise<unknown> = Promise.resolve();
  await act(async () => {
    props().savePage(titled("Min side"), "no");
    publish = props().onPublish?.("no") ?? Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
  await act(async () => {
    finishCreate();
    await publish;
  });
  expect(publishPageAction.mock.calls[0]?.[0]).toBe("page-new-1");
  expect(toast.error).not.toHaveBeenCalled();
});

test("a failed save before Publish says nothing was published", () => {
  mount(NORWEGIAN_ONLY);
  props().onPublishSaveFailed?.();
  expect(toast.error).toHaveBeenCalledWith(
    "Your latest changes couldn't be saved, so nothing was published."
  );
});

test("a save the server dropped the theme from clears it in every locale document", async () => {
  const withTheme = (doc: PageDoc): PageDoc => ({
    ...doc,
    meta: { ...doc.meta, theme: { accent: "#fecd45", dark: "#2a0a4a" } },
  });
  savePageEditorDoc.mockImplementation(({ id }) =>
    Promise.resolve({
      department: "",
      pageId: id ?? "page-1",
      slug: "side",
      themeDropped: true,
    })
  );
  mount(NORWEGIAN_ONLY);
  // Open English, so two locale documents hold a theme.
  act(() => props().onLocaleChange("en"));
  act(() => props().onDocChange?.(withTheme(props().initial as PageDoc), "en"));
  act(() => props().onLocaleChange("no"));
  act(() => props().onDocChange?.(withTheme(DOC_NO), "no"));

  let stored: unknown;
  await act(async () => {
    stored = await props().savePage(withTheme(DOC_NO), "no");
  });

  // The shell is told, to clear its own store ...
  expect(stored).toMatchObject({ themeDropped: true });
  // ... and every locale document the host holds drops it.
  act(() => props().onLocaleChange("en"));
  expect(props().initial?.meta.theme).toBeUndefined();
  act(() => props().onLocaleChange("no"));
  expect(props().initial?.meta.theme).toBeUndefined();
});
